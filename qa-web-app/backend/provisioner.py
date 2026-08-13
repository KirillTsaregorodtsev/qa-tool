import ipaddress
import logging
import time
from concurrent.futures import ThreadPoolExecutor

from backend.config import get_settings
from backend.gcore_client import get_client
from backend.run_store import RunStore

logger = logging.getLogger(__name__)


def _get_image_id(region_id: int, project_id: int, image_name: str) -> str:
    client = get_client()
    images = client.cloud.baremetal.images.list(region_id=region_id, project_id=project_id)
    for image in getattr(images, "results", images):
        if image.name == image_name:
            return image.id
    raise ValueError(f"Image '{image_name}' not found in region {region_id}")


def _get_public_ipv4(instance) -> str:
    """B-2 fix: iterate all address groups, pick first public IPv4."""
    for addrs in instance.addresses.values():
        for addr in addrs:
            try:
                ip = ipaddress.ip_address(addr.addr)
                if ip.version == 4 and not ip.is_private:
                    return str(ip)
            except (ValueError, TypeError):
                continue
    raise ValueError(f"No public IPv4 found for instance {instance.id}")


def _wait_for_task(task_id: str, sleep_sec: int = 10, timeout: int = 2400) -> object:
    client = get_client()
    for _ in range(0, timeout, sleep_sec):
        try:
            task = client.cloud.tasks.get(task_id=task_id)
        except Exception:
            logger.exception("Failed to poll task %s", task_id)
            time.sleep(sleep_sec)
            continue
        state = task.state
        if state in ("NEW", "RUNNING"):
            time.sleep(sleep_sec)
            continue
        if state != "FINISHED":
            raise AssertionError(
                f"Task {task.task_type} {task.id} ended in state {state}. Error: {task.error}"
            )
        return task
    raise TimeoutError(f"Task {task_id} did not finish within {timeout}s")


def _provision_one(
    run_id: str,
    server_idx: int,
    jira_task_id: str,
    region_id: int,
    flavor_id: str,
    project_id: int,
    image_id: str,
    ssh_key_name: str,
    store: RunStore,
) -> None:
    name = f"qa_autotest_bm_{jira_task_id}_tk_{server_idx}"
    run = store.get(run_id)
    if run is not None and run.cancelled:
        store.update_server(run_id, server_idx, status="cancelled")
        return
    store.update_server(run_id, server_idx, status="provisioning", name=name)
    try:
        client = get_client()
        task_list = client.cloud.baremetal.servers.create(
            name=name,
            image_id=image_id,
            flavor=flavor_id,
            ssh_key_name=ssh_key_name,
            interfaces=[{"type": "external"}],
            region_id=region_id,
            project_id=project_id,
        )
        task_id = task_list.tasks[0]
        store.update_server(run_id, server_idx, task_id=task_id)

        task = _wait_for_task(task_id)
        instance_id = task.created_resources.instances[0]
        store.update_server(run_id, server_idx, instance_id=instance_id)

        instance = client.cloud.instances.get(
            instance_id=instance_id,
            region_id=region_id,
            project_id=project_id,
        )
        ip_address = _get_public_ipv4(instance)
        store.update_server(run_id, server_idx, ip_address=ip_address, status="ready")

        logger.info("Server %s is ready, waiting 3 minutes before SSH", name)
        time.sleep(180)

        from backend.services.checker import check_server
        settings = get_settings()
        check_server(
            run_id=run_id,
            server_idx=server_idx,
            ip_address=ip_address,
            instance_id=instance_id,
            region_id=region_id,
            project_id=project_id,
            store=store,
            settings=settings,
        )
    except Exception as exc:
        logger.error("Server %s provisioning failed: %s", name, exc, exc_info=True)
        store.update_server(run_id, server_idx, status="failed", error=str(exc))


def start_run(run_id: str, store: RunStore) -> None:
    record = store.get(run_id)
    if record is None:
        logger.error("start_run: run %s not found", run_id)
        return

    settings = get_settings()
    project_id = int(settings.project_id)

    if record.image_id:
        image_id = record.image_id
    else:
        try:
            image_id = _get_image_id(record.region_id, project_id, settings.image_name)
        except Exception as exc:
            logger.error("Image lookup failed for run %s: %s", run_id, exc)
            store.update_run(run_id, status="failed", error=str(exc))
            return

    store.update_run(run_id, status="running")

    max_workers = min(settings.max_workers, record.servers_count)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [
            pool.submit(
                _provision_one,
                run_id,
                idx,
                record.jira_task_id,
                record.region_id,
                record.flavor_id,
                project_id,
                image_id,
                settings.ssh_key_name,
                store,
            )
            for idx in range(1, record.servers_count + 1)
        ]
        for f in futures:
            try:
                f.result()
            except Exception as exc:
                logger.error("Unhandled provisioner error: %s", exc)

    record = store.get(run_id)
    statuses = {s.status for s in record.servers}
    if record.cancelled and statuses <= {"cancelled"}:
        final = "cancelled"
    elif statuses == {"ready"}:
        final = "done"
    else:
        final = "failed"
    store.update_run(run_id, status=final)

    try:
        from backend.services.reporter import write_report
        write_report(store.get(run_id), settings.reports_dir)
    except Exception:
        logger.exception("Failed to write report for run %s", run_id)
