import json
import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel


class RunDefaults(BaseModel):
    region_id: Optional[int] = None
    servers_count: int = 1
    flavor_id: Optional[str] = None


class Settings(BaseModel):
    cloud_api_key: str
    base_url: str
    config_dir: str
    reports_dir: str
    ssh_key_path: str
    max_workers: int
    client_id: str
    project_id: str
    project_name: Optional[str] = None
    ssh_key_name: str
    image_name: str
    run_defaults: RunDefaults = RunDefaults()


# Hardcoded defaults (lowest precedence)
_DEFAULTS = {
    "base_url": "https://api.gcore.com",
    "config_dir": "/app/volume/config",
    "reports_dir": "/app/volume/reports",
    "ssh_key_path": "/app/volume/config/ssh_key",
    "max_workers": 5,
    "client_id": "130485",
    "project_id": "309102",
    "project_name": None,
    "ssh_key_name": "qa-ssh-keyname-example",
    "image_name": "ubuntu-26.04-x64-ironic",
}

_settings_cache: Optional[Settings] = None


def _load_settings_json(config_dir: str) -> dict:
    path = Path(config_dir) / "settings.json"
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def _build_settings() -> Settings:
    # CLOUD_API_KEY is the documented name; fall back to PROD_API_KEY for
    # users who already have the source project key exported under that name.
    api_key = os.environ.get("CLOUD_API_KEY") or os.environ.get("PROD_API_KEY")
    if not api_key:
        raise ValueError(
            "CLOUD_API_KEY environment variable is required but not set. "
            "(PROD_API_KEY is also accepted as a fallback.)"
        )

    config_dir = os.environ.get("CONFIG_DIR", _DEFAULTS["config_dir"])

    file_cfg = _load_settings_json(config_dir)

    # Merge: hardcoded defaults < settings.json < env vars
    reports_dir = (
        os.environ.get("REPORTS_DIR")
        or file_cfg.get("reports_dir")
        or _DEFAULTS["reports_dir"]
    )
    ssh_key_path = (
        os.environ.get("SSH_KEY_PATH")
        or file_cfg.get("ssh_key_path")
        or _DEFAULTS["ssh_key_path"]
    )
    max_workers = int(
        os.environ.get("MAX_WORKERS")
        or _DEFAULTS["max_workers"]
    )
    client_id = (
        os.environ.get("CLIENT_ID")
        or file_cfg.get("client_id")
        or _DEFAULTS["client_id"]
    )
    project_id = (
        os.environ.get("PROJECT_ID")
        or file_cfg.get("project_id")
        or _DEFAULTS["project_id"]
    )
    project_name = (
        os.environ.get("PROJECT_NAME")
        or file_cfg.get("project_name")
        or _DEFAULTS["project_name"]
    )
    ssh_key_name = (
        os.environ.get("SSH_KEY_NAME")
        or file_cfg.get("ssh_key_name")
        or _DEFAULTS["ssh_key_name"]
    )
    image_name = (
        os.environ.get("IMAGE_NAME")
        or file_cfg.get("image_name")
        or _DEFAULTS["image_name"]
    )
    base_url = os.environ.get("BASE_URL", _DEFAULTS["base_url"])

    run_defaults_raw = file_cfg.get("run_defaults", {})
    run_defaults = RunDefaults(
        region_id=run_defaults_raw.get("region_id"),
        servers_count=run_defaults_raw.get("servers_count", 1),
        flavor_id=run_defaults_raw.get("flavor_id"),
    )

    return Settings(
        cloud_api_key=api_key,
        base_url=base_url,
        config_dir=config_dir,
        reports_dir=reports_dir,
        ssh_key_path=ssh_key_path,
        max_workers=max_workers,
        client_id=client_id,
        project_id=project_id,
        project_name=project_name,
        ssh_key_name=ssh_key_name,
        image_name=image_name,
        run_defaults=run_defaults,
    )


def get_settings() -> Settings:
    global _settings_cache
    if _settings_cache is None:
        _settings_cache = _build_settings()
    return _settings_cache


def reload_settings() -> Settings:
    global _settings_cache
    _settings_cache = _build_settings()
    return _settings_cache
