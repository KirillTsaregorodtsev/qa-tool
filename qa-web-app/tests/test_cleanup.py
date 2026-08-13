"""
Tests for DELETE /api/runs/{run_id}/instances.
Gcore client and settings are mocked; no real API calls are made.
"""
import os
import tempfile
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("CLOUD_API_KEY", "test-key")
os.environ.setdefault("REPORTS_DIR", "/tmp/qa-web-app-test-reports")


def _make_mock_client():
    """Return a mock Gcore client whose cloud.instances.delete is a MagicMock."""
    mock_client = MagicMock()
    mock_client.cloud.instances.delete = MagicMock(return_value=None)
    return mock_client


def _fake_settings():
    return SimpleNamespace(
        cloud_api_key="test-key",
        project_id="309102",
        reports_dir="/tmp/qa-web-app-test-reports",
        base_url="https://api.gcore.com",
        max_workers=2,
        image_name="ubuntu",
        ssh_key_name="qa-key",
        config_dir="/tmp",
    )


@pytest.fixture()
def client(tmp_path):
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")

    with patch("backend.routers.runs.get_store", return_value=store), \
         patch("backend.routers.cleanup.get_store", return_value=store), \
         patch("backend.provisioner.start_run", return_value=None):
        from backend.main import app
        with TestClient(app) as tc:
            yield tc, store


def _create_run(client, servers_count=2):
    resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-1",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": servers_count,
    })
    assert resp.status_code == 201
    return resp.json()["run_id"]


# ---------------------------------------------------------------------------
# 404 — run not found
# ---------------------------------------------------------------------------

def test_delete_instances_run_not_found(client):
    tc, store = client
    resp = tc.delete("/api/runs/nonexistent-run-id/instances")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 409 — run is still running
# ---------------------------------------------------------------------------

def test_delete_instances_run_running_returns_409(client):
    tc, store = client
    run_id = _create_run(tc)
    store.update_run(run_id, status="running")

    resp = tc.delete(f"/api/runs/{run_id}/instances")
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Happy path — all servers have instance_ids, all deletes succeed
# ---------------------------------------------------------------------------

def test_delete_instances_success(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=2)

    # Simulate servers that were provisioned
    store.update_server(run_id, 1, instance_id="inst-aaa", status="ready")
    store.update_server(run_id, 2, instance_id="inst-bbb", status="ready")
    store.update_run(run_id, status="done")

    mock_client = _make_mock_client()

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.delete(f"/api/runs/{run_id}/instances")

    assert resp.status_code == 200
    data = resp.json()
    assert data["run_id"] == run_id
    assert data["deleted"] == 2
    assert data["failed"] == 0

    # Verify store was updated
    record = store.get(run_id)
    assert record.status == "cleaned"
    for server in record.servers:
        assert server.status == "deleted"

    # Verify API was called for each instance
    assert mock_client.cloud.instances.delete.call_count == 2


# ---------------------------------------------------------------------------
# Partial failure — one delete fails, loop continues
# ---------------------------------------------------------------------------

def test_delete_instances_partial_failure(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=2)

    store.update_server(run_id, 1, instance_id="inst-aaa", status="ready")
    store.update_server(run_id, 2, instance_id="inst-bbb", status="ready")
    store.update_run(run_id, status="done")

    mock_client = _make_mock_client()
    # First call succeeds, second raises
    mock_client.cloud.instances.delete.side_effect = [
        None,
        RuntimeError("API error"),
    ]

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.delete(f"/api/runs/{run_id}/instances")

    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] == 1
    assert data["failed"] == 1

    # Run status should still be cleaned even if some failed
    assert store.get(run_id).status == "cleaned"


# ---------------------------------------------------------------------------
# Servers with no instance_id are skipped
# ---------------------------------------------------------------------------

def test_delete_instances_skips_servers_without_instance_id(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=2)

    # server 1 has no instance_id (provisioning never completed)
    store.update_server(run_id, 2, instance_id="inst-bbb", status="ready")
    store.update_run(run_id, status="failed")

    mock_client = _make_mock_client()

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.delete(f"/api/runs/{run_id}/instances")

    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] == 1
    assert data["failed"] == 0
    assert mock_client.cloud.instances.delete.call_count == 1


# ---------------------------------------------------------------------------
# Servers already in "deleted" status are counted as deleted, not re-called
# ---------------------------------------------------------------------------

def test_delete_instances_already_deleted_servers_counted(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=2)

    store.update_server(run_id, 1, instance_id="inst-aaa", status="deleted")
    store.update_server(run_id, 2, instance_id="inst-bbb", status="ready")
    store.update_run(run_id, status="done")

    mock_client = _make_mock_client()

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.delete(f"/api/runs/{run_id}/instances")

    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] == 2  # 1 already deleted + 1 newly deleted
    assert data["failed"] == 0
    # Only one actual API call (the already-deleted one is skipped)
    assert mock_client.cloud.instances.delete.call_count == 1


# ---------------------------------------------------------------------------
# Settings misconfigured (no API key) returns 503
# ---------------------------------------------------------------------------

def test_delete_instances_no_settings_returns_503(client):
    tc, store = client
    run_id = _create_run(tc)
    store.update_run(run_id, status="done")

    with patch(
        "backend.routers.cleanup.get_settings",
        side_effect=ValueError("CLOUD_API_KEY missing"),
    ):
        resp = tc.delete(f"/api/runs/{run_id}/instances")

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Delete calls pass correct region_id and project_id to the SDK
# ---------------------------------------------------------------------------

def test_delete_instances_passes_correct_ids(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=1)

    store.update_server(run_id, 1, instance_id="inst-xyz", status="ready")
    store.update_run(run_id, status="done")

    mock_client = _make_mock_client()
    settings = _fake_settings()  # project_id="309102"

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=settings):
        resp = tc.delete(f"/api/runs/{run_id}/instances")

    assert resp.status_code == 200
    mock_client.cloud.instances.delete.assert_called_once_with(
        instance_id="inst-xyz",
        region_id=1,          # region_id from StartRunRequest
        project_id=309102,    # project_id from settings
    )


# ---------------------------------------------------------------------------
# POST /api/runs/{run_id}/instances/refresh
# ---------------------------------------------------------------------------

def _make_mock_client_with_instance(status: str):
    """Return a mock Gcore client whose cloud.instances.get returns an instance with given status."""
    mock_client = MagicMock()
    instance = SimpleNamespace(status=status)
    mock_client.cloud.instances.get = MagicMock(return_value=instance)
    return mock_client


def test_refresh_instances_active_updates_status(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=1)
    store.update_server(run_id, 1, instance_id="inst-aaa", status="ready")
    store.update_run(run_id, status="done")

    mock_client = _make_mock_client_with_instance("ACTIVE")

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.post(f"/api/runs/{run_id}/instances/refresh")

    assert resp.status_code == 200
    data = resp.json()
    assert data["run_id"] == run_id
    servers = {s["index"]: s for s in data["servers"]}
    assert servers[1]["status"] == "active"

    mock_client.cloud.instances.get.assert_called_once_with(
        instance_id="inst-aaa",
        region_id=1,
        project_id=309102,
    )


def test_refresh_instances_gcore_404_marks_deleted(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=1)
    store.update_server(run_id, 1, instance_id="inst-gone", status="ready")
    store.update_run(run_id, status="done")

    mock_client = MagicMock()
    mock_client.cloud.instances.get.side_effect = RuntimeError(
        "404 Not Found: instance not found"
    )

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.post(f"/api/runs/{run_id}/instances/refresh")

    assert resp.status_code == 200
    data = resp.json()
    servers = {s["index"]: s for s in data["servers"]}
    assert servers[1]["status"] == "deleted"


def test_refresh_instances_run_not_found(client):
    tc, store = client
    resp = tc.post("/api/runs/nonexistent-run-id/instances/refresh")
    assert resp.status_code == 404


def test_refresh_instances_skips_server_without_instance_id(client):
    tc, store = client
    run_id = _create_run(tc, servers_count=2)
    # server 1 has no instance_id, server 2 has one
    store.update_server(run_id, 2, instance_id="inst-bbb", status="ready")
    store.update_run(run_id, status="done")

    mock_client = _make_mock_client_with_instance("SHUTOFF")

    with patch("backend.routers.cleanup.get_client", return_value=mock_client), \
         patch("backend.routers.cleanup.get_settings", return_value=_fake_settings()):
        resp = tc.post(f"/api/runs/{run_id}/instances/refresh")

    assert resp.status_code == 200
    data = resp.json()
    servers = {s["index"]: s for s in data["servers"]}
    # server 1 skipped — status unchanged (pending)
    assert servers[1]["status"] == "pending"
    # server 2 updated
    assert servers[2]["status"] == "shutoff"
    # get called only once (for server 2)
    assert mock_client.cloud.instances.get.call_count == 1
