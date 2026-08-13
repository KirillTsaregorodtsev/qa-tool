"""
Tests for GET /api/reports, GET /api/reports/{filename}/download, and reporter.write_report.
No real provisioning; reporter is called directly against tmp_path.
"""
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("CLOUD_API_KEY", "test-key")


@pytest.fixture()
def reports_dir(tmp_path):
    d = tmp_path / "reports"
    d.mkdir()
    return d


@pytest.fixture()
def client(reports_dir):
    with patch("backend.routers.reports._reports_dir", return_value=reports_dir):
        from backend.main import app
        with TestClient(app) as tc:
            yield tc


# ─── reporter unit tests ──────────────────────────────────────────────────────

def test_write_report_creates_file(tmp_path):
    from backend.run_store import RunRecord, ServerRecord
    from backend.services.reporter import write_report

    record = RunRecord(
        run_id="r1",
        jira_task_id="GCLOUD-1",
        region_id=1,
        flavor_id="bm1",
        servers_count=2,
        status="done",
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:01:00+00:00",
        servers=[
            ServerRecord(index=1, instance_id="inst-aaa", ip_address="1.2.3.4", status="ready"),
            ServerRecord(index=2, instance_id="inst-bbb", ip_address="5.6.7.8", status="ready"),
        ],
    )
    out = write_report(record, str(tmp_path))
    assert out.exists()
    assert out.name.startswith("GCLOUD-1_")
    assert out.suffix == ".csv"


def test_write_report_csv_content(tmp_path):
    from backend.run_store import RunRecord, ServerRecord
    from backend.services.reporter import write_report
    import csv

    record = RunRecord(
        run_id="r2",
        jira_task_id="GCLOUD-2",
        region_id=1,
        flavor_id="bm1",
        servers_count=1,
        status="done",
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:01:00+00:00",
        servers=[
            ServerRecord(index=1, instance_id="inst-xyz", ip_address="9.9.9.9", status="ready"),
        ],
    )
    out = write_report(record, str(tmp_path))
    rows = list(csv.DictReader(out.open()))
    assert len(rows) == 1
    assert rows[0]["Server ID"] == "1"
    assert rows[0]["Instance ID"] == "inst-xyz"
    assert rows[0]["IP Address"] == "9.9.9.9"
    # Checker fields are blank until checker slice
    assert rows[0]["CPU"] == ""
    assert rows[0]["Speed"] == ""


def test_write_report_creates_reports_dir(tmp_path):
    from backend.run_store import RunRecord, ServerRecord
    from backend.services.reporter import write_report

    target = tmp_path / "deep" / "nested"
    record = RunRecord(
        run_id="r3",
        jira_task_id="GCLOUD-3",
        region_id=1,
        flavor_id="bm1",
        servers_count=0,
        status="failed",
        created_at="2026-01-01T00:00:00+00:00",
        updated_at="2026-01-01T00:01:00+00:00",
        servers=[],
    )
    out = write_report(record, str(target))
    assert out.exists()


# ─── GET /api/reports ─────────────────────────────────────────────────────────

def test_list_reports_empty(client):
    resp = client.get("/api/reports")
    assert resp.status_code == 200
    assert resp.json() == {"reports": []}


def test_list_reports_returns_files(client, reports_dir):
    (reports_dir / "GCLOUD-1_20260101_000000.csv").write_text("header\n")
    (reports_dir / "GCLOUD-2_20260102_000000.csv").write_text("header\n")
    resp = client.get("/api/reports")
    assert resp.status_code == 200
    names = [r["filename"] for r in resp.json()["reports"]]
    assert "GCLOUD-1_20260101_000000.csv" in names
    assert "GCLOUD-2_20260102_000000.csv" in names


def test_list_reports_fields(client, reports_dir):
    (reports_dir / "GCLOUD-3_20260103_000000.csv").write_text("a,b\n1,2\n")
    resp = client.get("/api/reports")
    r = resp.json()["reports"][0]
    assert "filename" in r
    assert "size_bytes" in r
    assert "created_at" in r


# ─── GET /api/reports/{filename}/download ────────────────────────────────────

def test_download_report_ok(client, reports_dir):
    (reports_dir / "GCLOUD-4_20260104_000000.csv").write_text("col\nval\n")
    resp = client.get("/api/reports/GCLOUD-4_20260104_000000.csv/download")
    assert resp.status_code == 200
    assert "col" in resp.text


def test_download_report_not_found(client):
    resp = client.get("/api/reports/GCLOUD-99_20260101_000000.csv/download")
    assert resp.status_code == 404


def test_download_report_path_traversal_dotdot(client):
    # %2F is decoded by Starlette before routing; the extra path segments break
    # the route match, so Starlette returns 404 — the file is never served.
    resp = client.get("/api/reports/..%2F..%2Fetc%2Fpasswd/download")
    assert resp.status_code in (400, 404, 422)


def test_download_report_invalid_filename(client):
    resp = client.get("/api/reports/bad;name.csv/download")
    assert resp.status_code in (400, 422)


def test_download_report_no_extension(client):
    resp = client.get("/api/reports/noextension/download")
    assert resp.status_code == 400
