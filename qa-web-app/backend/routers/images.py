from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.gcore_client import get_client, start_capture, stop_capture
from backend.services import image_cache

router = APIRouter()


def _normalize_image(img):
    return {
        "id": str(getattr(img, "id", None)),
        "name": getattr(img, "name", None),
        "os_distro": getattr(img, "os_distro", None),
        "os_version": getattr(img, "os_version", None),
        "min_disk": getattr(img, "min_disk", None),
        "min_ram": getattr(img, "min_ram", None),
    }


def fetch_images(project_id: int, region_id: int) -> tuple[list, list]:
    """Call the Gcore cloud API and return (normalized_ubuntu_images, dev_requests).

    Raises on any cloud error — caller must NOT cache the result in the error case.
    Capture lifecycle is owned entirely here: start_capture() is always paired with
    exactly one stop_capture() via try/finally, regardless of success or exception.
    """
    start_capture()
    try:
        client = get_client()
        result = client.cloud.baremetal.images.list(
            region_id=region_id,
            project_id=project_id,
        )
    except Exception:
        stop_capture()
        raise
    dev = stop_capture()

    results = getattr(result, "results", result)
    images = [
        _normalize_image(img)
        for img in results
        if "ubuntu" in (getattr(img, "name", "") or "").lower()
    ]
    return images, dev


@router.get("/images")
def list_images(
    region_id: int | None = Query(default=None),
    refresh: bool = Query(default=False),
):
    if region_id is None:
        return JSONResponse(status_code=400, content={"detail": "region_id is required"})

    settings = get_settings()
    project_id = int(settings.project_id)

    if not refresh:
        cached = image_cache.get(project_id, region_id)
        if cached is not None:
            return {"region_id": region_id, "images": cached, "_dev": {"requests": []}}

    try:
        images, dev = fetch_images(project_id, region_id)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"detail": f"Failed to fetch images: {exc}"},
        )

    image_cache.set(project_id, region_id, images)
    return {"region_id": region_id, "images": images, "_dev": {"requests": dev}}
