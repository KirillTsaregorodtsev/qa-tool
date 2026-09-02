import json
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.config import reload_settings
from backend.gcore_client import reset_client

router = APIRouter()

DEFAULT_CONFIG_DIR = "/app/volume/config"
DEFAULT_PROJECT_ID = "309102"
DEFAULT_PROJECT_NAME = None


class RunDefaultsUpdate(BaseModel):
    region_id: Optional[int] = None
    flavor_id: Optional[str] = None
    servers_count: int = Field(default=1, ge=1)


class ProjectSettingsUpdate(BaseModel):
    project_id: int
    project_name: Optional[str] = None


class ImageSettingsUpdate(BaseModel):
    image_name: str


def _settings_path() -> Path:
    return Path(os.environ.get("CONFIG_DIR", DEFAULT_CONFIG_DIR)) / "settings.json"


def _read_settings_file() -> dict:
    path = _settings_path()
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def _write_settings_file(data: dict) -> None:
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


@router.get("/settings")
def get_safe_settings():
    data = _read_settings_file()
    return {
        "project": {
            "project_id": data.get("project_id", DEFAULT_PROJECT_ID),
            "project_name": data.get("project_name", DEFAULT_PROJECT_NAME),
        },
        "run_defaults": data.get(
            "run_defaults",
            {"region_id": None, "servers_count": 1, "flavor_id": None},
        ),
        "image_name": data.get("image_name", "ubuntu-26.04-x64-ironic"),
    }


@router.patch("/settings/run-defaults")
def update_run_defaults(defaults: RunDefaultsUpdate):
    try:
        data = _read_settings_file()
        data["run_defaults"] = defaults.model_dump()
        _write_settings_file(data)
        try:
            reload_settings()
        except ValueError:
            # Saving safe UI defaults should not require a configured API key.
            pass
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to save run defaults: {exc}"},
        )

    return {"run_defaults": data["run_defaults"]}


@router.patch("/settings/project")
def update_project_settings(project: ProjectSettingsUpdate):
    try:
        data = _read_settings_file()
        data["project_id"] = str(project.project_id)
        data["project_name"] = project.project_name
        _write_settings_file(data)
        try:
            reload_settings()
        except ValueError:
            # Saving project choice should not require a configured API key.
            pass
        reset_client()
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to save project settings: {exc}"},
        )

    return {
        "project": {
            "project_id": data["project_id"],
            "project_name": data.get("project_name"),
        }
    }


@router.patch("/settings/image")
def update_image_settings(body: ImageSettingsUpdate):
    try:
        data = _read_settings_file()
        data["image_name"] = body.image_name
        _write_settings_file(data)
        try:
            reload_settings()
        except ValueError:
            pass
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to save image settings: {exc}"},
        )

    return {"image_name": data["image_name"]}
