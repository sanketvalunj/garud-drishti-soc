"""
Garud-Drishti SOC — Schema Mapper
==================================
Maps parsed log dictionaries to the unified SOC event schema.
Ensures every event has a consistent structure for Elasticsearch
indexing and API querying.
"""

import uuid
import hashlib
from datetime import datetime
from typing import Dict, Optional


# ─────────────────────────────────────────────
# UNIFIED SOC EVENT SCHEMA
# ─────────────────────────────────────────────
#
# Fields:
#   event_id       - Unique UUID
#   timestamp      - ISO 8601 datetime
#   user           - Employee ID
#   device         - Device identifier
#   asset          - Server/DB/resource accessed
#   ip             - Source IP address
#   event_type     - Specific event name
#   source         - Telemetry source (IAM/EDR/FIREWALL/APP)
#   severity       - low/medium/high/critical
#   event_category - authentication/endpoint/network/data_access
#   session_id     - Session identifier
#   risk_flag      - normal/suspicious/high
# ─────────────────────────────────────────────


class SchemaMapper:
    """
    Maps heterogeneous parsed log data to a strict
    normalized SOC event schema.
    """

    # Event type normalization aliases
    EVENT_ALIASES = {
        "login_failed": ["failed_login", "login_fail", "auth_failure", "authentication_failed"],
        "login_success": ["auth_success", "login_ok", "authentication_success"],
        "password_change": ["passwd_change", "password_reset", "pwd_change"],
        "account_locked": ["lockout", "account_lockout", "user_locked"],
        "mfa_attempt": ["2fa_attempt", "mfa_challenge", "multi_factor"],
        "process_start": ["proc_start", "new_process", "process_create"],
        "file_access": ["file_read", "open_file", "file_open"],
        "privilege_escalation": ["sudo", "admin_access", "priv_esc", "elevation"],
        "script_execution": ["script_run", "script_exec"],
        "malware_detected": ["malware_found", "virus_detected", "threat_detected"],
        "connection_attempt": ["connect", "connection", "conn_attempt"],
        "blocked_ip": ["ip_blocked", "block", "deny"],
        "port_scan": ["scan", "port_scanning", "nmap"],
        "external_transfer": ["data_transfer", "outbound_transfer", "exfil"],
        "database_query": ["db_query", "sql_query", "query"],
        "data_access": ["data_read", "record_access"],
        "file_download": ["download", "file_dl"],
        "data_export": ["export", "data_exfil", "bulk_export"],
    }

    # Severity scoring
    SEVERITY_MAP = {
        "login_failed": "medium",
        "account_locked": "high",
        "privilege_escalation": "high",
        "malware_detected": "critical",
        "port_scan": "high",
        "external_transfer": "high",
        "data_export": "high",
        "blocked_ip": "medium",
        "script_execution": "medium",
    }

    SEVERITY_SCORES = {
        "low": 1,
        "medium": 3,
        "high": 7,
        "critical": 10,
    }

    # Event category mapping
    CATEGORY_MAP = {
        "IAM": "authentication",
        "EDR": "endpoint",
        "FIREWALL": "network",
        "APP": "data_access",
    }

    def map(self, parsed_log: Dict) -> Dict:
        """
        Map a parsed log dictionary to the unified SOC schema.

        Args:
            parsed_log: Dictionary from the LogParser

        Returns:
            Normalized event dictionary
        """
        # Extract and normalize event type
        event_type = (
            parsed_log.get("event_type")
            or parsed_log.get("action")
            or parsed_log.get("event")
            or "unknown"
        )
        event_type = self._normalize_event_type(event_type)

        # Extract source
        source = (
            parsed_log.get("source")
            or self._infer_source(event_type)
            or "unknown"
        )
        source = source.upper()

        # Normalize timestamp
        timestamp = self._normalize_timestamp(parsed_log.get("timestamp"))

        # Derive severity
        severity = (
            parsed_log.get("severity")
            or self.SEVERITY_MAP.get(event_type, "low")
        )
        severity = severity.lower() if isinstance(severity, str) else "low"

        # Build normalized event
        event = {
            "event_id": parsed_log.get("event_id", str(uuid.uuid4())),
            "timestamp": timestamp,
            "user": parsed_log.get("user") or parsed_log.get("user_id") or "unknown",
            "device": parsed_log.get("device") or "unknown",
            "asset": (
                parsed_log.get("asset")
                or parsed_log.get("server")
                or parsed_log.get("host")
                or "unknown"
            ),
            "ip": parsed_log.get("ip") or parsed_log.get("src_ip") or "unknown",
            "event_type": event_type,
            "source": source,
            "severity": severity,
            "severity_score": self.SEVERITY_SCORES.get(severity, 1),
            "event_category": (
                parsed_log.get("event_category")
                or self.CATEGORY_MAP.get(source, "unknown")
            ),
            "session_id": parsed_log.get("session_id") or f"sess-{uuid.uuid4().hex[:8]}",
            "risk_flag": parsed_log.get("risk_flag", "normal"),
        }

        # Optional enrichment fields
        if parsed_log.get("dest_ip"):
            event["dest_ip"] = parsed_log["dest_ip"]
        if parsed_log.get("port"):
            event["port"] = parsed_log["port"]
        if parsed_log.get("process"):
            event["process"] = parsed_log["process"]
        if parsed_log.get("records_accessed"):
            event["records_accessed"] = parsed_log["records_accessed"]
        if parsed_log.get("bytes_transferred"):
            event["bytes_transferred"] = parsed_log["bytes_transferred"]
        if parsed_log.get("attack_chain"):
            event["attack_chain"] = parsed_log["attack_chain"]
            event["chain_step"] = parsed_log.get("chain_step", 0)

        # Behavior features
        ts_obj = self._parse_timestamp(timestamp)
        login_hour = parsed_log.get("login_hour", ts_obj.hour if ts_obj else 0)
        night_login = parsed_log.get("night_login", False)
        if isinstance(login_hour, int):
            night_login = login_hour < 6 or login_hour > 22

        event["login_hour"] = login_hour
        event["night_login"] = night_login

        # Event hash for deduplication
        event["event_hash"] = self._compute_hash(event)

        return event

    def map_batch(self, parsed_logs: list) -> list:
        """Map a batch of parsed log dictionaries."""
        return [self.map(log) for log in parsed_logs]

    # ─────────────────────────────────────────
    # NORMALIZATION HELPERS
    # ─────────────────────────────────────────

    def _normalize_event_type(self, event_type: str) -> str:
        """Normalize event type using alias mapping."""
        if not event_type:
            return "unknown"

        event_type = event_type.lower().strip()

        for canonical, aliases in self.EVENT_ALIASES.items():
            if event_type == canonical or event_type in aliases:
                return canonical

        return event_type

    def _normalize_timestamp(self, ts) -> str:
        """Normalize timestamp to ISO 8601 format."""
        if not ts:
            return datetime.now().isoformat()

        if isinstance(ts, datetime):
            return ts.isoformat()

        if isinstance(ts, str):
            try:
                return datetime.fromisoformat(ts).isoformat()
            except ValueError:
                pass

            # Try epoch timestamp
            try:
                return datetime.fromtimestamp(float(ts)).isoformat()
            except (ValueError, OSError):
                pass

        return datetime.now().isoformat()

    def _parse_timestamp(self, ts_str: str) -> Optional[datetime]:
        """Parse an ISO timestamp string."""
        try:
            return datetime.fromisoformat(ts_str)
        except (ValueError, TypeError):
            return None

    def _infer_source(self, event_type: str) -> Optional[str]:
        """Infer the telemetry source from event type."""
        iam_events = {"login_success", "login_failed", "password_change",
                      "account_locked", "mfa_attempt"}
        edr_events = {"process_start", "file_access", "privilege_escalation",
                      "script_execution", "malware_detected"}
        fw_events = {"connection_attempt", "blocked_ip", "port_scan",
                     "external_transfer"}
        app_events = {"database_query", "data_access", "file_download",
                      "data_export"}

        if event_type in iam_events:
            return "IAM"
        elif event_type in edr_events:
            return "EDR"
        elif event_type in fw_events:
            return "FIREWALL"
        elif event_type in app_events:
            return "APP"
        return None

    def _compute_hash(self, event: Dict) -> str:
        """Compute a deduplication hash for the event."""
        hash_input = (
            f"{event.get('timestamp', '')}"
            f"{event.get('user', '')}"
            f"{event.get('event_type', '')}"
            f"{event.get('ip', '')}"
            f"{event.get('asset', '')}"
        )
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]
