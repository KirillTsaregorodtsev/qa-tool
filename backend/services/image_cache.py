"""
In-memory image cache keyed by (project_id, region_id).
No TTL — entries live until invalidated or cleared manually.
Thread-safe via a single module-level lock.
"""
import threading
from typing import Optional

_lock = threading.Lock()
_cache: dict[tuple[int, int], list] = {}


def get(project_id: int, region_id: int) -> Optional[list]:
    """Return cached image list or None if not present."""
    with _lock:
        return _cache.get((project_id, region_id))


def set(project_id: int, region_id: int, images: list) -> None:
    """Store image list for the given key, replacing any existing entry."""
    with _lock:
        _cache[(project_id, region_id)] = images


def invalidate(project_id: int, region_id: int) -> None:
    """Remove a single cache entry (no-op if absent)."""
    with _lock:
        _cache.pop((project_id, region_id), None)


def clear() -> None:
    """Remove all cache entries."""
    with _lock:
        _cache.clear()
