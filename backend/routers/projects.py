from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.gcore_client import get_client, start_capture, stop_capture

router = APIRouter()


@router.get("/projects")
def list_projects():
    try:
        start_capture()
        client = get_client()
        result = client.cloud.projects.list(limit=200, order_by="name.asc")
        dev = stop_capture()
    except Exception as exc:
        stop_capture()
        return JSONResponse(
            status_code=502,
            content={"detail": f"Failed to fetch projects: {exc}"},
        )

    items = getattr(result, "results", result)
    projects = [
        {
            "id": project.id,
            "name": project.name,
            "client_id": getattr(project, "client_id", None),
            "is_default": getattr(project, "is_default", None),
            "state": getattr(project, "state", None),
        }
        for project in items
    ]
    return {"projects": projects, "_dev": {"requests": dev}}
