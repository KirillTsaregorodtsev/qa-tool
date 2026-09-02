from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.gcore_client import get_client, start_capture, stop_capture

router = APIRouter()


def _first_attr(obj, names):
    for name in names:
        value = getattr(obj, name, None)
        if value is not None:
            return value
    return None


def _normalize_flavor(flavor):
    flavor_id = _first_attr(flavor, ["id", "flavor_id", "name"])
    name = _first_attr(flavor, ["name", "flavor_name", "display_name"]) or str(flavor_id)

    return {
        "id": str(flavor_id),
        "name": name,
        "vcpus": _first_attr(flavor, ["vcpus", "cpu", "cpus", "vcpu"]),
        "ram": _first_attr(flavor, ["ram", "memory", "memory_mb"]),
        "disk": _first_attr(flavor, ["disk", "disk_size", "storage"]),
        "capacity": _first_attr(flavor, ["capacity"]),
        "reserved_capacity": _first_attr(flavor, ["reserved_capacity"]),
        "disabled": _first_attr(flavor, ["disabled"]),
    }


@router.get("/flavors")
def list_flavors(region_id: int | None = Query(default=None)):
    if region_id is None:
        return JSONResponse(status_code=400, content={"detail": "region_id is required"})

    try:
        settings = get_settings()
        start_capture()
        client = get_client()
        result = client.cloud.baremetal.flavors.list(
            project_id=int(settings.project_id),
            region_id=region_id,
            include_capacity=True,
        )
        dev = stop_capture()
    except Exception as exc:
        stop_capture()
        return JSONResponse(
            status_code=502,
            content={"detail": f"Failed to fetch flavors: {exc}"},
        )

    results = getattr(result, "results", result)
    flavors = [_normalize_flavor(item) for item in results]
    return {"region_id": region_id, "flavors": flavors, "_dev": {"requests": dev}}
