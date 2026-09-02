from fastapi.responses import JSONResponse
from fastapi import APIRouter

from backend.gcore_client import get_client, start_capture, stop_capture

router = APIRouter()


@router.get("/regions")
def list_regions():
    try:
        start_capture()
        client = get_client()
        result = client.cloud.regions.list()
        dev = stop_capture()
    except Exception as exc:
        stop_capture()
        return JSONResponse(
            status_code=502,
            content={"detail": f"Failed to fetch regions from GCore API: {exc}"},
        )

    regions = [
        {
            "id": r.id,
            "display_name": getattr(r, "display_name", None) or getattr(r, "name", None) or str(r.id),
            "keystone_name": getattr(r, "keystone_name", None),
            "has_baremetal": getattr(r, "has_baremetal", None),
        }
        for r in result.results
    ]
    return {"regions": regions, "_dev": {"requests": dev}}
