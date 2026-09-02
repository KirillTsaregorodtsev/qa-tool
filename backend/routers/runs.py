from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response
from pydantic import BaseModel, Field

from backend import provisioner
from backend.config import get_settings
from backend.run_store import get_store

router = APIRouter()


class StartRunRequest(BaseModel):
    jira_task_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$",
    )
    region_id: int
    flavor_id: str = Field(..., min_length=1)
    servers_count: int = Field(default=1, ge=1, le=50)
    image_id: Optional[str] = None


@router.post("/runs", status_code=201)
def start_run(req: StartRunRequest, background_tasks: BackgroundTasks):
    try:
        get_settings()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    store = get_store()
    record = store.create(
        jira_task_id=req.jira_task_id,
        region_id=req.region_id,
        flavor_id=req.flavor_id,
        servers_count=req.servers_count,
        image_id=req.image_id,
    )
    background_tasks.add_task(provisioner.start_run, record.run_id, store)
    return record.model_dump()


@router.get("/runs")
def list_runs():
    return {"runs": [r.model_dump() for r in get_store().list_all()]}


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    record = get_store().get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")
    return record.model_dump()


@router.patch("/runs/{run_id}/cancel")
def cancel_run(run_id: str):
    store = get_store()
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")
    if record.status != "running":
        raise HTTPException(status_code=409, detail=f"Run {run_id!r} is not running (status={record.status!r})")
    store.cancel_run(run_id)
    return {"run_id": run_id, "cancelled": True}


@router.delete("/runs/{run_id}", status_code=204)
def delete_run(run_id: str):
    store = get_store()
    record = store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id!r} not found")
    if record.status == "running":
        raise HTTPException(status_code=409, detail=f"Run {run_id!r} is currently running and cannot be deleted")
    store.delete(run_id)
    return Response(status_code=204)
