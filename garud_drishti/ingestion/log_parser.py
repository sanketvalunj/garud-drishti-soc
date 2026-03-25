"""
CRYPTIX — GARUD-DRISHTI
ingestion/log_parser.py

RESPONSIBILITY: PARSING ONLY
─────────────────────────────
Parse raw log lines into plain Python dicts.
NO mapping, NO validation, NO enrichment.

Supports:
  • JSON (single object, JSON-lines, JSON array)
  • Key=Value  (syslog-style)
  • CSV        (with or without header)
  • Raw text   (regex pattern matching)
  • Ollama LLM fallback (for anything the above cannot parse)

Output contract — every returned dict is guaranteed to contain:
  event_id, timestamp, log_source, source, source_type,
  event_type, event_category, severity, severity_score,
  entity_id, resolved_user, employee_id, department, role,
  device_id, workstation, src_ip, session_id, risk_flag,
  _format, _parser_confidence, _raw, _ingestion_time

Edge-cases handled:
  EC-01  Truncated / malformed JSON  → raw fallback → Ollama fallback
  EC-02  JSON array input            → exploded into individual events
  EC-03  Completely blank / whitespace-only lines → skipped (None)
  EC-04  KV line with embedded JSON value → value kept as string
  EC-05  CSV missing columns → remaining fields filled with None
  EC-06  Unknown event_type → CATEGORY_MAP returns "unknown"
  EC-07  Missing severity → defaults to "LOW" / score 1
  EC-08  Missing entity_id → synthesised from resolved_user hash
  EC-09  Null / None field values → normalised to None
  EC-10  Ollama unavailable → graceful degradation
  EC-11  Unicode / encoding errors → replaced with ?
  EC-12  Very long lines (> 64 KB) → truncated, flag added
  EC-13  Nested JSON objects in fields → serialised back to JSON string
  EC-14  Mixed-case field names → lower-cased on ingest
  EC-15  Duplicate event_id → new uuid assigned
  EC-16  Wrong field names: usr, evt, ip_addr → aliased
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# Ollama — optional import; parser degrades gracefully if not installed
try:
    import ollama as _ollama_lib
    _OLLAMA_AVAILABLE = True
except ImportError:
    _OLLAMA_AVAILABLE = False

import numpy as np
import pandas as pd

import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
# ═══════════════════════════════════════════════════════════════════
# CONSTANTS  — must stay in sync with generate_fake_logs.py
# ═══════════════════════════════════════════════════════════════════

CATEGORY_MAP: Dict[str, str] = {
    # IAM
    "LOGIN_SUCCESS"         : "authentication",
    "LOGIN_FAILURE"         : "authentication",
    "LOGOUT"                : "authentication",
    "PRIVILEGE_CHANGE"      : "identity",
    "PASSWORD_RESET"        : "identity",
    "PRIVILEGE_ESCALATION"  : "identity",
    # SIEM
    "ALERT"                 : "detection",
    "USER_ACTIVITY"         : "audit",
    # Firewall / Network
    "CONNECTION_ALLOWED"    : "network",
    "CONNECTION_DENIED"     : "network",
    "PORT_SCAN"             : "network",
    "LARGE_DATA_TRANSFER"   : "network",
    # EDR
    "PROCESS_EXECUTION"     : "endpoint",
    "MALICIOUS_PROCESS"     : "endpoint",
    "FILE_ACCESS"           : "endpoint",
    "REGISTRY_MODIFICATION" : "endpoint",
    "USB_INSERT"            : "endpoint",
    # Banking
    "TRANSACTION"           : "application",
    "LARGE_TRANSACTION"     : "application",
    "TRANSACTION_FAILED"    : "application",
    # Generic fallback
    "UNKNOWN"               : "unknown",
}

SEVERITY_SCORE: Dict[str, int] = {
    "INFO"    : 0,
    "LOW"     : 1,
    "MEDIUM"  : 2,
    "HIGH"    : 3,
    "CRITICAL": 4,
}

SOURCE_TYPE_MAP: Dict[str, str] = {
    "IAM"     : "identity",
    "SIEM"    : "detection",
    "FIREWALL": "network",
    "EDR"     : "endpoint",
    "BANKING" : "application",
    "NETWORK" : "network",
    "ENDPOINT": "endpoint",
    "DETECTION": "detection",
    "AUDIT"   : "audit",
    "UNKNOWN" : "unknown",
}

# Canonical SOC schema — every event MUST have these keys
REQUIRED_FIELDS: Tuple[str, ...] = (
    "event_id", "timestamp", "log_source", "source", "source_type",
    "event_type", "event_category", "severity", "severity_score",
    "entity_id", "resolved_user", "employee_id", "department", "role",
    "device_id", "workstation", "src_ip", "session_id", "risk_flag",
)

# CSV column order produced by generate_fake_logs.py (base_event fields first)
_CSV_FIELDS: List[str] = [
    "event_id", "timestamp", "log_source", "source", "source_type",
    "event_type", "event_category", "severity", "severity_score",
    "entity_id", "resolved_user", "employee_id", "department", "role",
    "device_id", "workstation", "src_ip", "session_id", "risk_flag",
    "logon_type", "auth_method", "status", "failure_reason", "mfa_used",
    "geo_country", "login_hour", "night_login",
    "alert_name", "dst_ip", "dst_server", "asset_criticality", "alert_count",
    "mitre_tactic", "mitre_technique",
    "dst_port", "protocol", "action", "bytes_sent", "bytes_recv",
    "duration_ms", "scanned_ports", "scan_count",
    "process_name", "parent_process", "command_line", "process_hash",
    "device", "is_signed",
    "file_path", "file_action",
    "registry_key",
    "device_name", "device_type",
    "transaction_id", "banking_user_id", "txn_type", "amount", "currency",
    "src_account", "dst_account", "channel", "is_anomalous", "is_fraud",
    "country", "failure_reason_banking",
]

# Max line length before truncation (EC-12)
_MAX_LINE_LEN = 65_536

# Null-like values
_NULL_STRINGS = {"", "none", "null", "n/a", "na", "undefined"}


def _is_null(val: Any) -> bool:
    if val is None:
        return True
    return str(val).strip().lower() in _NULL_STRINGS


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


# ═══════════════════════════════════════════════════════════════════
# OLLAMA CLIENT
# ═══════════════════════════════════════════════════════════════════

_OLLAMA_MODEL   = "mistral"
_OLLAMA_TIMEOUT = 10

_OLLAMA_SYSTEM_PROMPT = """You are a cybersecurity log normalizer for a SOC platform.
Given a raw log line or partially parsed dict, extract and return ONLY a valid JSON object
with as many of these fields as you can infer:
event_type, event_category, severity, resolved_user, src_ip, dst_ip,
log_source, source_type, timestamp, session_id, risk_flag, department, role,
process_name, file_path, alert_name, transaction_id, amount, action.

Rules:
- Return ONLY raw JSON. No markdown. No explanation. No code fences.
- Use UPPERCASE for event_type and severity values.
- If a field cannot be inferred, omit it entirely.
- severity must be one of: INFO, LOW, MEDIUM, HIGH, CRITICAL
- event_category must be one of: authentication, identity, detection, audit,
  network, endpoint, application, unknown
"""


def _ollama_enrich(raw: str) -> Optional[Dict[str, Any]]:
    """Call local Ollama LLM to parse/enrich an unparseable log line."""
    if not _OLLAMA_AVAILABLE:
        return None
    try:
        response = _ollama_lib.chat(
            model=_OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": _OLLAMA_SYSTEM_PROMPT},
                {"role": "user",   "content": f"Parse this log:\n{raw[:2000]}"},
            ],
            options={"timeout": _OLLAMA_TIMEOUT},
        )
        text = response["message"]["content"].strip()
        text = re.sub(r"^```[a-z]*\n?", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\n?```$", "", text)
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            parsed["_ollama_enriched"] = True
            return parsed
    except Exception as exc:
        logger.debug("Ollama enrichment failed: %s", exc)
    return None


# ═══════════════════════════════════════════════════════════════════
# FORMAT DETECTORS
# ═══════════════════════════════════════════════════════════════════

def _detect_format(line: str) -> str:
    """Heuristic format detection. Priority: json_array > json > csv > kv > raw"""
    s = line.strip()
    if s.startswith("["):
        return "json_array"
    if s.startswith("{"):
        return "json"
    if re.match(r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}|[\w\-]{3,36}),", s):
        if len(re.findall(r'\w+=(?:"[^"]*"|\S+)', s)) < 2:
            return "csv"
    if len(re.findall(r'\w+=(?:"[^"]*"|\S+)', s)) >= 2:
        return "kv"
    return "raw"


# ═══════════════════════════════════════════════════════════════════
# FORMAT PARSERS
# ═══════════════════════════════════════════════════════════════════

def _parse_json(line: str) -> Optional[Dict[str, Any]]:
    """EC-01: Returns None on malformed JSON so caller can fall back."""
    try:
        obj = json.loads(line.strip())
        if isinstance(obj, dict):
            return obj
        if isinstance(obj, list) and obj and isinstance(obj[0], dict):
            return obj[0]
    except (json.JSONDecodeError, ValueError):
        pass
    return None

    payload = json.dumps({
            "model": OLLAMA_MODEL,
            "prompt": f"Return JSON with mitre_id, threat_type, action:\n{text}",
            "stream": False
        }).encode()

def _parse_json_array(line: str) -> Optional[List[Dict[str, Any]]]:
    """EC-02: Returns a list of dicts from a JSON array line."""
    try:
        arr = json.loads(line.strip())
        if isinstance(arr, list):
            return [item for item in arr if isinstance(item, dict)]
    except (json.JSONDecodeError, ValueError):
        pass
    return None

        # ✅ FIX: handle markdown JSON
    if "```" in raw:
            raw = raw.split("```")[1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()

def _parse_kv(line: str) -> Optional[Dict[str, Any]]:
    """Parse key=value and key="quoted value" pairs. EC-04."""
    result: Dict[str, Any] = {}
    pattern = re.compile(r'(\w[\w.\-]*)\s*=\s*(?:"([^"]*?)"|(\\S+))')
    for key, quoted, bare in pattern.findall(line):
        val = quoted if quoted else bare
        if val.lower() in ("none", "null", ""):
            val = None
        result[key.lower()] = val
    return result if result else None


def _parse_csv(line: str, header: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """Parse CSV. EC-05: columns shorter than header → filled with None."""
    fields   = header or _CSV_FIELDS
    stripped = line.strip()
    if stripped.lower().startswith("event_id") or stripped.lower().startswith("timestamp"):
        return None
    try:
        reader = csv.reader(io.StringIO(stripped))
        row    = next(reader, None)
        if not row:
            return None
        result: Dict[str, Any] = {}
        for i, field in enumerate(fields):
            val = row[i] if i < len(row) else None
            if isinstance(val, str) and val.lower() in ("none", "null", ""):
                val = None
            result[field] = val
        return result
    except Exception:
        return None


_RAW_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"\[(?P<timestamp>[^\]]+)\]\s+User\s+(?P<resolved_user>\S+)\s+triggered"
        r"\s+(?P<event_type>\S+)\s+from\s+(?P<src_ip>\S+)\s+on\s+(?P<dst_server>\S+)"
    ),
    re.compile(
        r"User\s+(?P<resolved_user>\S+)\s+(?P<event_type>login[\w_]+)\s+from\s+(?P<src_ip>\S+)"
    ),
    re.compile(
        r"(?P<resolved_user>[\w.\-]+)\s+performed\s+(?P<event_type>\S+)\s+on\s+(?P<dst_server>\S+)"
    ),
    re.compile(
        r"(?:ALERT|WARN|INFO|ERROR):\s+(?P<event_type>\S+)\s+detected\s+for\s+(?P<resolved_user>[\w.\-]+)"
    ),
    re.compile(
        r"(?P<timestamp>\w{3}\s+\d+\s+\d+:\d+:\d+)\s+\S+\s+\S+:\s+"
        r"(?P<event_type>Failed|Accepted)\s+\S+\s+for\s+(?P<resolved_user>\S+)"
    ),
    re.compile(
        r"EventID=(?P<event_id_raw>\d+)\s+User=(?P<resolved_user>\S+)\s+IP=(?P<src_ip>\S+)"
    ),
]

_WIN_EVENT_MAP: Dict[str, str] = {
    "4624": "LOGIN_SUCCESS",
    "4625": "LOGIN_FAILURE",
    "4634": "LOGOUT",
    "4672": "PRIVILEGE_CHANGE",
    "4688": "PROCESS_EXECUTION",
    "4698": "SCHEDULED_TASK",
    "7045": "SERVICE_INSTALL",
}


def _parse_raw(line: str) -> Dict[str, Any]:
    """Try all regex patterns. Always returns at least a minimal dict."""
    stripped = line.strip()
    for pattern in _RAW_PATTERNS:
        m = pattern.search(stripped)
        if m:
            result = {k: v for k, v in m.groupdict().items() if v}
            if "event_id_raw" in result:
                eid = result.pop("event_id_raw")
                result["event_type"] = _WIN_EVENT_MAP.get(eid, f"WIN_{eid}")
            result["_raw"]       = stripped
            result["source"]     = "RAW"
            result["log_source"] = "RAW"
            return result
    return {"_raw": stripped, "source": "RAW", "log_source": "RAW", "event_type": "unknown"}

    if key in LLM_CACHE:
        return LLM_CACHE[key]

# ═══════════════════════════════════════════════════════════════════
# FIELD NORMALISER
# ═══════════════════════════════════════════════════════════════════

def _coerce_severity(val: Any) -> Tuple[str, int]:
    """Return (severity_string, severity_score). Defaults to LOW/1."""
    if val is None:
        return "LOW", 1
    s = str(val).strip().upper()
    if s in SEVERITY_SCORE:
        return s, SEVERITY_SCORE[s]
    try:
        n = int(float(s))
        reverse = {v: k for k, v in SEVERITY_SCORE.items()}
        label   = reverse.get(n, "LOW")
        return label, SEVERITY_SCORE[label]
    except (ValueError, TypeError):
        pass
    return "LOW", 1


def _ensure_entity_id(event: Dict[str, Any]) -> str:
    """
    CRITICAL FIX: entity_id normalisation using full alias chain.
    entity_id ← entity_id | employee_id | user_id | resolved_user | user | usr
    EC-08: synthesise from user hash if all missing.
    """
    for field in ("entity_id", "employee_id", "user_id"):
        val = event.get(field)
        if val and not _is_null(val):
            return str(val).strip()
    user = (
        event.get("resolved_user") or
        event.get("user") or
        event.get("username") or
        event.get("usr") or
        "unknown"
    )
    if user and user != "unknown":
        return "ENT-" + hashlib.md5(str(user).encode()).hexdigest()[:8].upper()
    return "ENT-UNKNOWN"


def _ensure_event_id(event: Dict[str, Any], seen_ids: set) -> str:
    """EC-15: assign new uuid if event_id is missing or duplicate."""
    eid = event.get("event_id")
    if _is_null(eid) or str(eid).strip() in seen_ids:
        eid = str(uuid.uuid4())
    seen_ids.add(str(eid))
    return str(eid)


def _normalise_field_names(event: Dict[str, Any]) -> Dict[str, Any]:
    """EC-14: lowercase all keys; flatten nested objects (EC-13)."""
    out: Dict[str, Any] = {}
    for k, v in event.items():
        key = k.lower().strip()
        if isinstance(v, (dict, list)):
            v = json.dumps(v)
        if isinstance(v, str) and v.strip().lower() in ("none", "null"):
            v = None
        out[key] = v
    return out


def _apply_soc_schema(
    event: Dict[str, Any],
    raw_line: str,
    fmt: str,
    confidence: float,
    seen_ids: set,
    source_file: str = "",
) -> Dict[str, Any]:
    """
    Guarantee the full SOC schema is present on every event.
    Single responsibility: fills/corrects all schema fields.
    """
    ingestion_time = _now_iso()
    event = _normalise_field_names(event)

    # ── Field aliases (EC-16: usr, ip_addr, evt, etc.) ──────────────
    _ALIASES: Dict[str, str] = {
        "user"      : "resolved_user",
        "username"  : "resolved_user",
        "userid"    : "resolved_user",
        "usr"       : "resolved_user",       # EC-16
        "ip"        : "src_ip",
        "source_ip" : "src_ip",
        "ip_addr"   : "src_ip",              # EC-16
        "host"      : "workstation",
        "hostname"  : "workstation",
        "logsource" : "log_source",
        "type"      : "event_type",
        "evt"       : "event_type",          # EC-16
        "category"  : "event_category",
        "asset"     : "dst_server",
    }
    for alias, canonical in _ALIASES.items():
        if alias in event and canonical not in event:
            event[canonical] = event[alias]

    # ── Severity ─────────────────────────────────────────────────────
    sev_str, sev_score = _coerce_severity(
        event.get("severity") or event.get("severity_score")
    )
    event["severity"]       = sev_str
    event["severity_score"] = sev_score

    # ── event_type → uppercase + unknown guard ────────────────────────
    et_raw = event.get("event_type") or ""
    et     = str(et_raw).strip().upper()
    if not et or et in ("NONE", "NULL", ""):
        # CRITICAL: preserve original_event_type in details (Fix #3)
        if et_raw and not _is_null(et_raw):
            event.setdefault("details", {})
            if not isinstance(event.get("details"), dict):
                event["details"] = {}
            event["details"]["original_event_type"] = str(et_raw)
        et = "UNKNOWN"
    event["event_type"] = et

    # ── event_category ────────────────────────────────────────────────
    event["event_category"] = (
        event.get("event_category")
        or CATEGORY_MAP.get(et, "unknown")
    )

    # ── source / source_type / log_source ─────────────────────────────
    src = str(event.get("log_source") or event.get("source") or "UNKNOWN").upper()
    event["log_source"]  = src
    event["source"]      = src
    event["source_type"] = SOURCE_TYPE_MAP.get(src, event.get("source_type", "unknown"))

    # ── device_id: always set ─────────────────────────────────────────
    event["device_id"] = (
        event.get("device_id") or
        event.get("workstation") or
        event.get("device") or
        event.get("hostname") or
        "unknown"
    )
    event["workstation"] = event["device_id"]

    # ── CRITICAL: entity_id normalisation (Fix #1) ────────────────────
    event["entity_id"] = _ensure_entity_id(event)

    # ── resolved_user alias chain ─────────────────────────────────────
    resolved_user = (
        event.get("resolved_user") or
        event.get("user") or
        event.get("usr") or
        "unknown"
    )

    # ── Fill required fields with safe defaults ───────────────────────
    defaults: Dict[str, Any] = {
        "resolved_user" : resolved_user,
        "employee_id"   : None,
        "department"    : None,
        "role"          : None,
        "src_ip"        : None,
        "risk_flag"     : "normal",
        "timestamp"     : None,
    }
    for field, default in defaults.items():
        if not event.get(field):
            event[field] = default

    # ── session_id fallback (Fix #7) ──────────────────────────────────
    if not event.get("session_id"):
        eid_for_sess = event.get("entity_id") or event.get("resolved_user") or "unknown"
        ts_for_sess  = str(event.get("timestamp") or "")[:13]
        event["session_id"] = f"sess_{eid_for_sess}_{ts_for_sess}" if ts_for_sess else f"sess_{eid_for_sess}"

    # ── Meta fields ───────────────────────────────────────────────────
    event["event_id"]        = _ensure_event_id(event, seen_ids)
    event["_raw"]            = raw_line[:_MAX_LINE_LEN]
    event["_format"]         = fmt
    event["_parser_confidence"] = round(confidence, 2)
    event["_ingestion_time"] = ingestion_time            # Fix #10: data lineage
    if source_file:
        event["_source_file"] = source_file              # Fix #10: data lineage

    # EC-12: flag truncated lines
    if len(raw_line) > _MAX_LINE_LEN:
        event["_truncated"] = True

    return event


# ═══════════════════════════════════════════════════════════════════
# MAIN PARSING ENTRY POINTS
# ═══════════════════════════════════════════════════════════════════

_SEEN_IDS: set = set()


def parse_log_line(
    line: str,
    use_ollama: bool = True,
    ollama_threshold: float = 0.3,
    source_file: str = "",
) -> Optional[List[Dict[str, Any]]]:
    """
    Parse a single log line. Returns:
      - None          if line is blank
      - List[dict]    always a list (JSON arrays produce multiple events)
    """
    if not line or not line.strip():
        return None

    raw = line.rstrip("\n\r")

    if len(raw) > _MAX_LINE_LEN:
        logger.warning("Line exceeds %d chars, truncating.", _MAX_LINE_LEN)
        raw = raw[:_MAX_LINE_LEN]

    fmt        = _detect_format(raw)
    parsed     = None
    confidence = 1.0
    events: List[Dict[str, Any]] = []

    # ── JSON ARRAY (EC-02) ────────────────────────────────────────────
    if fmt == "json_array":
        arr = _parse_json_array(raw)
        if arr:
            for obj in arr:
                events.append(
                    _apply_soc_schema(obj, raw, "json_array", 1.0, _SEEN_IDS, source_file)
                )
            return events
        fmt = "raw"

    # ── JSON ──────────────────────────────────────────────────────────
    if fmt == "json":
        parsed = _parse_json(raw)
        if parsed is None:
            logger.debug("EC-01: malformed JSON, falling back. line=%.80s", raw)
            parsed     = _parse_raw(raw)
            fmt        = "raw_from_json_fallback"
            confidence = 0.4

    # ── KV ───────────────────────────────────────────────────────────
    elif fmt == "kv":
        parsed = _parse_kv(raw)
        if parsed is None:
            parsed     = _parse_raw(raw)
            fmt        = "raw_from_kv_fallback"
            confidence = 0.4

    # ── CSV ──────────────────────────────────────────────────────────
    elif fmt == "csv":
        parsed = _parse_csv(raw)
        if parsed is None:
            parsed     = _parse_raw(raw)
            fmt        = "raw_from_csv_fallback"
            confidence = 0.4

    # ── RAW ──────────────────────────────────────────────────────────
    else:
        parsed     = _parse_raw(raw)
        confidence = 0.6 if parsed.get("event_type") != "unknown" else 0.2

    # ── OLLAMA ENRICHMENT ─────────────────────────────────────────────
    if use_ollama and (
        confidence <= ollama_threshold
        or parsed.get("event_type", "").lower() == "unknown"
    ):
        enriched = _ollama_enrich(raw)
        if enriched:
            for k, v in enriched.items():
                if not parsed.get(k):
                    parsed[k] = v
            parsed["_ollama_enriched"] = True
            confidence = max(confidence, 0.75)

    event = _apply_soc_schema(parsed, raw, fmt, confidence, _SEEN_IDS, source_file)
    return [event]

# ─────────────────────────────────────────────────────────
# ANOMALY DETECTION (FIXED)
# ─────────────────────────────────────────────────────────
def compute_anomaly(df):
    from sklearn.ensemble import IsolationForest

def parse_log_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Parse an already-decoded dict. Guarantees full SOC schema on output."""
    return _apply_soc_schema(dict(entry), json.dumps(entry), "dict", 1.0, _SEEN_IDS)


def parse_file(
    path: str,
    encoding: str = "utf-8",
    use_ollama: bool = True,
) -> List[Dict[str, Any]]:
    """
    Parse every log line from a file.
    Handles: plain text, JSON-lines, full JSON array, mixed formats.
    EC-11: encoding errors replaced with '?'

    Returns list of parsed events with _source_file and _ingestion_time set.
    """
    all_events: List[Dict[str, Any]] = []
    error_count = 0

    with open(path, "r", encoding=encoding, errors="replace") as fh:
        raw_content = fh.read()

    # ── Try: entire file is one JSON array ────────────────────────────
    stripped = raw_content.strip()
    if stripped.startswith("["):
        try:
            arr = json.loads(stripped)
            if isinstance(arr, list):
                logger.info("File is JSON array with %d items: %s", len(arr), path)
                for item in arr:
                    if isinstance(item, dict):
                        all_events.append(
                            _apply_soc_schema(
                                item, json.dumps(item), "json_array", 1.0,
                                _SEEN_IDS, source_file=path
                            )
                        )
                _log_summary(path, all_events, error_count)
                return all_events
        except json.JSONDecodeError:
            pass  # not a clean array — parse line by line

    # ── Line-by-line parsing ──────────────────────────────────────────
    for lineno, line in enumerate(raw_content.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            results = parse_log_line(line, use_ollama=use_ollama, source_file=path)
            if results:
                for r in results:
                    r["_line"] = lineno
                    all_events.append(r)
        except Exception as exc:
            error_count += 1
            logger.warning("Error on line %d in %s: %s", lineno, path, exc)

    _log_summary(path, all_events, error_count)
    return all_events


def parse_json_log_file(path: str) -> List[Dict[str, Any]]:
    """Convenience wrapper for JSON files produced by generate_fake_logs.py."""
    return parse_file(path, use_ollama=False)


def _log_summary(path: str, events: List, errors: int) -> None:
    by_source: Dict[str, int] = {}
    for e in events:
        s = e.get("log_source", "UNKNOWN")
        by_source[s] = by_source.get(s, 0) + 1
    breakdown = ", ".join(f"{k}:{v}" for k, v in sorted(by_source.items()))
    logger.info(
        "Parsed %d events from %s (%d errors) [%s]",
        len(events), path, errors, breakdown
    )


# ═══════════════════════════════════════════════════════════════════
# VALIDATION HELPER  (used by schema_validator.py)
# ═══════════════════════════════════════════════════════════════════

def validate_event(event: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Check that an event contains all required SOC fields."""
    missing = [f for f in REQUIRED_FIELDS if event.get(f) is None]
    return (len(missing) == 0), missing


class LogParser:
    """OOP wrapper for log parsing backward compatibility."""
    def parse(self, raw: Any) -> Optional[Dict[str, Any]]:
        if isinstance(raw, dict):
            return parse_log_entry(raw)
        elif isinstance(raw, str):
            results = parse_log_line(raw, use_ollama=False)
            if results and len(results) > 0:
                return results[0]
        return None


# # ═══════════════════════════════════════════════════════════════════
# # CLI / SMOKE TEST
# # ═══════════════════════════════════════════════════════════════════

#     model.fit(X)

#     scores = -model.score_samples(X)

#     # ✅ FIX: safe normalization
#     denom = (scores.max() - scores.min())
#     if denom == 0:
#         scores = np.full(len(scores), 0.5)
#     else:
#         scores = (scores - scores.min()) / denom
#         return scores

# # ─────────────────────────────────────────────────────────
# # IDENTITY
# # ─────────────────────────────────────────────────────────
# _USER_IP = {}

# def assign_identity(i, attack_cat):
#     user = f"user_{i % 1000}"

#     if user not in _USER_IP:
#         _USER_IP[user] = f"10.0.0.{(i % 254)+1}"

#     return user, _USER_IP[user], f"device_{i % 200}"

# # ─────────────────────────────────────────────────────────
# # GEO (FIXED CONSISTENCY)
# # ─────────────────────────────────────────────────────────
# CITIES = [
#     ("Pune", 18.52, 73.85),
#     ("Mumbai", 19.07, 72.87),
#     ("Delhi", 28.61, 77.20),
#     ("Bangalore", 12.97, 77.59),
# ]

# def generate_geo(ip, user):
#     if user not in USER_GEO:
#         USER_GEO[user] = random.choice(CITIES)

#     city = USER_GEO[user]

#     return {
#         "country": "IN",
#         "city": city[0],
#         "lat": city[1],
#         "lon": city[2]
#     }

# # ─────────────────────────────────────────────────────────
# # CONFIDENCE
# # ─────────────────────────────────────────────────────────
# def compute_confidence(label, score):
#     try:
#         label = int(label)
#     except:
#         return 0.5

#     if label == 1:
#         return round(0.7 + score * 0.3, 2)

#     return round(0.3 * (1 - score), 2)

# # ─────────────────────────────────────────────────────────
# # BUILD EVENTS (FIXED LOOP)
# # ─────────────────────────────────────────────────────────
# def build_events(df, scores):
#     events = []

#     for i, (idx, row) in enumerate(df.iterrows()):   # ✅ FIXED
#         user, ip, device = assign_identity(i, row.get("attack_cat", "Normal"))

#         delta = random.randint(1, 10)
#         ts = BASE_TIMESTAMP + timedelta(seconds=i * delta)

#         session_id = f"sess_{user}_{i//10}"

#         text = flow_to_text(row, user, ip)
#         enrich = cached_enrich(text, row.get("attack_cat", "Normal"))

#         event = {
#             "timestamp": ts.isoformat() + "Z",
#             "event_id": f"evt_{i}",

#             "user_id": user,
#             "src_ip": ip,
#             "device_id": device,
#             "session_id": session_id,

#             "geo_location": generate_geo(ip, user),

#             "event_type": "network_session",
#             "protocol": row.get("proto"),
#             "resource": row.get("service"),

#             "bytes_transferred": int(row.get("sbytes", 0)),
#             "bytes_received": int(row.get("dbytes", 0)),

#             "session_duration": float(row.get("dur", 0)),

#             "attack_category": row.get("attack_cat"),
#             "label": int(row.get("label", 0)),

#             "mitre_id": enrich.get("mitre_id"),
#             "threat_type": enrich.get("threat_type"),
#             "action": enrich.get("action"),

#             "flow_description": text,

#             "anomaly_score": round(scores[i], 4),
#             "confidence": compute_confidence(row.get("label"), scores[i]),
#         }

#         events.append(event)

#     return events

# # ─────────────────────────────────────────────────────────
# # MAIN PIPELINE
# # ─────────────────────────────────────────────────────────
# def run_pipeline():
#     log.info("START PIPELINE")

#     df = load_and_clean(TRAINING_CSV, TESTING_CSV)
#     log.info(f"Total rows: {len(df)}")

#     scores = compute_anomaly(df)

#     events = build_events(df, scores)

#     os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

#     with open(OUTPUT_JSON, "w") as f:
#         json.dump(events, f, indent=2)

#     log.info(f"Saved → {OUTPUT_JSON}")
#     log.info("PIPELINE COMPLETE")

# # ─────────────────────────────────────────────────────────
# # ENTRY
# # ─────────────────────────────────────────────────────────
# if __name__ == "__main__":
#     import sys
#     logging.basicConfig(level=logging.INFO,
#                         format="%(levelname)s | %(name)s | %(message)s")

#     print("=" * 70)
#     print("CRYPTIX Log Parser — Smoke Test")
#     print("=" * 70)

#     test_cases = [
#         ("JSON LOGIN_SUCCESS",
#          '{"event_id":"abc-123","timestamp":"2026-03-24T10:00:00","log_source":"IAM",'
#          '"source":"IAM","event_type":"LOGIN_SUCCESS","severity":"LOW",'
#          '"entity_id":"ENT-004","resolved_user":"priya.sharma","src_ip":"192.168.1.104",'
#          '"session_id":"SES-A1B2C3","risk_flag":"normal"}'),
#         ("EC-01 Truncated JSON",
#          '{"event_type":"LOGIN_FAILURE","resolved_user":"john.doe","src_ip":"203.0.113.5"'),
#         ("EC-02 JSON array",
#          '[{"event_type":"LOGIN_SUCCESS","resolved_user":"sara.khan","log_source":"IAM"},'
#          '{"event_type":"ALERT","log_source":"SIEM","severity":"HIGH"}]'),
#         ("EC-16 usr/evt/ip_addr aliases",
#          '{"usr":"mike.ross","evt":"PORT_SCAN","ip_addr":"192.168.1.103","log_source":"FIREWALL"}'),
#         ("KV format",
#          'user="mike.ross" event_type="PORT_SCAN" src_ip="192.168.1.103" log_source="FIREWALL" severity="HIGH"'),
#         ("CSV format",
#          "evt-001,2026-03-24T10:11:22,EDR,EDR,endpoint,MALICIOUS_PROCESS,endpoint,"
#          "CRITICAL,4,ENT-009,david.lee,EMP-109,Finance,trader,WS-FIN-09,WS-FIN-09,"
#          "192.168.1.109,SES-XYZ,high"),
#         ("Raw syslog",
#          "[2026-03-24T03:14:22] User emp_104 triggered privilege_escalation "
#          "from 185.220.101.45 on core-banking"),
#         ("EC-16 garbage values",
#          '{"event_type": null, "timestamp": "abc-garbage", "usr": "emp_101"}'),
#         ("EC-03 Blank line",
#          "   "),
#         ("Unknown event_type",
#          '{"event_type":"quantum_attack","resolved_user":"hacker","src_ip":"1.2.3.4","log_source":"SIEM"}'),
#     ]

#     for name, line in test_cases:
#         print(f"\n{'─'*70}")
#         print(f"  TEST: {name}")
#         print(f"  INPUT: {line[:90]}{'...' if len(line)>90 else ''}")
#         results = parse_log_line(line, use_ollama=False)
#         if results is None:
#             print("  OUTPUT: None (blank line — expected)")
#             continue
#         for i, r in enumerate(results):
#             print(f"  EVENT[{i}]:")
#             for f in ["event_type","event_category","severity","entity_id",
#                       "resolved_user","session_id","_format","_parser_confidence",
#                       "_ingestion_time"]:
#                 if f in r:
#                     print(f"    {f:<25} = {r[f]}")
#             det = r.get("details")
#             if det and isinstance(det, dict) and det.get("original_event_type"):
#                 print(f"    {'original_event_type':<25} = {det['original_event_type']}")
#         valid, missing = validate_event(r)
#         status = "✅ VALID" if valid else f"⚠️  MISSING: {missing}"
#         print(f"  SCHEMA: {status}")

#     print(f"\n{'='*70}")
#     print("Smoke test complete.")
