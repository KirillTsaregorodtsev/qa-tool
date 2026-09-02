import os
import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_SAFE_FILENAME = re.compile(r"^[A-Za-z0-9_-]+\.csv$")
_DEFAULT_REPORTS_DIR = "/app/volume/reports"


def _reports_dir() -> Path:
    try:
        from backend.config import get_settings
        return Path(get_settings().reports_dir)
    except ValueError:
        return Path(os.environ.get("REPORTS_DIR", _DEFAULT_REPORTS_DIR))


@router.get("/reports")
def list_reports():
    d = _reports_dir()
    if not d.exists():
        return {"reports": []}
    files = sorted(d.glob("*.csv"), key=lambda f: f.stat().st_mtime, reverse=True)
    return {
        "reports": [
            {
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            }
            for f in files
        ]
    }


@router.get("/reports/{filename}/download")
def download_report(filename: str):
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    d = _reports_dir()
    file_path = d / filename

    # Confirm the resolved path is still inside reports_dir (defence in depth)
    try:
        file_path.resolve().relative_to(d.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Report {filename!r} not found.")

    return FileResponse(
        path=str(file_path),
        media_type="text/csv",
        filename=filename,
    )


@router.delete("/reports/{filename}", status_code=204)
def delete_report(filename: str):
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    d = _reports_dir()
    file_path = d / filename

    try:
        file_path.resolve().relative_to(d.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Report {filename!r} not found.")

    file_path.unlink()

