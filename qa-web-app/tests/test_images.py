"""
Tests for GET /api/images?region_id=N  (with caching, refresh bypass, warm-up).
Gcore client and settings are mocked; no real API calls are made.
"""
import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("CLOUD_API_KEY", "test-key")
os.environ.setdefault("REPORTS_DIR", "/tmp/qa-web-app-test-reports")


def _fake_settings(*, api_key="test-key", region_id=None):
    return SimpleNamespace(
        cloud_api_key=api_key,
        project_id="309102",
        reports_dir="/tmp/qa-web-app-test-reports",
        base_url="https://api.gcore.com",
        max_workers=2,
        image_name="ubuntu",
        ssh_key_name="qa-key",
        config_dir="/tmp",
        run_defaults=SimpleNamespace(region_id=region_id),
    )


def _make_image(id, name):
    return SimpleNamespace(
        id=id, name=name, os_distro=None, os_version=None, min_disk=20, min_ram=2048
    )


def _make_mock_client(images):
    mock_client = MagicMock()
    mock_client.cloud.baremetal.images.list.return_value = SimpleNamespace(results=images)
    return mock_client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_image_cache():
    """Ensure image cache is empty before and after every test."""
    from backend.services import image_cache
    image_cache.clear()
    yield
    image_cache.clear()


@pytest.fixture()
def client():
    from backend.main import app
    with TestClient(app) as tc:
        yield tc


# ---------------------------------------------------------------------------
# Happy path: Ubuntu images are returned, non-Ubuntu are filtered out
# ---------------------------------------------------------------------------

def test_list_images_filters_ubuntu(client):
    all_images = [
        _make_image("img-1", "Ubuntu 22.04"),
        _make_image("img-2", "ubuntu-20.04-lts"),
        _make_image("img-3", "Debian 12"),
        _make_image("img-4", "CentOS 8"),
        _make_image("img-5", "UBUNTU 24.04"),  # uppercase — must be included
    ]
    mock_client = _make_mock_client(all_images)

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        resp = client.get("/api/images?region_id=76")

    assert resp.status_code == 200
    body = resp.json()
    assert body["region_id"] == 76
    assert "_dev" in body

    names = [img["name"] for img in body["images"]]
    assert set(names) == {"Ubuntu 22.04", "ubuntu-20.04-lts", "UBUNTU 24.04"}
    # Debian and CentOS must be absent
    assert "Debian 12" not in names
    assert "CentOS 8" not in names


# ---------------------------------------------------------------------------
# Missing region_id → 400
# ---------------------------------------------------------------------------

def test_list_images_missing_region_id(client):
    resp = client.get("/api/images")
    assert resp.status_code == 400
    assert "region_id" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# API error → 502
# ---------------------------------------------------------------------------

def test_list_images_api_error_returns_502(client):
    mock_client = MagicMock()
    mock_client.cloud.baremetal.images.list.side_effect = RuntimeError("upstream timeout")

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        resp = client.get("/api/images?region_id=76")

    assert resp.status_code == 502
    assert "Failed to fetch images" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Empty result set (no Ubuntu images) → 200 with empty list
# ---------------------------------------------------------------------------

def test_list_images_no_ubuntu_images(client):
    all_images = [
        _make_image("img-10", "Debian 12"),
        _make_image("img-11", "Windows Server 2022"),
    ]
    mock_client = _make_mock_client(all_images)

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        resp = client.get("/api/images?region_id=76")

    assert resp.status_code == 200
    assert resp.json()["images"] == []


# ---------------------------------------------------------------------------
# Cache hit: SDK called exactly once on two identical GETs
# ---------------------------------------------------------------------------

def test_cache_hit_sdk_called_once(client):
    images = [_make_image("img-1", "Ubuntu 22.04")]
    mock_client = _make_mock_client(images)

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        resp1 = client.get("/api/images?region_id=76")
        resp2 = client.get("/api/images?region_id=76")

    assert resp1.status_code == 200
    assert resp2.status_code == 200
    # SDK list() must have been called exactly once
    assert mock_client.cloud.baremetal.images.list.call_count == 1
    # Second response came from cache: _dev.requests is empty
    assert resp2.json()["_dev"]["requests"] == []


# ---------------------------------------------------------------------------
# refresh=true bypasses cache and re-calls the SDK
# ---------------------------------------------------------------------------

def test_refresh_bypasses_cache(client):
    images = [_make_image("img-1", "Ubuntu 22.04")]
    mock_client = _make_mock_client(images)

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        # First call — populates cache
        client.get("/api/images?region_id=76")
        # Second call with refresh=true — must hit SDK again
        resp = client.get("/api/images?region_id=76&refresh=true")

    assert resp.status_code == 200
    assert mock_client.cloud.baremetal.images.list.call_count == 2


# ---------------------------------------------------------------------------
# Different region_ids are cached separately
# ---------------------------------------------------------------------------

def test_different_regions_cached_separately(client):
    images_76 = [_make_image("img-76", "Ubuntu 22.04 region76")]
    images_99 = [_make_image("img-99", "Ubuntu 24.04 region99")]

    mock_client = MagicMock()
    mock_client.cloud.baremetal.images.list.side_effect = lambda region_id, project_id: (
        SimpleNamespace(results=images_76)
        if region_id == 76
        else SimpleNamespace(results=images_99)
    )

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        resp_76a = client.get("/api/images?region_id=76")
        resp_99a = client.get("/api/images?region_id=99")
        # Second hits should be cache hits (no new SDK call)
        resp_76b = client.get("/api/images?region_id=76")
        resp_99b = client.get("/api/images?region_id=99")

    assert resp_76a.status_code == 200
    assert resp_99a.status_code == 200
    # Each region caused exactly one SDK call — two total
    assert mock_client.cloud.baremetal.images.list.call_count == 2
    # Results are kept separate
    assert resp_76b.json()["images"][0]["name"] == "Ubuntu 22.04 region76"
    assert resp_99b.json()["images"][0]["name"] == "Ubuntu 24.04 region99"


# ---------------------------------------------------------------------------
# 502 on cloud error does NOT cache the (failed) result
# ---------------------------------------------------------------------------

def test_502_does_not_cache(client):
    from backend.services import image_cache

    mock_client = MagicMock()
    good_images = [_make_image("img-1", "Ubuntu 22.04")]
    # First call raises, second succeeds
    mock_client.cloud.baremetal.images.list.side_effect = [
        RuntimeError("transient error"),
        SimpleNamespace(results=good_images),
    ]

    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        resp_err = client.get("/api/images?region_id=76")
        # Nothing should be in cache after the error
        assert image_cache.get(309102, 76) is None
        resp_ok = client.get("/api/images?region_id=76")

    assert resp_err.status_code == 502
    assert resp_ok.status_code == 200
    assert len(resp_ok.json()["images"]) == 1
    # Cache populated after successful call
    assert image_cache.get(309102, 76) is not None


# ---------------------------------------------------------------------------
# get_client() raises BEFORE cloud call — capture state must not be dirty
# ---------------------------------------------------------------------------

def test_get_client_raises_returns_502_and_capture_state_clean(client):
    """If get_client() raises (before any cloud call), the router must return 502
    and leave capture state clean so a subsequent successful request still reports
    correct _dev.requests (i.e. capture is not permanently active or permanently
    stopped from the failed call).
    """
    good_images = [_make_image("img-1", "Ubuntu 22.04")]
    mock_client_ok = _make_mock_client(good_images)

    # Use the real start_capture/stop_capture so we can observe actual thread-local state.
    from backend.gcore_client import start_capture as real_start, stop_capture as real_stop

    get_client_calls = {"count": 0}

    def _get_client_side_effect():
        get_client_calls["count"] += 1
        if get_client_calls["count"] == 1:
            raise RuntimeError("SDK constructor failed")
        return mock_client_ok

    # Patch only get_client and get_settings; let capture run for real.
    with patch("backend.routers.images.get_settings", return_value=_fake_settings()), \
         patch("backend.routers.images.get_client", side_effect=_get_client_side_effect):

        resp_err = client.get("/api/images?region_id=76")
        assert resp_err.status_code == 502
        assert "Failed to fetch images" in resp_err.json()["detail"]

        # After the failed call, verify capture is not left active (active flag clean).
        from backend.gcore_client import _capture
        assert not getattr(_capture, "active", False), \
            "capture was left active after get_client() raised"

        # A subsequent successful request must work and report requests in _dev.
        resp_ok = client.get("/api/images?region_id=76")
        assert resp_ok.status_code == 200
        body = resp_ok.json()
        assert body["region_id"] == 76
        assert len(body["images"]) == 1
        # _dev.requests must be a list (capture completed cleanly for the good call).
        assert isinstance(body["_dev"]["requests"], list)


# ---------------------------------------------------------------------------
# Warm-up: fetch_images populates the cache when called directly
# ---------------------------------------------------------------------------

def test_warmup_populates_cache():
    from backend.services import image_cache
    from backend.routers.images import fetch_images

    good_images = [_make_image("img-w", "Ubuntu 22.04 warmup")]
    mock_client = _make_mock_client(good_images)

    with patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):

        imgs, _dev = fetch_images(309102, 76)
        image_cache.set(309102, 76, imgs)

    cached = image_cache.get(309102, 76)
    assert cached is not None
    assert cached[0]["name"] == "Ubuntu 22.04 warmup"


# ---------------------------------------------------------------------------
# Absence of API key / region does not crash the warm-up path
# ---------------------------------------------------------------------------

def test_missing_api_key_does_not_crash_startup():
    """Replicate the lifespan warm-up block and verify it never propagates."""
    import logging
    from backend.services import image_cache
    from backend.routers.images import fetch_images

    def _run_warmup(settings):
        try:
            region_id = getattr(settings.run_defaults, "region_id", None)
            if settings.project_id and region_id is not None and settings.cloud_api_key:
                project_id = int(settings.project_id)
                imgs, _ = fetch_images(project_id, region_id)
                image_cache.set(project_id, region_id, imgs)
        except Exception as exc:
            logging.getLogger(__name__).warning("warm-up failed: %s", exc)

    # No API key — condition is False, nothing called
    _run_warmup(_fake_settings(api_key="", region_id=76))  # must not raise

    # No region_id — condition is False
    _run_warmup(_fake_settings(api_key="test-key", region_id=None))  # must not raise

    # API key + region present but fetch raises — must not propagate
    mock_client = MagicMock()
    mock_client.cloud.baremetal.images.list.side_effect = RuntimeError("network down")

    with patch("backend.routers.images.get_client", return_value=mock_client), \
         patch("backend.routers.images.start_capture"), \
         patch("backend.routers.images.stop_capture", return_value=[]):
        _run_warmup(_fake_settings(api_key="test-key", region_id=76))  # must not raise

    # Cache must remain empty in all failure cases
    assert image_cache.get(309102, 76) is None
