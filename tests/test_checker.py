"""
Unit tests for backend/services/checker.py.

Coverage:
  - _exec: stdout path, exception path
  - _check_console: success path, exception path
  - check_server / _do_check_server: happy path, SSH failure, partial command
    failure, SFTP failure, never-raises guarantee, store field completeness.

No real SSH, no real HTTP, no real sleeps.
"""
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, call

import pytest

# Must be set before any backend import; config.py reads this at module level.
os.environ.setdefault("CLOUD_API_KEY", "test-key")

from backend.services.checker import _exec, _check_console, check_server


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_settings():
    return SimpleNamespace(
        ssh_key_path="/fake/key",
        base_url="https://api.example.com",
        cloud_api_key="test-key",
    )


def _make_store():
    store = MagicMock()
    store.update_server = MagicMock()
    return store


def _make_ssh_mock(stdout_side_effect=None):
    """Return a mock SSHClient where exec_command returns (None, stdout_mock, None)."""
    ssh = MagicMock()
    if stdout_side_effect is None:
        stdout_mock = MagicMock()
        stdout_mock.read.return_value = b"some output"
        ssh.exec_command.return_value = (None, stdout_mock, None)
    else:
        ssh.exec_command.side_effect = stdout_side_effect
    return ssh


# ---------------------------------------------------------------------------
# _exec tests
# ---------------------------------------------------------------------------

class TestExec:

    def test_exec_returns_stdout(self):
        """Happy path: exec_command returns bytes; _exec decodes and strips."""
        stdout_mock = MagicMock()
        stdout_mock.read.return_value = b"  hello world  "
        ssh = MagicMock()
        ssh.exec_command.return_value = (None, stdout_mock, None)

        result = _exec(ssh, "echo hello")

        assert result == "hello world"
        ssh.exec_command.assert_called_once_with("echo hello", timeout=120)

    def test_exec_on_exception_returns_error_string(self):
        """If exec_command raises, _exec must return 'error: ...' and not propagate."""
        ssh = MagicMock()
        ssh.exec_command.side_effect = RuntimeError("channel broken")

        result = _exec(ssh, "ls")

        assert result.startswith("error: ")
        assert "channel broken" in result


# ---------------------------------------------------------------------------
# _check_console tests
# ---------------------------------------------------------------------------

class TestCheckConsole:

    def test_check_console_success(self):
        """HTTP 200 with body → '<status_code> <body>'."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"ok":true}'

        with patch("backend.services.checker.requests.get", return_value=mock_resp) as mock_get:
            result = _check_console(
                base_url="https://api.example.com",
                project_id=1,
                region_id=2,
                instance_id="inst-abc",
                cloud_api_key="test-key",
            )

        assert result == '200 {"ok":true}'
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        assert "APIKey test-key" in call_kwargs.kwargs["headers"]["Authorization"]
        assert "inst-abc" in call_kwargs.args[0]

    def test_check_console_exception(self):
        """If requests.get raises, result must start with 'error: '."""
        with patch("backend.services.checker.requests.get", side_effect=ConnectionError("timeout")):
            result = _check_console(
                base_url="https://api.example.com",
                project_id=1,
                region_id=2,
                instance_id="inst-abc",
                cloud_api_key="test-key",
            )

        assert result.startswith("error: ")
        assert "timeout" in result


# ---------------------------------------------------------------------------
# check_server / _do_check_server tests
# ---------------------------------------------------------------------------

class TestCheckServer:

    # Shared call args for convenience
    _CALL = dict(
        run_id="run-1",
        server_idx=0,
        ip_address="1.2.3.4",
        instance_id="inst-xyz",
        region_id=2,
        project_id=99,
    )

    def _make_stdout_sequence(self, outputs):
        """
        Returns a list of side_effect values for exec_command.
        Each item in outputs is either a bytes value (success) or an Exception instance.
        """
        effects = []
        for item in outputs:
            if isinstance(item, Exception):
                effects.append(item)
            else:
                stdout_mock = MagicMock()
                stdout_mock.read.return_value = item
                effects.append((None, stdout_mock, None))
        return effects

    def test_check_server_happy_path(self):
        """
        SSH connects; each exec_command call returns a distinct value.
        CPU raw contains ':'; post-processing must strip the part after last ':'.
        store.update_server called with all 7 checker fields at correct values.
        """
        # Six commands: cpu, ram, disk, disk_count, ping, speed
        cmd_outputs = [
            b"model name\t: Intel Xeon Gold",   # cpu_raw — colon present
            b"  64G  ",                           # ram
            b"sda  disk",                         # disk
            b"2",                                 # disk_count
            b"rtt min/avg/max = 1.0/2.0/3.0",    # ping
            b"Download: 100 Mbit/s\nUpload: 50 Mbit/s",  # speed
        ]
        side_effects = self._make_stdout_sequence(cmd_outputs)

        mock_ssh = MagicMock()
        mock_ssh.exec_command.side_effect = side_effects

        mock_sftp = MagicMock()
        mock_ssh.open_sftp.return_value = mock_sftp

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"console":"ok"}'

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_ssh), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        store.update_server.assert_called_once_with(
            "run-1",
            0,
            cpu="Intel Xeon Gold",
            ram="64G",
            disk="sda  disk",
            disk_count="2",
            console_ok='200 {"console":"ok"}',
            ping="rtt min/avg/max = 1.0/2.0/3.0",
            speed="Download: 100 Mbit/s\nUpload: 50 Mbit/s",
        )

    def test_check_server_ssh_connect_fails(self):
        """
        _connect_ssh raises on all 10 retries.
        SSH fields must all contain 'error: SSH connect failed'.
        Console check must still be attempted via HTTP.
        """
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "console-data"

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient") as mock_cls, \
             patch("backend.services.checker.requests.get", return_value=mock_resp):

            mock_client = MagicMock()
            mock_client.connect.side_effect = OSError("Connection refused")
            mock_cls.return_value = mock_client

            check_server(**self._CALL, store=store, settings=settings)

        # Two update_server calls expected: one for SSH fields, one for console
        assert store.update_server.call_count == 2

        ssh_call = store.update_server.call_args_list[0]
        for field in ("cpu", "ram", "disk", "disk_count", "ping", "speed"):
            val = ssh_call.kwargs[field]
            assert "error: SSH connect failed" in val, \
                f"Field '{field}' expected 'error: SSH connect failed', got: {val!r}"

        console_call = store.update_server.call_args_list[1]
        assert "200 console-data" == console_call.kwargs["console_ok"]

    def test_check_server_partial_results_on_command_failure(self):
        """
        SSH connects; second exec_command (ram) raises.
        cpu must have a real value; ram must contain 'error: '.
        Remaining checks (disk, disk_count, ping, speed) must still execute.
        """
        ram_error = RuntimeError("channel closed")

        outputs = [
            b"model name\t: AMD EPYC",        # cpu — success
            ram_error,                          # ram — raises
            b"nvme0  disk",                     # disk — success
            b"3",                               # disk_count
            b"ping ok",                         # ping
            b"Download: 200",                   # speed
        ]
        side_effects = self._make_stdout_sequence(outputs)

        mock_ssh = MagicMock()
        mock_ssh.exec_command.side_effect = side_effects
        mock_ssh.open_sftp.return_value = MagicMock()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "console"

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_ssh), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        kwargs = store.update_server.call_args.kwargs
        assert "AMD EPYC" == kwargs["cpu"]
        assert kwargs["ram"].startswith("error: ")
        # Remaining fields must have real values (not errors from the ram failure)
        assert kwargs["disk"] == "nvme0  disk"
        assert kwargs["disk_count"] == "3"
        assert kwargs["ping"] == "ping ok"
        assert kwargs["speed"] == "Download: 200"

    def test_check_server_never_raises(self):
        """
        Everything explodes — SSH, every exec_command, requests.get.
        check_server must swallow all exceptions and return normally.
        """
        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file",
                   side_effect=Exception("key load fail")), \
             patch("backend.services.checker.requests.get",
                   side_effect=Exception("network gone")):
            # Must not raise
            check_server(**self._CALL, store=store, settings=settings)

    def test_check_server_sftp_failure_non_fatal(self):
        """
        open_sftp() raises. CPU/RAM/disk/ping/speed checks must still run.
        store.update_server must be called with non-error cpu value.
        """
        outputs = [
            b"model name\t: Intel Core",
            b"16G",
            b"sda disk",
            b"1",
            b"ping result",
            b"Download: 50",
        ]
        side_effects = self._make_stdout_sequence(outputs)

        mock_ssh = MagicMock()
        mock_ssh.exec_command.side_effect = side_effects
        mock_ssh.open_sftp.side_effect = PermissionError("sftp denied")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "ok"

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_ssh), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        kwargs = store.update_server.call_args.kwargs
        assert kwargs["cpu"] == "Intel Core"
        assert not kwargs["cpu"].startswith("error:")
        assert kwargs["ram"] == "16G"
        assert kwargs["speed"] == "Download: 50"

    def test_check_server_updates_store(self):
        """
        Happy path — assert store.update_server is called with all 7 checker
        fields: cpu, ram, disk, disk_count, console_ok, ping, speed.
        """
        outputs = [
            b"model name\t: Test CPU: v2",
            b"128G",
            b"xvda",
            b"4",
            b"ping stats",
            b"Download: 300 Upload: 150",
        ]
        side_effects = self._make_stdout_sequence(outputs)

        mock_ssh = MagicMock()
        mock_ssh.exec_command.side_effect = side_effects
        mock_ssh.open_sftp.return_value = MagicMock()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"result":"ok"}'

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_ssh), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        assert store.update_server.call_count == 1
        kwargs = store.update_server.call_args.kwargs
        required_fields = {"cpu", "ram", "disk", "disk_count", "console_ok", "ping", "speed"}
        missing = required_fields - set(kwargs.keys())
        assert not missing, f"update_server missing fields: {missing}"

    def test_check_server_cpu_colon_postprocessing(self):
        """
        CPU raw string containing ':' must be split on ':' and last part stripped.
        CPU raw string without ':' must be returned as-is (stripped).
        """
        # Test colon present
        outputs_with_colon = [
            b"model name\t: Intel Xeon E5-2690",
            b"32G",
            b"sda",
            b"1",
            b"ping",
            b"Download: 10",
        ]
        side_effects = self._make_stdout_sequence(outputs_with_colon)
        mock_ssh = MagicMock()
        mock_ssh.exec_command.side_effect = side_effects
        mock_ssh.open_sftp.return_value = MagicMock()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "ok"

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_ssh), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        kwargs = store.update_server.call_args.kwargs
        assert kwargs["cpu"] == "Intel Xeon E5-2690"

    def test_check_server_cpu_no_colon_returned_as_is(self):
        """CPU raw without ':' is returned stripped, not split."""
        outputs = [
            b"  SomeCPUNoColon  ",
            b"8G",
            b"sda",
            b"1",
            b"ping",
            b"Download: 5",
        ]
        side_effects = self._make_stdout_sequence(outputs)
        mock_ssh = MagicMock()
        mock_ssh.exec_command.side_effect = side_effects
        mock_ssh.open_sftp.return_value = MagicMock()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "ok"

        store = _make_store()
        settings = _make_settings()

        with patch("backend.services.checker.time.sleep"), \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_ssh), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        kwargs = store.update_server.call_args.kwargs
        assert kwargs["cpu"] == "SomeCPUNoColon"

    def test_check_console_url_format(self):
        """
        Console URL must follow the exact pattern:
        {base_url}/cloud/v1/instances/{project_id}/{region_id}/{instance_id}/get_console
        """
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "data"

        with patch("backend.services.checker.requests.get", return_value=mock_resp) as mock_get:
            _check_console(
                base_url="https://api.example.com",
                project_id=77,
                region_id=3,
                instance_id="inst-999",
                cloud_api_key="mykey",
            )

        called_url = mock_get.call_args.args[0]
        assert called_url == "https://api.example.com/cloud/v1/instances/77/3/inst-999/get_console"

    def test_check_server_ssh_retry_count(self):
        """
        _connect_ssh retries exactly 10 times. time.sleep must be called 9 times
        (not on the last attempt) and client.connect exactly 10 times.
        """
        store = _make_store()
        settings = _make_settings()

        mock_client = MagicMock()
        mock_client.connect.side_effect = OSError("refused")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "ok"

        with patch("backend.services.checker.time.sleep") as mock_sleep, \
             patch("backend.services.checker.paramiko.RSAKey.from_private_key_file", return_value=MagicMock()), \
             patch("backend.services.checker.paramiko.SSHClient", return_value=mock_client), \
             patch("backend.services.checker.requests.get", return_value=mock_resp):
            check_server(**self._CALL, store=store, settings=settings)

        assert mock_client.connect.call_count == 10
        assert mock_sleep.call_count == 9
