"""
Garud-Drishti — AI SOC Platform
Schema Mapper

Maps raw parsed dicts from any source into the canonical SOC event schema.

Event type normalisation uses a three-layer pipeline:
  Layer 1 — Canonical pass-through (already correct → return immediately)
  Layer 2 — Exact alias table (160+ variants from Windows, Sysmon, Linux,
             Splunk CIM, Sentinel, QRadar, CrowdStrike, plus common typos)
  Layer 3 — Signal-keyword fuzzy matching (tokenises CamelCase / hyphens /
             spaces and matches required signal words as substrings)

Handles every edge case including:
  "login_sucessd"            → login_success  (typo)
  "authentication_successd"  → login_success  (typo)
  "authentication_successful"→ login_success  (adjective)
  "logon_failure"            → login_failed   (Windows vocabulary)
  "AuthenticationFailed"     → login_failed   (CamelCase)
  "elevation_of_privilege"   → privilege_escalation
  "data_exfiltration"        → external_transfer
"""

import re
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_SEVERITIES = {"low", "medium", "high", "critical"}
VALID_SOURCES    = {"IAM", "EDR", "FIREWALL", "APP", "RAW"}

SOURCE_TO_CATEGORY: Dict[str, str] = {
    "IAM": "authentication", "EDR": "endpoint",
    "FIREWALL": "network", "APP": "application", "RAW": "unknown",
}

SEVERITY_ESCALATION: Dict[str, str] = {
    "privilege_escalation": "critical", "malware_detected": "critical",
    "data_export": "critical", "port_scan": "high", "account_locked": "high",
    "script_execution": "high", "external_transfer": "high",
    "data_access": "medium", "login_failed": "medium",
    "blocked_ip": "medium", "file_download": "medium", "mfa_failed": "high",
}

# ---------------------------------------------------------------------------
# Layer 1 — Canonical set
# ---------------------------------------------------------------------------

_CANONICAL_EVENT_TYPES: frozenset = frozenset({
    "login_success", "login_failed", "account_locked", "password_change",
    "mfa_attempt", "mfa_failed", "logout", "vpn_connect", "vpn_disconnect",
    "process_start", "file_access", "file_download", "script_execution",
    "privilege_escalation", "malware_detected", "connection_attempt",
    "blocked_ip", "port_scan", "external_transfer", "database_query",
    "data_access", "data_export",
})

# ---------------------------------------------------------------------------
# Layer 2 — Exact alias table  (160+ real-world variants)
# ---------------------------------------------------------------------------

EVENT_TYPE_NORMALISATION: Dict[str, str] = {

    # login_success
    "login":                       "login_success",
    "logon":                       "login_success",
    "login_ok":                    "login_success",
    "login_sucessd":               "login_success",
    "login_succeded":              "login_success",
    "login_successd":              "login_success",
    "logon_success":               "login_success",
    "logon_successful":            "login_success",
    "logon_successfull":           "login_success",
    "user_logon":                  "login_success",
    "user_logged_on":              "login_success",
    "user_login":                  "login_success",
    "auth_success":                "login_success",
    "authentication_success":      "login_success",
    "authentication_successd":     "login_success",
    "authentication_successful":   "login_success",
    "sso_login":                   "login_success",
    "interactive_logon":           "login_success",
    "network_logon":               "login_success",
    "remote_logon":                "login_success",
    "successful_login":            "login_success",
    "user_authenticated":          "login_success",
    "account_unlock":              "login_success",
    "account_unlocked":            "login_success",
    "user_unlocked":               "login_success",

    # login_failed
    "auth_fail":                   "login_failed",
    "auth_failed":                 "login_failed",
    "login_fail":                  "login_failed",
    "login_failure":               "login_failed",
    "failed_login":                "login_failed",
    "logon_failed":                "login_failed",
    "logon_failure":               "login_failed",
    "authentication_failed":       "login_failed",
    "authentication_failure":      "login_failed",
    "authentication_failured":     "login_failed",
    "bad_password":                "login_failed",
    "invalid_credentials":         "login_failed",
    "credential_failure":          "login_failed",
    "wrong_password":              "login_failed",
    "password_mismatch":           "login_failed",
    "logon_type_failure":          "login_failed",

    # account_locked
    "lock":                        "account_locked",
    "locked":                      "account_locked",
    "account_lockout":             "account_locked",
    "account_lock_out":            "account_locked",
    "account_locked_out":          "account_locked",
    "lockout":                     "account_locked",
    "user_locked":                 "account_locked",
    "user_locked_out":             "account_locked",
    "account_disabled":            "account_locked",
    "account_suspended":           "account_locked",
    "user_disabled":               "account_locked",
    "user_suspended":              "account_locked",
    "account_deactivated":         "account_locked",

    # password_change
    "password_changed":            "password_change",
    "password_reset":              "password_change",
    "passwd_change":               "password_change",
    "passwd_reset":                "password_change",
    "pwd_change":                  "password_change",
    "reset_password":              "password_change",
    "change_password":             "password_change",

    # mfa_attempt
    "mfa_success":                 "mfa_attempt",
    "mfa_passed":                  "mfa_attempt",
    "mfa_challenge":               "mfa_attempt",
    "two_factor_success":          "mfa_attempt",
    "2fa_success":                 "mfa_attempt",
    "otp_success":                 "mfa_attempt",

    # mfa_failed
    "mfa_failure":                 "mfa_failed",
    "two_factor_failed":           "mfa_failed",
    "2fa_failed":                  "mfa_failed",
    "otp_failed":                  "mfa_failed",

    # logout
    "logoff":                      "logout",
    "log_off":                     "logout",
    "user_logoff":                 "logout",
    "session_end":                 "logout",
    "session_closed":              "logout",
    "sign_out":                    "logout",
    "signout":                     "logout",

    # vpn_connect
    "vpn_connected":               "vpn_connect",
    "vpn_login":                   "vpn_connect",
    "vpn_established":             "vpn_connect",
    "remote_access_connected":     "vpn_connect",

    # vpn_disconnect
    "vpn_disconnected":            "vpn_disconnect",
    "vpn_logout":                  "vpn_disconnect",
    "vpn_terminated":              "vpn_disconnect",
    "remote_access_disconnected":  "vpn_disconnect",

    # privilege_escalation
    "priv_esc":                    "privilege_escalation",
    "privesc":                     "privilege_escalation",
    "priv_escalation":             "privilege_escalation",
    "privilege_escalated":         "privilege_escalation",
    "elevation_of_privilege":      "privilege_escalation",
    "elevated_privilege":          "privilege_escalation",
    "uac_bypass":                  "privilege_escalation",
    "token_escalation":            "privilege_escalation",
    "sudo_attempt":                "privilege_escalation",
    "su_attempt":                  "privilege_escalation",
    "runas":                       "privilege_escalation",

    # process_start
    "process_created":             "process_start",
    "process_started":             "process_start",
    "process_execution":           "process_start",
    "process_launch":              "process_start",
    "process_spawned":             "process_start",
    "new_process":                 "process_start",

    # script_execution
    "exec":                        "script_execution",
    "script_executed":             "script_execution",
    "script_run":                  "script_execution",
    "script_ran":                  "script_execution",
    "script_launched":             "script_execution",
    "powershell_execution":        "script_execution",
    "cmd_execution":               "script_execution",
    "shell_execution":             "script_execution",
    "wscript_execution":           "script_execution",

    # file_access
    "file_accessed":               "file_access",
    "file_read":                   "file_access",
    "file_open":                   "file_access",
    "file_opened":                 "file_access",
    "file_written":                "file_access",
    "file_modified":               "file_access",
    "file_write":                  "file_access",
    "file_created":                "file_access",
    "file_deleted":                "file_access",

    # file_download
    "download":                    "file_download",
    "large_download":              "file_download",
    "file_transferred":            "file_download",
    "file_retrieved":              "file_download",
    "http_download":               "file_download",

    # malware_detected
    "malware":                     "malware_detected",
    "virus":                       "malware_detected",
    "malware_found":               "malware_detected",
    "malware_identified":          "malware_detected",
    "virus_detected":              "malware_detected",
    "virus_found":                 "malware_detected",
    "threat_detected":             "malware_detected",
    "threat_found":                "malware_detected",
    "ransomware_detected":         "malware_detected",
    "trojan_detected":             "malware_detected",

    # port_scan
    "scan":                        "port_scan",
    "port_scanning":               "port_scan",
    "network_scan":                "port_scan",
    "nmap_scan":                   "port_scan",
    "host_scan":                   "port_scan",
    "service_scan":                "port_scan",

    # connection_attempt / blocked_ip
    "connection_established":      "connection_attempt",
    "connection_blocked":          "blocked_ip",
    "connection_denied":           "blocked_ip",
    "network_connection":          "connection_attempt",
    "inbound_connection":          "connection_attempt",
    "outbound_connection":         "connection_attempt",
    "tcp_connect":                 "connection_attempt",
    "ip_blocked":                  "blocked_ip",
    "firewall_block":              "blocked_ip",
    "traffic_blocked":             "blocked_ip",
    "packet_dropped":              "blocked_ip",

    # external_transfer
    "exfil":                       "external_transfer",
    "transfer":                    "external_transfer",
    "outbound_transfer":           "external_transfer",
    "data_transfer_out":           "external_transfer",
    "data_exfiltration":           "external_transfer",
    "data_exfiltrated":            "external_transfer",

    # data_export
    "export":                      "data_export",
    "bulk_export":                 "data_export",
    "data_copied":                 "data_export",
    "mass_export":                 "data_export",
    "report_export":               "data_export",
    "dump":                        "data_export",
    "database_dump":               "data_export",

    # data_access
    "access":                      "data_access",
    "data_accessed":               "data_access",
    "record_access":               "data_access",
    "sensitive_data_access":       "data_access",
    "pii_access":                  "data_access",

    # database_query
    "db_query":                    "database_query",
    "query":                       "database_query",
    "sql_query":                   "database_query",
    "db_read":                     "database_query",
    "select_query":                "database_query",
}

# ---------------------------------------------------------------------------
# Layer 3 — Signal-keyword fuzzy rules
# ---------------------------------------------------------------------------

_SIGNAL_RULES: List[tuple] = [
    ({"auth", "success"},           "login_success"),
    ({"logon", "success"},          "login_success"),
    ({"login", "success"},          "login_success"),
    ({"login", "ok"},               "login_success"),
    ({"user", "logged"},            "login_success"),
    ({"auth", "fail"},              "login_failed"),
    ({"auth", "failure"},           "login_failed"),
    ({"logon", "fail"},             "login_failed"),
    ({"login", "fail"},             "login_failed"),
    ({"login", "failure"},          "login_failed"),
    ({"authentication", "fail"},    "login_failed"),
    ({"authentication", "failure"}, "login_failed"),
    ({"credential", "fail"},        "login_failed"),
    ({"invalid", "password"},       "login_failed"),
    ({"bad", "password"},           "login_failed"),
    ({"account", "lock"},           "account_locked"),
    ({"account", "suspend"},        "account_locked"),
    ({"account", "disable"},        "account_locked"),
    ({"account", "unlock"},         "login_success"),
    ({"password", "reset"},         "password_change"),
    ({"password", "change"},        "password_change"),
    ({"privilege", "escal"},        "privilege_escalation"),
    ({"priv", "escal"},             "privilege_escalation"),
    ({"elevation", "privilege"},    "privilege_escalation"),
    ({"process", "creat"},          "process_start"),
    ({"process", "start"},          "process_start"),
    ({"process", "launch"},         "process_start"),
    ({"process", "exec"},           "process_start"),
    ({"script", "exec"},            "script_execution"),
    ({"script", "run"},             "script_execution"),
    ({"powershell", "exec"},        "script_execution"),
    ({"file", "read"},              "file_access"),
    ({"file", "write"},             "file_access"),
    ({"file", "access"},            "file_access"),
    ({"file", "create"},            "file_access"),
    ({"file", "delete"},            "file_access"),
    ({"file", "download"},          "file_download"),
    ({"file", "transfer"},          "file_download"),
    ({"port", "scan"},              "port_scan"),
    ({"network", "scan"},           "port_scan"),
    ({"connection", "block"},       "blocked_ip"),
    ({"connection", "deny"},        "blocked_ip"),
    ({"connection", "drop"},        "blocked_ip"),
    ({"ip", "block"},               "blocked_ip"),
    ({"outbound", "transfer"},      "external_transfer"),
    ({"data", "exfil"},             "external_transfer"),
    ({"data", "transfer"},          "external_transfer"),
    ({"malware", "detect"},         "malware_detected"),
    ({"virus", "detect"},           "malware_detected"),
    ({"threat", "detect"},          "malware_detected"),
    ({"ransomware"},                "malware_detected"),
    ({"data", "export"},            "data_export"),
    ({"bulk", "export"},            "data_export"),
    ({"data", "access"},            "data_access"),
    ({"db", "query"},               "database_query"),
    ({"sql", "query"},              "database_query"),
    ({"vpn", "connect"},            "vpn_connect"),
    ({"vpn", "login"},              "vpn_connect"),
    ({"vpn", "disconnect"},         "vpn_disconnect"),
    ({"vpn", "logout"},             "vpn_disconnect"),
    ({"mfa", "success"},            "mfa_attempt"),
    ({"mfa", "pass"},               "mfa_attempt"),
    ({"2fa", "success"},            "mfa_attempt"),
    ({"mfa", "fail"},               "mfa_failed"),
    ({"2fa", "fail"},               "mfa_failed"),
]


def _tokenise(s: str) -> set:
    """
    Split into lowercase tokens, handling:
      - underscores, hyphens, dots, spaces
      - CamelCase boundaries

    "AuthenticationSuccessful" → {"authentication", "successful"}
    "LOGIN-FAILURE"            → {"login", "failure"}
    """
    s = re.sub(r"([a-z])([A-Z])", r"\1_\2", s)
    s = re.sub(r"[\s\-\.]+", "_", s)
    return {t for t in s.lower().split("_") if t}


def _fuzzy_match(tokens: set) -> Optional[str]:
    """Return first signal-rule match, or None."""
    for required, canonical in _SIGNAL_RULES:
        if all(any(sig in tok for tok in tokens) for sig in required):
            return canonical
    return None


def _normalise_event_type(raw: str) -> str:
    """
    Three-layer event type normalisation.

    Layer 1: already canonical → return immediately
    Layer 2: exact alias lookup → return mapped value
    Layer 3: tokenise + signal-rule fuzzy match → return match
    Fallback: return cleaned string unchanged
    """
    if not raw:
        return "unknown"

    cleaned = str(raw).strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")

    if cleaned in _CANONICAL_EVENT_TYPES:
        return cleaned

    if cleaned in EVENT_TYPE_NORMALISATION:
        return EVENT_TYPE_NORMALISATION[cleaned]

    fuzzy = _fuzzy_match(_tokenise(raw))
    if fuzzy:
        return fuzzy

    return cleaned


def _derive_severity(event_type: str, existing: Optional[str]) -> str:
    if event_type in SEVERITY_ESCALATION:
        return SEVERITY_ESCALATION[event_type]
    if existing and existing.lower() in VALID_SEVERITIES:
        return existing.lower()
    return "low"


def _safe_ts(raw_ts: Any) -> str:
    """Return valid ISO-8601 timestamp, handling int epoch, common formats, garbage."""
    if not raw_ts:
        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    # EC-14: handle Unix epoch integers
    if isinstance(raw_ts, (int, float)):
        try:
            return datetime.utcfromtimestamp(float(raw_ts)).strftime("%Y-%m-%dT%H:%M:%S")
        except (OSError, ValueError, OverflowError):
            return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    ts_str = str(raw_ts).strip()
    if len(ts_str) >= 19 and "T" in ts_str:
        return ts_str[:19]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S"):
        try:
            return datetime.strptime(ts_str, fmt).strftime("%Y-%m-%dT%H:%M:%S")
        except ValueError:
            continue
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")


# ---------------------------------------------------------------------------
# Schema Mapper
# ---------------------------------------------------------------------------

class SchemaMapper:
    """Maps any raw parsed dict to the canonical SOC event schema."""

    def map(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        event_id  = raw.get("event_id") or str(uuid.uuid4())
        timestamp = _safe_ts(raw.get("timestamp"))

        source = str(raw.get("source", "RAW")).upper()
        if source not in VALID_SOURCES:
            source = "RAW"
        event_category = SOURCE_TO_CATEGORY.get(source, "unknown")

        event_type = _normalise_event_type(raw.get("event_type", "unknown"))
        severity   = _derive_severity(event_type, raw.get("severity"))

        user       = raw.get("user")       or raw.get("username") or ""
        device     = raw.get("device")     or raw.get("hostname") or ""
        asset      = raw.get("asset")      or raw.get("resource") or ""
        ip         = raw.get("ip")         or raw.get("src_ip") or ""
        src_ip     = raw.get("src_ip")     or ip
        dest_ip    = raw.get("dest_ip")    or ""
        port       = str(raw.get("port",   ""))
        protocol   = raw.get("protocol")   or ""
        process    = raw.get("process")    or ""
        session_id = raw.get("session_id") or ""

        details = raw.get("details") or {}
        if isinstance(details, str):
            try:
                import json
                details = json.loads(details)
            except Exception:
                details = {"raw_details": details}

        canonical_keys = {
            "event_id","timestamp","user","device","asset","ip","src_ip",
            "dest_ip","port","protocol","process","event_type","event_category",
            "source","severity","session_id","details","_format","_raw",
            "_attack_chain","_source_file","_line","_json_fallback",
            "mitre_technique","mitre_sub_technique","mitre_tactic","mitre_technique_name",
            "geo_country","geo_city","geo_risk","network_zone",
            "asset_criticality","user_risk_score","threat_score",
        }
        extras = {k: v for k, v in raw.items() if k not in canonical_keys}
        if extras:
            details = {**details, **extras}

        attack_chain         = raw.get("_attack_chain") or details.pop("_attack_chain", None) or ""
        mitre_technique      = raw.get("mitre_technique",      "T0000")
        mitre_sub_technique  = raw.get("mitre_sub_technique",  "T0000")
        mitre_tactic         = raw.get("mitre_tactic",         "Unknown")
        mitre_technique_name = raw.get("mitre_technique_name", "Unmapped Technique")
        geo_country          = raw.get("geo_country",          "")
        geo_city             = raw.get("geo_city",             "")
        geo_risk             = raw.get("geo_risk",             "")
        network_zone         = raw.get("network_zone",         "")
        asset_criticality    = raw.get("asset_criticality",    "medium")
        user_risk_score      = raw.get("user_risk_score",      0.0)
        threat_score         = raw.get("threat_score",         0)

        return {
            "event_id":            event_id,
            "timestamp":           timestamp,
            "user":                user,
            "device":              device,
            "asset":               asset,
            "ip":                  ip,
            "src_ip":              src_ip,
            "dest_ip":             dest_ip,
            "port":                port,
            "protocol":            protocol,
            "process":             process,
            "event_type":          event_type,
            "event_category":      event_category,
            "source":              source,
            "severity":            severity,
            "session_id":          session_id,
            "attack_chain":        attack_chain,
            "mitre_technique":     mitre_technique,
            "mitre_sub_technique": mitre_sub_technique,
            "mitre_tactic":        mitre_tactic,
            "mitre_technique_name":mitre_technique_name,
            "geo_country":         geo_country,
            "geo_city":            geo_city,
            "geo_risk":            geo_risk,
            "network_zone":        network_zone,
            "asset_criticality":   asset_criticality,
            "user_risk_score":     user_risk_score,
            "threat_score":        threat_score,
            "details":             details,
        }

    def map_many(self, raws: list) -> list:
        return [self.map(r) for r in raws if r is not None]


_mapper_instance: Optional[SchemaMapper] = None

def get_mapper() -> SchemaMapper:
    global _mapper_instance
    if _mapper_instance is None:
        _mapper_instance = SchemaMapper()
    return _mapper_instance


if __name__ == "__main__":
    import json as _json
    m = SchemaMapper()
    tests = [
        ("login_sucessd",             "login_success"),
        ("authentication_successd",   "login_success"),
        ("authentication_successful", "login_success"),
        ("logon_failure",             "login_failed"),
        ("AuthenticationFailed",      "login_failed"),
        ("elevation_of_privilege",    "privilege_escalation"),
        ("data_exfiltration",         "external_transfer"),
        ("malware_found",             "malware_detected"),
        ("process_created",           "process_start"),
        ("virus_detected",            "malware_detected"),
    ]
    print("Normalisation tests:")
    for raw, expected in tests:
        got = _normalise_event_type(raw)
        status = "PASS" if got == expected else "FAIL"
        print(f"  [{status}] {raw:35s} → {got}")