"""
Unit tests for _get_public_ipv4 in backend/provisioner.py.

Regression coverage for bug B-2: the old implementation used
    getattr(addr, 'version', None) == 4
which always returned False because the Gcore SDK address objects carry no
'version' attribute.  The fixed implementation parses addr.addr with
ipaddress.ip_address() and checks ip.version instead.

Address objects are mocked with SimpleNamespace so no Gcore SDK import is needed.
"""
import ipaddress
from types import SimpleNamespace

import pytest

# Env guard: config.py requires CLOUD_API_KEY at import time.
import os
os.environ.setdefault("CLOUD_API_KEY", "test-key")

from backend.provisioner import _get_public_ipv4


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_addr(addr_str: str) -> SimpleNamespace:
    """Minimal address object — only .addr is present, matching real SDK shape."""
    return SimpleNamespace(addr=addr_str)


def _make_instance(addresses: dict, instance_id: str = "test-instance-id") -> SimpleNamespace:
    """Minimal instance object with .addresses dict and .id for error messages."""
    return SimpleNamespace(addresses=addresses, id=instance_id)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGetPublicIPv4:

    def test_happy_path_exact_real_api_structure(self):
        """
        Reproduces the exact address structure from Gcore BM instance
        792e40ae-49c8-431d-aaf7-145b469cf329.  No 'version' field on the
        address object — the fix must derive version from ipaddress parsing.
        """
        addr = SimpleNamespace(
            addr="78.111.100.41",
            interface_name=None,
            subnet_id="2dab369f-d671-431f-b69a-9c441edb6b13",
            subnet_name="pub_net4",
            type="fixed",
        )
        instance = _make_instance({"pub_net": [addr]}, instance_id="792e40ae-49c8-431d-aaf7-145b469cf329")

        result = _get_public_ipv4(instance)

        assert result == "78.111.100.41"

    def test_private_ip_only_raises(self):
        """Single private address must raise ValueError — no public IPv4 available."""
        instance = _make_instance({"pub_net": [_make_addr("192.168.1.1")]})

        with pytest.raises(ValueError, match="No public IPv4 found"):
            _get_public_ipv4(instance)

    def test_ipv6_only_raises(self):
        """IPv6-only instance must raise ValueError."""
        instance = _make_instance({"pub_net": [_make_addr("2001:db8::1")]})

        with pytest.raises(ValueError, match="No public IPv4 found"):
            _get_public_ipv4(instance)

    def test_empty_addresses_raises(self):
        """Empty addresses dict must raise ValueError."""
        instance = _make_instance({})

        with pytest.raises(ValueError, match="No public IPv4 found"):
            _get_public_ipv4(instance)

    def test_none_addr_does_not_crash(self):
        """addr.addr = None must raise ValueError cleanly, not TypeError."""
        instance = _make_instance({"pub_net": [SimpleNamespace(addr=None)]})

        with pytest.raises(ValueError, match="No public IPv4 found"):
            _get_public_ipv4(instance)

    def test_mixed_private_and_public_returns_public(self):
        """When both a private and a public address are present, the public one is returned."""
        instance = _make_instance({
            "pub_net": [
                _make_addr("10.0.0.5"),       # private — must be skipped
                _make_addr("78.111.100.41"),   # public  — must be returned
            ]
        })

        result = _get_public_ipv4(instance)

        assert result == "78.111.100.41"
