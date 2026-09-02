"""
Tests for POST/GET /api/runs.
No real servers are created: provisioner.start_run is monkeypatched to a no-op.
A temp directory is used for run_store persistence so tests are isolated.
"""
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Minimal env so config.py doesn't raise on missing CLOUD_API_KEY
os.environ.setdefault("CLOUD_API_KEY", "test-key")
os.environ.setdefault("REPORTS_DIR", "/tmp/qa-web-app-test-reports")


@pytest.fixture()
def client(tmp_path):
    from backend import run_store as rs_module

    # Point the store at a fresh temp dir for each test
    store = rs_module.RunStore(tmp_path / "runs")

    with patch("backend.routers.runs.get_store", return_value=store), \
         patch("backend.provisioner.start_run", return_value=None):
        from backend.main import app
        with TestClient(app) as tc:
            yield tc


def test_post_run_creates_record(client):
    resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-999",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 2,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["run_id"]
    assert data["jira_task_id"] == "GCLOUD-999"
    assert data["status"] == "queued"
    assert len(data["servers"]) == 2


def test_get_runs_lists_created(client):
    client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-1",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    resp = client.get("/api/runs")
    assert resp.status_code == 200
    assert len(resp.json()["runs"]) == 1


def test_get_run_by_id(client):
    post_resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-2",
        "region_id": 2,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    run_id = post_resp.json()["run_id"]
    resp = client.get(f"/api/runs/{run_id}")
    assert resp.status_code == 200
    assert resp.json()["run_id"] == run_id


def test_get_run_missing_returns_404(client):
    resp = client.get("/api/runs/does-not-exist")
    assert resp.status_code == 404


def test_post_run_missing_field_returns_422(client):
    resp = client.post("/api/runs", json={"region_id": 1})
    assert resp.status_code == 422


def test_post_run_empty_jira_returns_422(client):
    resp = client.post("/api/runs", json={
        "jira_task_id": "",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    assert resp.status_code == 422


def test_post_run_rejects_unsafe_jira_task_id(client):
    resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-1; rm -rf /",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    assert resp.status_code == 422


def test_post_run_without_api_key_returns_503(tmp_path):
    from fastapi.testclient import TestClient
    from backend.main import app
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    with patch("backend.routers.runs.get_settings", side_effect=ValueError("CLOUD_API_KEY missing")), \
         patch("backend.routers.runs.get_store", return_value=store), \
         patch("backend.provisioner.start_run", return_value=None):
        tc = TestClient(app)
        resp = tc.post("/api/runs", json={
            "jira_task_id": "GCLOUD-1",
            "region_id": 1,
            "flavor_id": "bm1-hf-medium",
            "servers_count": 1,
        })

    assert resp.status_code == 503
    assert "CLOUD_API_KEY" in resp.json()["detail"]
    assert store.list_all() == []


def test_delete_done_run_returns_204(client):
    post_resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-10",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    run_id = post_resp.json()["run_id"]
    resp = client.delete(f"/api/runs/{run_id}")
    assert resp.status_code == 204
    assert resp.content == b""


def test_delete_running_run_returns_409(client, tmp_path):
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-11",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )
    store.update_run(record.run_id, status="running")

    with patch("backend.routers.runs.get_store", return_value=store), \
         patch("backend.provisioner.start_run", return_value=None):
        from backend.main import app
        with TestClient(app) as tc:
            resp = tc.delete(f"/api/runs/{record.run_id}")

    assert resp.status_code == 409


def test_delete_nonexistent_run_returns_404(client):
    resp = client.delete("/api/runs/does-not-exist")
    assert resp.status_code == 404


def test_delete_run_then_get_returns_404(client):
    post_resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-12",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    run_id = post_resp.json()["run_id"]
    client.delete(f"/api/runs/{run_id}")
    resp = client.get(f"/api/runs/{run_id}")
    assert resp.status_code == 404


def test_provisioner_marks_run_failed_when_any_server_fails(tmp_path):
    from types import SimpleNamespace
    from backend import provisioner
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-1",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=2,
    )

    def fake_provision_one(run_id, server_idx, *args, **kwargs):
        if server_idx == 1:
            store.update_server(run_id, server_idx, status="ready", ip_address="8.8.8.8")
        else:
            store.update_server(run_id, server_idx, status="failed", error="boom")

    settings = SimpleNamespace(project_id="309102", image_name="ubuntu", ssh_key_name="qa-key", max_workers=2)
    with patch("backend.provisioner.get_settings", return_value=settings), \
         patch("backend.provisioner._get_image_id", return_value="image-id"), \
         patch("backend.provisioner._provision_one", side_effect=fake_provision_one):
        provisioner.start_run(record.run_id, store)

    assert store.get(record.run_id).status == "failed"


# ---------------------------------------------------------------------------
# Cancel endpoint — PATCH /api/runs/{run_id}/cancel
# ---------------------------------------------------------------------------

def _make_running_client(tmp_path):
    """Helper: returns (TestClient, store, run_id) with the run already in 'running' state."""
    from backend import run_store as rs_module
    from backend.main import app

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-50",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=2,
    )
    store.update_run(record.run_id, status="running")

    ctx = patch("backend.routers.runs.get_store", return_value=store), \
          patch("backend.provisioner.start_run", return_value=None)
    return ctx, store, record.run_id


def test_cancel_running_run_returns_200(tmp_path):
    from backend import run_store as rs_module
    from backend.main import app

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-50",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )
    store.update_run(record.run_id, status="running")

    with patch("backend.routers.runs.get_store", return_value=store), \
         patch("backend.provisioner.start_run", return_value=None):
        with TestClient(app) as tc:
            resp = tc.patch(f"/api/runs/{record.run_id}/cancel")

    assert resp.status_code == 200
    data = resp.json()
    assert data["run_id"] == record.run_id
    assert data["cancelled"] is True
    assert store.get(record.run_id).cancelled is True


def test_cancel_nonexistent_run_returns_404(client):
    resp = client.patch("/api/runs/does-not-exist/cancel")
    assert resp.status_code == 404


def test_cancel_queued_run_returns_409(client):
    post_resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-51",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    run_id = post_resp.json()["run_id"]
    # Run is still 'queued' — cancel must be rejected
    resp = client.patch(f"/api/runs/{run_id}/cancel")
    assert resp.status_code == 409
    assert "queued" in resp.json()["detail"]


def test_cancel_done_run_returns_409(tmp_path):
    from backend import run_store as rs_module
    from backend.main import app

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-52",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )
    store.update_run(record.run_id, status="done")

    with patch("backend.routers.runs.get_store", return_value=store), \
         patch("backend.provisioner.start_run", return_value=None):
        with TestClient(app) as tc:
            resp = tc.patch(f"/api/runs/{record.run_id}/cancel")

    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# RunStore.cancel_run unit tests
# ---------------------------------------------------------------------------

def test_cancel_run_store_sets_cancelled_flag(tmp_path):
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-60",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )
    result = store.cancel_run(record.run_id)
    assert result is True
    assert store.get(record.run_id).cancelled is True


def test_cancel_run_store_persists_to_disk(tmp_path):
    from backend import run_store as rs_module

    runs_dir = tmp_path / "runs"
    store = rs_module.RunStore(runs_dir)
    record = store.create(
        jira_task_id="GCLOUD-61",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )
    store.cancel_run(record.run_id)

    # Re-load from disk in a fresh store instance
    store2 = rs_module.RunStore(runs_dir)
    assert store2.get(record.run_id).cancelled is True


def test_cancel_run_store_unknown_id_returns_false(tmp_path):
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    assert store.cancel_run("no-such-id") is False


# ---------------------------------------------------------------------------
# Provisioner: _provision_one skips server when run is cancelled
# ---------------------------------------------------------------------------

def test_provision_one_skips_when_cancelled(tmp_path):
    from unittest.mock import MagicMock
    from backend import provisioner
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-70",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )
    store.cancel_run(record.run_id)

    mock_client = MagicMock()
    with patch("backend.provisioner.get_client", return_value=mock_client):
        provisioner._provision_one(
            run_id=record.run_id,
            server_idx=1,
            jira_task_id=record.jira_task_id,
            region_id=record.region_id,
            flavor_id=record.flavor_id,
            project_id=309102,
            image_id="image-id",
            ssh_key_name="qa-key",
            store=store,
        )

    # No Gcore API call should have been made
    mock_client.cloud.baremetal.servers.create.assert_not_called()
    assert store.get(record.run_id).servers[0].status == "cancelled"


# ---------------------------------------------------------------------------
# Provisioner: start_run final status is "cancelled" when all servers skipped
# ---------------------------------------------------------------------------

def test_start_run_final_status_cancelled_when_all_skipped(tmp_path):
    from types import SimpleNamespace
    from backend import provisioner
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-80",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=2,
    )

    def fake_provision_one(run_id, server_idx, *args, **kwargs):
        store.update_server(run_id, server_idx, status="cancelled")

    settings = SimpleNamespace(
        project_id="309102",
        image_name="ubuntu",
        ssh_key_name="qa-key",
        max_workers=2,
    )
    with patch("backend.provisioner.get_settings", return_value=settings), \
         patch("backend.provisioner._get_image_id", return_value="image-id"), \
         patch("backend.provisioner._provision_one", side_effect=fake_provision_one):
        # Mark cancelled before start_run sets status to running
        store.cancel_run(record.run_id)
        store.update_run(record.run_id, status="running")
        provisioner.start_run(record.run_id, store)

    assert store.get(record.run_id).status == "cancelled"


def test_start_run_final_status_failed_when_mix_of_cancelled_and_failed(tmp_path):
    from types import SimpleNamespace
    from backend import provisioner
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-81",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=2,
    )

    def fake_provision_one(run_id, server_idx, *args, **kwargs):
        if server_idx == 1:
            store.update_server(run_id, server_idx, status="cancelled")
        else:
            store.update_server(run_id, server_idx, status="failed", error="boom")

    settings = SimpleNamespace(
        project_id="309102",
        image_name="ubuntu",
        ssh_key_name="qa-key",
        max_workers=2,
    )
    with patch("backend.provisioner.get_settings", return_value=settings), \
         patch("backend.provisioner._get_image_id", return_value="image-id"), \
         patch("backend.provisioner._provision_one", side_effect=fake_provision_one):
        store.cancel_run(record.run_id)
        store.update_run(record.run_id, status="running")
        provisioner.start_run(record.run_id, store)

    # Mix of cancelled+failed servers must resolve to "failed", not "cancelled".
    assert store.get(record.run_id).status == "failed"


# ---------------------------------------------------------------------------
# image_id field — TODO-3
# ---------------------------------------------------------------------------

def test_post_run_without_image_id_returns_null_image_id(client):
    resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-100",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "image_id" in data
    assert data["image_id"] is None


def test_post_run_with_image_id_stores_and_returns_it(client):
    resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-101",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
        "image_id": "img-abc-123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["image_id"] == "img-abc-123"


def test_get_run_preserves_image_id(client):
    post_resp = client.post("/api/runs", json={
        "jira_task_id": "GCLOUD-102",
        "region_id": 1,
        "flavor_id": "bm1-hf-medium",
        "servers_count": 1,
        "image_id": "img-xyz-999",
    })
    run_id = post_resp.json()["run_id"]
    resp = client.get(f"/api/runs/{run_id}")
    assert resp.status_code == 200
    assert resp.json()["image_id"] == "img-xyz-999"


def test_run_store_image_id_survives_disk_roundtrip(tmp_path):
    from backend import run_store as rs_module

    runs_dir = tmp_path / "runs"
    store = rs_module.RunStore(runs_dir)
    record = store.create(
        jira_task_id="GCLOUD-103",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
        image_id="img-persisted-001",
    )

    store2 = rs_module.RunStore(runs_dir)
    loaded = store2.get(record.run_id)
    assert loaded is not None
    assert loaded.image_id == "img-persisted-001"


def test_run_store_no_image_id_survives_disk_roundtrip(tmp_path):
    from backend import run_store as rs_module

    runs_dir = tmp_path / "runs"
    store = rs_module.RunStore(runs_dir)
    record = store.create(
        jira_task_id="GCLOUD-104",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )

    store2 = rs_module.RunStore(runs_dir)
    loaded = store2.get(record.run_id)
    assert loaded is not None
    assert loaded.image_id is None


def test_provisioner_uses_record_image_id_and_skips_lookup(tmp_path):
    """When record.image_id is set, _get_image_id must not be called."""
    from types import SimpleNamespace
    from unittest.mock import MagicMock
    from backend import provisioner
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-105",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
        image_id="img-direct-456",
    )

    captured = {}

    def fake_provision_one(run_id, server_idx, *args, **kwargs):
        captured["image_id"] = kwargs.get("image_id") or (args[5] if len(args) > 5 else None)
        store.update_server(run_id, server_idx, status="ready", ip_address="1.2.3.4")

    settings = SimpleNamespace(project_id="309102", image_name="ubuntu", ssh_key_name="qa-key", max_workers=1)
    mock_get_image = MagicMock(side_effect=AssertionError("_get_image_id must not be called when image_id is set"))

    with patch("backend.provisioner.get_settings", return_value=settings), \
         patch("backend.provisioner._get_image_id", mock_get_image), \
         patch("backend.provisioner._provision_one", side_effect=fake_provision_one):
        provisioner.start_run(record.run_id, store)

    mock_get_image.assert_not_called()


def test_provisioner_falls_back_to_image_lookup_when_no_image_id(tmp_path):
    """When record.image_id is None, _get_image_id must be called."""
    from types import SimpleNamespace
    from unittest.mock import MagicMock
    from backend import provisioner
    from backend import run_store as rs_module

    store = rs_module.RunStore(tmp_path / "runs")
    record = store.create(
        jira_task_id="GCLOUD-106",
        region_id=1,
        flavor_id="bm1-hf-medium",
        servers_count=1,
    )

    assert record.image_id is None

    def fake_provision_one(run_id, server_idx, *args, **kwargs):
        store.update_server(run_id, server_idx, status="ready", ip_address="1.2.3.4")

    settings = SimpleNamespace(project_id="309102", image_name="ubuntu", ssh_key_name="qa-key", max_workers=1)

    with patch("backend.provisioner.get_settings", return_value=settings), \
         patch("backend.provisioner._get_image_id", return_value="img-looked-up") as mock_lookup, \
         patch("backend.provisioner._provision_one", side_effect=fake_provision_one):
        provisioner.start_run(record.run_id, store)

    mock_lookup.assert_called_once_with(1, 309102, "ubuntu")
