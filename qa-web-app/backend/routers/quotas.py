from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.gcore_client import get_client, start_capture, stop_capture
from backend.config import get_settings

router = APIRouter()

_QUOTA_FIELDS = [
    ("baremetal_hf_count", "Baremetal HF"),
    ("external_ip_count", "External IP"),
    ("baremetal_infrastructure_count", "BM Infrastructure"),
]


def _is_sufficient(name: str, headroom: int, servers_count: int) -> bool:
    if name == "baremetal_infrastructure_count":
        return headroom >= servers_count
    return headroom > servers_count


@router.get("/quotas")
def get_quotas(
    region_id: int = Query(...),
    servers_count: int = Query(default=1),
):
    try:
        settings = get_settings()
        start_capture()
        client = get_client()
        quota = client.cloud.quotas.get_by_region(
            client_id=int(settings.client_id),
            region_id=region_id,
        )
        dev = stop_capture()
    except Exception as exc:
        stop_capture()
        return JSONResponse(
            status_code=502,
            content={"detail": f"Failed to fetch quotas: {exc}"},
        )

    items = []
    for name, label in _QUOTA_FIELDS:
        limit = getattr(quota, f"{name}_limit", None)
        usage = getattr(quota, f"{name}_usage", None)
        if limit is None or usage is None:
            limit, usage, headroom, sufficient = 0, 0, 0, False
        else:
            headroom = limit - usage
            sufficient = _is_sufficient(name, headroom, servers_count)
        items.append(
            {
                "name": name,
                "label": label,
                "limit": limit,
                "usage": usage,
                "headroom": headroom,
                "sufficient": sufficient,
            }
        )

    return {
        "region_id": region_id,
        "servers_count": servers_count,
        "quotas": items,
        "overall_sufficient": all(item["sufficient"] for item in items),
        "_dev": {"requests": dev},
    }
