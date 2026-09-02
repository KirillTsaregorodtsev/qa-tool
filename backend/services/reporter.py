import csv
import logging
from datetime import datetime, timezone
from pathlib import Path

from backend.run_store import RunRecord

logger = logging.getLogger(__name__)

# Full column set matching the Source project.
# Checker-phase columns (CPU … Speed) are blank until the checker slice lands.
_COLUMNS = [
    "Server ID",
    "CPU",
    "RAM",
    "Disk",
    "Disk Count",
    "IP Address",
    "Instance ID",
    "Console OK",
    "Ping",
    "Speed",
]


def write_report(record: RunRecord, reports_dir: str) -> Path:
    out_dir = Path(reports_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{record.jira_task_id}_{timestamp}.csv"
    out_path = out_dir / filename

    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=_COLUMNS)
        writer.writeheader()
        for server in sorted(record.servers, key=lambda s: s.index):
            writer.writerow({
                "Server ID": server.index,
                "CPU": server.cpu or "",
                "RAM": server.ram or "",
                "Disk": server.disk or "",
                "Disk Count": server.disk_count or "",
                "IP Address": server.ip_address or "",
                "Instance ID": server.instance_id or "",
                "Console OK": server.console_ok or "",
                "Ping": server.ping or "",
                "Speed": server.speed or "",
            })

    logger.info("Report written: %s", out_path)
    return out_path
