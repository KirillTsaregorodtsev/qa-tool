import logging
import time
from pathlib import Path

import paramiko
import requests

logger = logging.getLogger(__name__)

_VENDOR_SPEEDTEST = Path(__file__).parent.parent / "vendor" / "speedtest.py"

_SSH_USER = "ubuntu"
_SSH_RETRIES = 10
_SSH_RETRY_SLEEP = 6
_EXEC_TIMEOUT = 120


def _exec(ssh: paramiko.SSHClient, cmd: str) -> str:
    """Run cmd on the open SSH session; return stdout stripped. Never raises."""
    try:
        _, stdout, _ = ssh.exec_command(cmd, timeout=_EXEC_TIMEOUT)
        return stdout.read().decode(errors="replace").strip()
    except Exception as exc:
        return f"error: {exc}"


def _connect_ssh(ip_address: str, ssh_key_path: str) -> paramiko.SSHClient:
    """Attempt SSH connection with retry loop. Raises on final failure."""
    key = paramiko.RSAKey.from_private_key_file(ssh_key_path)
    last_exc: Exception = RuntimeError("no attempts made")
    for attempt in range(1, _SSH_RETRIES + 1):
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=ip_address,
                username=_SSH_USER,
                pkey=key,
                look_for_keys=False,
                allow_agent=False,
            )
            logger.info("SSH connected to %s on attempt %d", ip_address, attempt)
            return client
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "SSH connect attempt %d/%d to %s failed: %s",
                attempt,
                _SSH_RETRIES,
                ip_address,
                exc,
            )
            client.close()
            if attempt < _SSH_RETRIES:
                time.sleep(_SSH_RETRY_SLEEP)
    raise last_exc


def _check_console(
    base_url: str,
    project_id: int,
    region_id: int,
    instance_id: str,
    cloud_api_key: str,
) -> str:
    url = (
        f"{base_url}/cloud/v1/instances/{project_id}/{region_id}"
        f"/{instance_id}/get_console"
    )
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"APIKey {cloud_api_key}"},
            timeout=30,
        )
        return f"{resp.status_code} {resp.text}"
    except Exception as exc:
        return f"error: {exc}"


def check_server(
    run_id: str,
    server_idx: int,
    ip_address: str,
    instance_id: str,
    region_id: int,
    project_id: int,
    store,
    settings,
) -> None:
    """Run all checks and update server fields in store. Never raises."""
    try:
        _do_check_server(
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
        logger.error(
            "check_server top-level error for run %s server %d: %s",
            run_id,
            server_idx,
            exc,
            exc_info=True,
        )


def _do_check_server(
    run_id: str,
    server_idx: int,
    ip_address: str,
    instance_id: str,
    region_id: int,
    project_id: int,
    store,
    settings,
) -> None:
    ssh_key_path = settings.ssh_key_path
    base_url = settings.base_url
    cloud_api_key = settings.cloud_api_key

    # SSH connect with retry loop
    try:
        ssh = _connect_ssh(ip_address, ssh_key_path)
    except Exception as exc:
        err = f"error: SSH connect failed: {exc}"
        store.update_server(
            run_id,
            server_idx,
            cpu=err,
            ram=err,
            disk=err,
            disk_count=err,
            ping=err,
            speed=err,
        )
        # console check is HTTP-based, still attempt it
        console_ok = _check_console(
            base_url, project_id, region_id, instance_id, cloud_api_key
        )
        store.update_server(run_id, server_idx, console_ok=console_ok)
        return

    try:
        # Upload speedtest.py via SFTP
        try:
            sftp = ssh.open_sftp()
            sftp.put(str(_VENDOR_SPEEDTEST), "/tmp/speedtest.py")
            sftp.close()
            logger.info("speedtest.py uploaded to %s", ip_address)
        except Exception as exc:
            logger.warning("SFTP upload failed for %s: %s", ip_address, exc)

        # CPU
        try:
            cpu_raw = _exec(ssh, "cat /proc/cpuinfo | grep 'model name' | head -1")
            cpu = cpu_raw.split(":")[-1].strip() if ":" in cpu_raw else cpu_raw
        except Exception as exc:
            cpu = f"error: {exc}"

        # RAM
        try:
            ram = _exec(ssh, "free -h | grep Mem | awk '{print $2}'")
        except Exception as exc:
            ram = f"error: {exc}"

        # Disk
        try:
            disk = _exec(ssh, "lsblk")
        except Exception as exc:
            disk = f"error: {exc}"

        # Disk count
        try:
            disk_count = _exec(
                ssh, "lsblk -o TYPE,MODEL,SERIAL,VENDOR | grep -c disk"
            )
        except Exception as exc:
            disk_count = f"error: {exc}"

        # Ping
        try:
            ping = _exec(ssh, "ping -c 3 google.com")
        except Exception as exc:
            ping = f"error: {exc}"

        # Speed
        try:
            speed = _exec(
                ssh, "python3 /tmp/speedtest.py | grep -E 'Download|Upload'"
            )
        except Exception as exc:
            speed = f"error: {exc}"

    finally:
        ssh.close()

    # Console check — HTTP, independent of SSH
    console_ok = _check_console(
        base_url, project_id, region_id, instance_id, cloud_api_key
    )

    store.update_server(
        run_id,
        server_idx,
        cpu=cpu,
        ram=ram,
        disk=disk,
        disk_count=disk_count,
        console_ok=console_ok,
        ping=ping,
        speed=speed,
    )
    logger.info("check_server complete for run %s server %d", run_id, server_idx)
