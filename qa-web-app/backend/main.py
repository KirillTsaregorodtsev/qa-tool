import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.routers import cleanup, flavors, images, projects, quotas, regions, reports, runs, settings
from backend.routers.images import fetch_images
from backend.services import image_cache

logger = logging.getLogger(__name__)

# In Docker: /app/frontend/dist (Dockerfile copies it there)
# Locally: frontend/dist relative to the project root (sibling of backend/)
_CANDIDATE_DIST_PATHS = [
    Path("/app/frontend/dist"),
    Path(__file__).parent.parent / "frontend" / "dist",
]
FRONTEND_DIST = next((p for p in _CANDIDATE_DIST_PATHS if p.exists()), None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("QA Web App starting up")
    try:
        settings = get_settings()
        logger.info("Base URL: %s", settings.base_url)
        logger.info("Config dir: %s", settings.config_dir)
        logger.info("Reports dir: %s", settings.reports_dir)
        logger.info("Max workers: %s", settings.max_workers)
        logger.info("API key configured: %s", bool(settings.cloud_api_key))
    except ValueError as e:
        logger.warning("Settings not fully configured: %s", e)
    logger.info("Frontend dist: %s", FRONTEND_DIST or "not built")

    # Best-effort warm-up: pre-populate image cache for the default region.
    # Any failure (missing API key, network error, etc.) is logged and silently
    # swallowed so startup never crashes.
    try:
        _warmup_settings = get_settings()
        _warmup_region_id = getattr(_warmup_settings.run_defaults, "region_id", None)
        if (
            _warmup_settings.project_id
            and _warmup_region_id is not None
            and _warmup_settings.cloud_api_key
        ):
            _warmup_project_id = int(_warmup_settings.project_id)
            logger.info(
                "Warming up image cache for project=%s region=%s",
                _warmup_project_id,
                _warmup_region_id,
            )
            _warmup_images, _ = fetch_images(_warmup_project_id, _warmup_region_id)
            image_cache.set(_warmup_project_id, _warmup_region_id, _warmup_images)
            logger.info("Image cache warm-up complete (%d images)", len(_warmup_images))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Image cache warm-up failed (non-fatal): %s", exc)

    yield
    logger.info("QA Web App shutting down")


app = FastAPI(title="QA Web App", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(regions.router, prefix="/api")
app.include_router(quotas.router, prefix="/api")
app.include_router(flavors.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(cleanup.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/api/health")
def health():
    try:
        settings = get_settings()
        api_key_configured = bool(settings.cloud_api_key)
    except ValueError:
        api_key_configured = False
    return {"status": "ok", "api_key_configured": api_key_configured}


if FRONTEND_DIST is not None:
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def frontend_not_built():
        return JSONResponse(
            content={"message": "Frontend not built. Run: cd frontend && npm run build"}
        )
