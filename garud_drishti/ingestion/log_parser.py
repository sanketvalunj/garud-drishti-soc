"""
Garud-Drishti — AI SOC Platform
Log Parser

Parses raw logs in four formats:
  JSON | Key-Value | CSV | Raw text

Edge cases fixed:
  EC-01: Truncated/malformed JSON that starts with '{' now falls back
         to the raw-text parser instead of silently returning None.
"""

import json
import re
import csv
import io
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

CSV_FIELDS = [
    "timestamp", "user", "device", "asset", "ip",
    "event_type", "source", "severity", "session_id",
    "mitre_technique", "mitre_tactic", "geo_country", "geo_risk",
    "network_zone", "asset_criticality", "threat_score", "user_risk_score",
    "attack_chain",
]


# ---------------------------------------------------------------------------
# Individual format parsers
# ---------------------------------------------------------------------------

def parse_json(line: str) -> Optional[Dict[str, Any]]:
    """Parse a JSON log line. Returns None only on truly empty input."""
    try:
        data = json.loads(line.strip())
        if isinstance(data, dict):
            return data
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def parse_kv(line: str) -> Optional[Dict[str, Any]]:
    """Parse key=value log line. Handles quoted and unquoted values."""
    result: Dict[str, Any] = {}
    pattern = re.compile(r'(\w+)=(?:"([^"]*?)"|(\S+))')
    for key, quoted, bare in pattern.findall(line):
        result[key] = quoted if quoted else bare
    return result if result else None


def parse_csv(line: str, header: List[str] = None) -> Optional[Dict[str, Any]]:
    """Parse a CSV log line using the known field list."""
    fields   = header or CSV_FIELDS
    stripped = line.strip()
    if stripped.startswith("timestamp"):      # skip header row
        return None
    try:
        reader = csv.reader(io.StringIO(stripped))
        row = next(reader, None)
        if row:
            return {fields[i]: row[i] for i in range(min(len(fields), len(row)))}
    except Exception:
        pass
    return None


_RAW_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"\[(?P<timestamp>[^\]]+)\]\s+User\s+(?P<user>\S+)\s+triggered\s+(?P<event_type>\S+)"
        r"\s+from\s+(?P<ip>\S+)\s+on\s+(?P<asset>\S+)"
    ),
    re.compile(r"User\s+(?P<user>\S+)\s+(?P<event_type>login[\w_]+)\s+from\s+(?P<ip>\S+)"),
    re.compile(r"(?P<user>emp_\d+)\s+performed\s+(?P<event_type>\S+)\s+on\s+(?P<asset>\S+)"),
    re.compile(
        r"(?:ALERT|WARN|INFO|ERROR):\s+(?P<event_type>\S+)\s+detected\s+for\s+(?P<user>emp_\d+)"
    ),
]


def parse_raw(line: str) -> Optional[Dict[str, Any]]:
    """Pattern-match free-text log lines. Always returns at least a minimal dict."""
    stripped = line.strip()
    for pattern in _RAW_PATTERNS:
        m = pattern.search(stripped)
        if m:
            result = m.groupdict()
            result.update({"_raw": stripped, "source": "RAW"})
            return result
    return {"_raw": stripped, "source": "RAW", "event_type": "unknown"}


# ---------------------------------------------------------------------------
# Auto-detecting dispatcher
# ---------------------------------------------------------------------------

def detect_format(line: str) -> str:
    stripped = line.strip()
    if stripped.startswith("{"):
        return "json"
    if re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2},", stripped):
        return "csv"
    if re.search(r'\w+=(?:"[^"]*"|\S+)', stripped) and "=" in stripped:
        return "kv"
    return "raw"


def parse_log_line(line: str) -> Optional[Dict[str, Any]]:
    """
    Auto-detect format and parse a single log line.

    EC-01 fix: Lines that start with '{' are tried as JSON first.
    If JSON parsing fails (truncated, malformed), the line is retried
    with the raw-text parser rather than being silently dropped.
    """
    if not line.strip():
        return {"_raw": "", "source": "RAW", "event_type": "unknown", "_format": "raw"}

    fmt = detect_format(line)

    parsers = {"json": parse_json, "kv": parse_kv, "csv": parse_csv, "raw": parse_raw}
    result  = parsers[fmt](line)

    # EC-01: JSON parse failed on a {-prefixed line — fall back to raw parser
    if result is None and fmt == "json":
        logger.debug("JSON parse failed, falling back to raw parser: %.120s", line)
        result = parse_raw(line)
        if result:
            result["_format"]       = "raw"
            result["_json_fallback"] = True
            return result

    if result is not None:
        result["_format"] = fmt
    else:
        logger.debug("Failed to parse line [fmt=%s]: %.120s", fmt, line)

    return result


def parse_file(path: str, encoding: str = "utf-8") -> List[Dict[str, Any]]:
    """Parse all log lines from a file. Skips blank lines."""
    parsed, errors = [], 0
    with open(path, "r", encoding=encoding, errors="replace") as fh:
        for lineno, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            result = parse_log_line(line)
            if result:
                result.update({"_source_file": path, "_line": lineno})
                parsed.append(result)
            else:
                errors += 1
    logger.info("Parsed %d lines from %s (%d errors)", len(parsed), path, errors)
    return parsed


if __name__ == "__main__":
    samples = [
        # Valid JSON
        '{"timestamp":"2026-03-15T10:11:22","user":"emp_101","event_type":"login_success","source":"IAM"}',
        # Truncated JSON (EC-01) — should fall back to raw
        '{"user":"emp_101","event_type":"login_failed"',
        # KV
        'user="emp_102" event_type="login_failed" ip="149.178.148.81" source="IAM"',
        # CSV
        '2026-03-15T10:11:22,emp_103,hr-desktop,,10.0.0.5,data_access,APP,medium,abc123',
        # Raw text
        '[2026-03-15T10:11:22] User emp_104 triggered privilege_escalation from 10.0.0.5 on auth-server',
    ]
    for s in samples:
        r = parse_log_line(s)
        print(f"fmt={r.get('_format'):4s} fallback={r.get('_json_fallback',False)}  "
              f"event={r.get('event_type')} user={r.get('user')}")