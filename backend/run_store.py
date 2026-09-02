import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel

logger = logging.getLogger(__name__)


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class ServerRecord(BaseModel):
    index: int
    name: Optional[str] = None
    task_id: Optional[str] = None
    instance_id: Optional[str] = None
    ip_address: Optional[str] = None
    status: str = "pending"
    error: Optional[str] = None
    cpu: Optional[str] = None
    ram: Optional[str] = None
    disk: Optional[str] = None
    disk_count: Optional[str] = None
    console_ok: Optional[str] = None
    ping: Optional[str] = None
    speed: Optional[str] = None


class RunRecord(BaseModel):
    run_id: str
    jira_task_id: str
    region_id: int
    flavor_id: str
    image_id: Optional[str] = None
    servers_count: int
    status: str = "queued"
    cancelled: bool = False
    error: Optional[str] = None
    created_at: str
    updated_at: str
    servers: list[ServerRecord] = []


class RunStore:
    def __init__(self, runs_dir: Path):
        self._dir = runs_dir
        self._dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._cache: dict[str, RunRecord] = {}
        self._load_all()

    def _load_all(self) -> None:
        for f in self._dir.glob("*.json"):
            try:
                record = RunRecord(**json.loads(f.read_text()))
                self._cache[record.run_id] = record
            except Exception:
                logger.warning("Failed to load run record %s", f)

    def _persist(self, record: RunRecord) -> None:
        (self._dir / f"{record.run_id}.json").write_text(record.model_dump_json(indent=2))

    def create(
        self,
        jira_task_id: str,
        region_id: int,
        flavor_id: str,
        servers_count: int,
        image_id: Optional[str] = None,
    ) -> RunRecord:
        now = _utcnow()
        record = RunRecord(
            run_id=str(uuid4()),
            jira_task_id=jira_task_id,
            region_id=region_id,
            flavor_id=flavor_id,
            image_id=image_id,
            servers_count=servers_count,
            status="queued",
            created_at=now,
            updated_at=now,
            servers=[ServerRecord(index=i) for i in range(1, servers_count + 1)],
        )
        with self._lock:
            self._cache[record.run_id] = record
            self._persist(record)
        return record

    def get(self, run_id: str) -> Optional[RunRecord]:
        with self._lock:
            return self._cache.get(run_id)

    def list_all(self) -> list[RunRecord]:
        with self._lock:
            return sorted(self._cache.values(), key=lambda r: r.created_at, reverse=True)

    def update_run(self, run_id: str, **kwargs) -> None:
        with self._lock:
            record = self._cache.get(run_id)
            if record is None:
                return
            for k, v in kwargs.items():
                setattr(record, k, v)
            record.updated_at = _utcnow()
            self._persist(record)

    def update_server(self, run_id: str, server_idx: int, **kwargs) -> None:
        with self._lock:
            record = self._cache.get(run_id)
            if record is None:
                return
            for server in record.servers:
                if server.index == server_idx:
                    for k, v in kwargs.items():
                        setattr(server, k, v)
                    break
            record.updated_at = _utcnow()
            self._persist(record)

    def cancel_run(self, run_id: str) -> bool:
        with self._lock:
            record = self._cache.get(run_id)
            if record is None:
                return False
            record.cancelled = True
            record.updated_at = _utcnow()
            self._persist(record)
            return True

    def delete(self, run_id: str) -> bool:
        with self._lock:
            record = self._cache.pop(run_id, None)
            if record is None:
                return False
            json_file = self._dir / f"{run_id}.json"
            if json_file.exists():
                json_file.unlink()
            return True


_store: Optional[RunStore] = None
_store_init_lock = threading.Lock()


def get_store() -> RunStore:
    global _store
    if _store is None:
        with _store_init_lock:
            if _store is None:
                from backend.config import get_settings
                settings = get_settings()
                _store = RunStore(Path(settings.reports_dir) / "runs")
    return _store
