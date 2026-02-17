"""
Garud-Drishti Automation Package

Provides SOC response actions such as:
- account locking
- endpoint isolation
- IP blocking

All actions default to safe dry-run mode.
"""

from .account_lock import lock_account
from .endpoint_isolation import isolate_endpoint
from .ip_blocker import block_ip

__all__ = [
    "lock_account",
    "isolate_endpoint",
    "block_ip",
]