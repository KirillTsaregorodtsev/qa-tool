import threading
from typing import Optional

import httpx
from gcore import Gcore

from backend.config import get_settings

# Thread-local request capture — active only between start_capture()/stop_capture() calls
_capture = threading.local()


def _on_request(request: httpx.Request) -> None:
    if getattr(_capture, "active", False):
        _capture.requests.append({
            "method": request.method,
            "url": str(request.url),
        })


def start_capture() -> None:
    _capture.active = True
    _capture.requests = []


def stop_capture() -> list:
    _capture.active = False
    return getattr(_capture, "requests", [])


_client: Optional[Gcore] = None


def get_client() -> Gcore:
    global _client
    if _client is None:
        settings = get_settings()
        http_client = httpx.Client(event_hooks={"request": [_on_request]})
        _client = Gcore(
            api_key=settings.cloud_api_key,
            cloud_project_id=int(settings.project_id),
            base_url=settings.base_url,
            http_client=http_client,
        )
    return _client


def reset_client() -> None:
    global _client
    _client = None
