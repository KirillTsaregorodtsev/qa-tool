import logging

from fastapi import APIRouter, HTTPException

from backend.config import get_settings
from backend.gcore_client import get_client
from backend.run_store import RunRecord, get_store

logger = logging.getLogger(__name__)

router = APIRouter()


@router.delete("/runs/{run_id}/instances")
def delete_run_instances(run_id: str):
    store = get_store()
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")

    if record.status == "running":
        raise HTTPException(
            status_code=409,
            detail=f"Run {run_id!r} is currently running; stop it before cleanup",
        )

    try:
        project_id = int(get_settings().project_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    client = get_client()
    deleted = 0
    failed = 0

    for server in record.servers:
        if server.instance_id is None:
            logger.info(
                "Run %s server %s has no instance_id, skipping", run_id, server.index
            )
            continue

        if server.status == "deleted":
            logger.info(
                "Run %s server %s (instance %s) already deleted, skipping",
                run_id,
                server.index,
                server.instance_id,
            )
            deleted += 1
            continue

        try:
            client.cloud.instances.delete(
                instance_id=server.instance_id,
                region_id=record.region_id,
                project_id=project_id,
            )
            store.update_server(run_id, server.index, status="deleted")
            logger.info(
                "Run %s server %s (instance %s) deleted",
                run_id,
                server.index,
                server.instance_id,
            )
            deleted += 1
        except Exception as exc:
            logger.error(
                "Run %s server %s (instance %s) delete failed: %s",
                run_id,
                server.index,
                server.instance_id,
                exc,
            )
            failed += 1

    store.update_run(run_id, status="cleaned")

    return {"run_id": run_id, "deleted": deleted, "failed": failed}


@router.post("/runs/{run_id}/instances/refresh", response_model=RunRecord)
def refresh_run_instances(run_id: str):
    store = get_store()
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")

    try:
        project_id = int(get_settings().project_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    client = get_client()

    for server in record.servers:
        if server.instance_id is None:
            logger.info(
                "Run %s server %s has no instance_id, skipping refresh",
                run_id,
                server.index,
            )
            continue

        try:
            instance = client.cloud.instances.get(
                instance_id=server.instance_id,
                region_id=record.region_id,
                project_id=project_id,
            )
            new_status = instance.status.lower()
            store.update_server(run_id, server.index, status=new_status)
            logger.info(
                "Run %s server %s (instance %s) refreshed: status=%s",
                run_id,
                server.index,
                server.instance_id,
                new_status,
            )
        except Exception as exc:
            exc_str = str(exc).lower()
            if "404" in exc_str or "not found" in exc_str:
                store.update_server(run_id, server.index, status="deleted")
                logger.info(
                    "Run %s server %s (instance %s) not found in Gcore, marked deleted",
                    run_id,
                    server.index,
                    server.instance_id,
                )
            else:
                logger.error(
                    "Run %s server %s (instance %s) refresh failed: %s",
                    run_id,
                    server.index,
                    server.instance_id,
                    exc,
                )

    return store.get(run_id)
