"""
CRYPTIX — GARUD-DRISHTI
ingestion/schema_validator.py

RESPONSIBILITY: VALIDATION ONLY
─────────────────────────────────
Validate and auto-repair events received from schema_mapper.
No parsing, no mapping, no crash-handling.

Strict Schema Enforcement (Fix #6):
    Every output event MUST contain:
    ✔ event_id       ✔ timestamp     ✔ entity_id
    ✔ user           ✔ session_id    ✔ event_type
    ✔ event_category ✔ source        ✔ severity
    ✔ details

Auto-Repair Guarantee:
    - Bad severity     → "low"   (never removed)
    - Bad timestamp    → UTC now (never removed)
    - Null event_type  → "unknown" + original saved to details
    - Duplicate event_id → new UUID
    - Missing entity_id  → synthesised from user
    - All floats coerced → float (ES-safe)
    - geo_location always → {country, city, lat, lon}

Deduplication (Fix #5):
    event_hash = stable hash of (entity_id, timestamp, event_type, src_ip)
    Duplicate hashes → event_id regenerated + _duplicate_detected flag

Validation result shape:
    {
      "valid":    bool,
      "errors":   List[str],   # critical issues remaining after repair
      "warnings": List[str],   # auto-repaired issues
      "event":    Dict,        # always fully valid after validate()
    }
"""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

# Fix #6: Strict 10-field minimum schema
REQUIRED_FIELDS: Tuple[str, ...] = (
    "event_id",
    "timestamp",
    "entity_id",
    "user",
    "session_id",
    "event_type",
    "event_category",
    "source",
    "severity",
    "details",
)

FULL_SCHEMA_FIELDS: Tuple[str, ...] = (
    "event_id", "timestamp", "log_source", "source", "source_type",
    "event_type", "event_category", "severity", "severity_score",
    "entity_id", "resolved_user", "employee_id", "department", "role",
    "device_id", "workstation", "src_ip", "session_id", "risk_flag",
    "geo_location", "user", "details",
)

VALID_SEVERITIES: frozenset = frozenset({"info", "low", "medium", "high", "critical"})

VALID_CATEGORIES: frozenset = frozenset({
    "authentication", "identity", "detection", "audit",
    "network", "endpoint", "application", "unknown",
})

SEVERITY_SCORE_MAP: Dict[str, int] = {
    "info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4,
}

_TS_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}")
_NULL_STRINGS = {"", "none", "null", "n/a", "na", "undefined"}


# ─────────────────────────────────────────────────────────────
# Helpers (private — not imported by other modules)
# ─────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _is_null(val: Any) -> bool:
    if val is None:
        return True
    return str(val).strip().lower() in _NULL_STRINGS


def _coerce_float(val: Any, field: str) -> Tuple[float, bool]:
    if val is None:
        return 0.0, False
    if isinstance(val, float):
        return val, False
    try:
        return float(val), True
    except (ValueError, TypeError):
        logger.debug("Cannot cast %s=%r to float — defaulting to 0.0", field, val)
        return 0.0, True


def _validate_timestamp(ts: Any) -> Tuple[str, bool]:
    if _is_null(ts):
        return _now_iso(), True
    if isinstance(ts, (int, float)):
        try:
            return (
                datetime.utcfromtimestamp(float(ts)).strftime("%Y-%m-%dT%H:%M:%S"),
                True,
            )
        except (OSError, ValueError, OverflowError):
            return _now_iso(), True
    s = str(ts).strip()
    if _TS_PATTERN.match(s):
        return s[:19].replace(" ", "T"), False
    for fmt in (
        "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S", "%Y/%m/%d %H:%M:%S",
        "%Y%m%dT%H%M%S",
    ):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%dT%H:%M:%S"), True
        except ValueError:
            continue
    return _now_iso(), True


def _validate_severity(sev: Any) -> Tuple[str, int, bool]:
    if _is_null(sev):
        return "low", 1, True
    s = str(sev).strip().lower()
    if s in VALID_SEVERITIES:
        return s, SEVERITY_SCORE_MAP[s], False
    try:
        n     = int(float(s))
        rev   = {v: k for k, v in SEVERITY_SCORE_MAP.items()}
        label = rev.get(n, "low")
        return label, SEVERITY_SCORE_MAP[label], True
    except (ValueError, TypeError):
        pass
    return "low", 1, True


def _validate_event_id(eid: Any, seen_ids: Set[str]) -> Tuple[str, bool]:
    if _is_null(eid):
        new_id = str(uuid.uuid4())
        seen_ids.add(new_id)
        return new_id, True
    s = str(eid).strip()
    if s in seen_ids:
        new_id = str(uuid.uuid4())
        logger.debug("Duplicate event_id=%r → replacing with %r", s, new_id)
        seen_ids.add(new_id)
        return new_id, True
    seen_ids.add(s)
    return s, False


def _validate_event_category(category: Any, event_type: str) -> Tuple[str, bool]:
    if not _is_null(category):
        c = str(category).strip().lower()
        if c in VALID_CATEGORIES:
            return c, False
    et = str(event_type).lower()
    if any(k in et for k in ("login", "logout", "auth", "logon", "password", "mfa")):
        return "authentication", True
    if any(k in et for k in ("privilege", "identity", "role", "account")):
        return "identity", True
    if any(k in et for k in ("alert", "detect")):
        return "detection", True
    if any(k in et for k in ("process", "file", "registry", "usb", "endpoint", "malware")):
        return "endpoint", True
    if any(k in et for k in ("connection", "network", "firewall", "port", "scan", "transfer")):
        return "network", True
    if any(k in et for k in ("transaction", "banking", "payment")):
        return "application", True
    if any(k in et for k in ("audit", "activity")):
        return "audit", True
    return "unknown", True


def _validate_entity_id(event: Dict[str, Any]) -> Tuple[str, bool]:
    """
    Fix #1 CRITICAL: entity_id normalisation.
    entity_id ← entity_id | employee_id | user_id | user | resolved_user | "unknown"
    """
    for field in ("entity_id", "employee_id", "user_id"):
        val = event.get(field)
        if val and not _is_null(val):
            return str(val).strip(), False

    user = (
        event.get("user") or
        event.get("resolved_user") or
        ""
    )
    if user and not _is_null(user):
        synth = "ENT-" + hashlib.md5(str(user).encode()).hexdigest()[:8].upper()
        return synth, True

    return "ENT-UNKNOWN", True


def _build_event_hash(event: Dict[str, Any]) -> str:
    """
    Fix #5 DEDUPLICATION: stable hash for (entity_id, timestamp, event_type, src_ip).
    """
    parts = (
        str(event.get("entity_id", "")),
        str(event.get("timestamp", "")),
        str(event.get("event_type", "")),
        str(event.get("src_ip", "") or ""),
    )
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]


def _validate_geo(geo: Any) -> Dict[str, Any]:
    """Fix #8: geo_location always {country, city, lat, lon}."""
    if not isinstance(geo, dict):
        return {"country": "XX", "city": "Unknown", "lat": 0.0, "lon": 0.0}
    return {
        "country": geo.get("country") or "XX",
        "city"   : geo.get("city")    or "Unknown",
        "lat"    : float(geo.get("lat") or 0.0),
        "lon"    : float(geo.get("lon") or 0.0),
    }


# ─────────────────────────────────────────────────────────────
# Module-level trackers (reset per session)
# ─────────────────────────────────────────────────────────────

_SEEN_IDS:    Set[str] = set()
_SEEN_HASHES: Set[str] = set()


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def validate(
    event: Dict[str, Any],
    seen_ids:    Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
    strict:      bool = False,
) -> Dict[str, Any]:
    """
    Validate and auto-repair a single event dict.

    Args:
        event       : Event dict to validate. Copy is returned — original unmodified.
        seen_ids    : External set for cross-call duplicate event_id detection.
        seen_hashes : External set for content-based deduplication (Fix #5).
        strict      : If True, raises ValueError when required fields still missing.

    Returns:
        {
          "valid":    bool,
          "errors":   List[str],
          "warnings": List[str],
          "event":    Dict,      # always fully valid after validate()
        }
    """
    _id_set   = seen_ids    if seen_ids    is not None else _SEEN_IDS
    _hash_set = seen_hashes if seen_hashes is not None else _SEEN_HASHES

    errors:   List[str] = []
    warnings: List[str] = []
    e: Dict[str, Any]   = dict(event)   # work on a copy; never mutate input

    # ── 1. event_id (with duplicate detection) ───────────────────────
    eid, repaired = _validate_event_id(e.get("event_id"), _id_set)
    if repaired:
        warnings.append(f"event_id missing/duplicate → assigned '{eid}'")
    e["event_id"] = eid

    # ── 2. timestamp ─────────────────────────────────────────────────
    ts, repaired = _validate_timestamp(e.get("timestamp"))
    if repaired:
        warnings.append(f"timestamp '{e.get('timestamp')}' invalid/missing → set to '{ts}'")
    e["timestamp"] = ts

    # ── 3. severity ──────────────────────────────────────────────────
    sev, score, repaired = _validate_severity(e.get("severity"))
    if repaired:
        warnings.append(f"severity '{e.get('severity')}' → normalised to '{sev}'")
    e["severity"]       = sev
    e["severity_score"] = score

    # ── 4. event_type + original_event_type preservation (Fix #3) ────
    et_raw = e.get("event_type")
    if _is_null(et_raw):
        if et_raw is not None and str(et_raw).strip():
            # Preserve original in details
            e.setdefault("details", {})
            if isinstance(e.get("details"), dict):
                e["details"].setdefault("original_event_type", str(et_raw))
        e["event_type"] = "unknown"
        warnings.append("event_type missing/null → set to 'unknown'")
    else:
        e["event_type"] = str(et_raw).strip()

    et = e["event_type"]

    # ── 5. event_category ────────────────────────────────────────────
    cat, repaired = _validate_event_category(e.get("event_category"), et)
    if repaired:
        warnings.append(
            f"event_category '{e.get('event_category')}' invalid/missing → derived '{cat}'"
        )
    e["event_category"] = cat

    # ── 6. source / log_source ───────────────────────────────────────
    src_raw = e.get("source") or e.get("log_source")
    if _is_null(src_raw):
        src = "UNKNOWN"
        warnings.append("source missing/null → set to 'UNKNOWN'")
    else:
        src = str(src_raw).strip().upper()
    e["source"]     = src
    e["log_source"] = e.get("log_source") or src

    # ── 7. entity_id (Fix #1 CRITICAL) ───────────────────────────────
    eid_val, repaired = _validate_entity_id(e)
    if repaired:
        warnings.append(f"entity_id missing → synthesised as '{eid_val}'")
    e["entity_id"] = eid_val

    # ── 8. user field ──────────────────────────────────────────────
    if _is_null(e.get("user")):
        e["user"] = (
            e.get("resolved_user") or
            e.get("username") or
            "unknown"
        )

    # ── 9. session_id (Fix #7, uses entity_id) ───────────────────────
    if _is_null(e.get("session_id")):
        ts13       = str(e["timestamp"])[:13]
        e["session_id"] = f"sess_{e['entity_id']}_{ts13}"
        warnings.append(f"session_id missing → generated '{e['session_id']}'")

    # ── 10. details — always a dict ──────────────────────────────────
    raw_details = e.get("details")
    if not isinstance(raw_details, dict):
        import json
        if isinstance(raw_details, str):
            try:
                raw_details = json.loads(raw_details)
            except Exception:
                raw_details = {"raw_details": raw_details}
        elif raw_details is None:
            raw_details = {}
        else:
            raw_details = {"value": raw_details}
    e["details"] = raw_details

    # ── 11. geo_location (Fix #8) ────────────────────────────────────
    e["geo_location"] = _validate_geo(e.get("geo_location"))

    # ── 12. Float coercions (Fix #9, ES-safe) ────────────────────────
    for float_field in ("anomaly_score", "confidence", "user_risk_score", "threat_score"):
        if float_field in e:
            val, coerced = _coerce_float(e[float_field], float_field)
            e[float_field] = round(val, 4)
            if coerced:
                warnings.append(f"{float_field} coerced to float: {val}")

    # ── 13. Fill missing full-schema defaults ─────────────────────────
    _DEFAULTS: Dict[str, Any] = {
        "log_source"    : src,
        "source_type"   : "unknown",
        "resolved_user" : e.get("user") or "unknown",
        "employee_id"   : "",
        "department"    : "",
        "role"          : "",
        "device_id"     : "unknown",
        "workstation"   : "unknown",
        "src_ip"        : None,
        "risk_flag"     : "normal",
    }
    for field, default in _DEFAULTS.items():
        if _is_null(e.get(field)):
            e[field] = default

    # ── 14. Fix #5 DEDUPLICATION ─────────────────────────────────────
    event_hash = _build_event_hash(e)
    if event_hash in _hash_set:
        old_eid = e["event_id"]
        e["event_id"]           = str(uuid.uuid4())
        e["_duplicate_detected"] = True
        e["_original_event_id"] = old_eid
        _id_set.add(e["event_id"])
        warnings.append(
            f"Duplicate content hash {event_hash} detected — event_id regenerated"
        )
    else:
        _hash_set.add(event_hash)
    e["_event_hash"] = event_hash

    # ── 15. Fix #10: data lineage — ensure always present ────────────
    if not e.get("_ingestion_time"):
        e["_ingestion_time"] = _now_iso()

    # ── 16. Final required-field check ───────────────────────────────
    for field in REQUIRED_FIELDS:
        if _is_null(e.get(field)):
            errors.append(f"REQUIRED FIELD STILL MISSING after repair: {field}")

    is_valid = len(errors) == 0

    if strict and not is_valid:
        raise ValueError(f"Validation failed: {errors}")

    if warnings:
        logger.debug("Validator repaired %s: %s", e["event_id"], "; ".join(warnings))
    if errors:
        logger.warning("Validator errors for %s: %s", e["event_id"], "; ".join(errors))

    return {
        "valid":    is_valid,
        "errors":   errors,
        "warnings": warnings,
        "event":    e,
    }


def validate_many(
    events:      List[Dict[str, Any]],
    seen_ids:    Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    """Validate a list; None entries skipped. Returns list of result dicts."""
    _id_set   = seen_ids    if seen_ids    is not None else set()
    _hash_set = seen_hashes if seen_hashes is not None else set()
    results   = []
    for ev in events:
        if ev is not None:
            results.append(validate(ev, seen_ids=_id_set, seen_hashes=_hash_set))
    return results


def extract_valid_events(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract repaired event dicts from validate_many() results."""
    return [r["event"] for r in results]


def reset_trackers() -> None:
    """Reset session-level ID/hash trackers (call between independent batches)."""
    global _SEEN_IDS, _SEEN_HASHES
    _SEEN_IDS    = set()
    _SEEN_HASHES = set()


# ─────────────────────────────────────────────────────────────
# Backward-compatible OOP interface
# ─────────────────────────────────────────────────────────────

class SchemaValidator:
    """OOP wrapper maintaining backward compatibility."""

    REQUIRED_FIELDS = REQUIRED_FIELDS

    def __init__(self) -> None:
        self._seen_ids:    Set[str] = set()
        self._seen_hashes: Set[str] = set()

    def validate(self, event: Dict[str, Any]) -> bool:
        """Simple bool validation for downstream legacy callers."""
        return validate(event, seen_ids=self._seen_ids, seen_hashes=self._seen_hashes)["valid"]

    def validate_full(self, event: Dict[str, Any]) -> Dict[str, Any]:
        return validate(event, seen_ids=self._seen_ids, seen_hashes=self._seen_hashes)

    def validate_many(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return validate_many(events, seen_ids=self._seen_ids, seen_hashes=self._seen_hashes)

    def reset(self) -> None:
        self._seen_ids    = set()
        self._seen_hashes = set()


# ─────────────────────────────────────────────────────────────
# CLI / Smoke Test
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json as _json
    logging.basicConfig(level=logging.DEBUG,
                        format="%(levelname)s | %(name)s | %(message)s")

    _seen_ids    = set()
    _seen_hashes = set()

    test_events = [
        # 1 — Perfect event with all 10 required fields
        {
            "event_id": "evt-001", "timestamp": "2026-03-24T10:00:00",
            "event_type": "login_success", "event_category": "authentication",
            "source": "IAM", "severity": "low",
            "entity_id": "ENT-004", "user": "priya.sharma",
            "session_id": "SES-ABC123", "details": {"logon_type": "interactive"},
        },
        # 2 — Missing ALL required fields → full repair
        {"event_type": "ALERT", "source": "SIEM"},
        # 3 — Null everything
        {"event_id": None, "timestamp": None, "event_type": None, "source": None},
        # 4 — Garbage timestamp + invalid severity
        {
            "event_id": "evt-004", "timestamp": "not-a-date",
            "event_type": "port_scan", "source": "FIREWALL",
            "severity": "super-critical", "entity_id": "ENT-007",
            "user": "raj.patel",
        },
        # 5 — Duplicate content hash (same entity/ts/type/ip)
        {
            "event_id": "evt-001-dup", "timestamp": "2026-03-24T10:00:00",
            "event_type": "login_success", "source": "IAM",
            "entity_id": "ENT-004", "user": "priya.sharma",
            "session_id": "SES-ABC123", "details": {},
        },
        # 6 — anomaly_score / confidence as strings
        {
            "event_id": "evt-006", "timestamp": "2026-03-24T12:00:00",
            "event_type": "transaction", "entity_id": "ENT-011",
            "source": "BANKING", "severity": "high",
            "user": "banking.user", "session_id": "SES-TXN01",
            "anomaly_score": "0.87", "confidence": "0.92",
            "details": {},
        },
        # 7 — Unknown event_type → preserve in details
        {
            "event_id": "evt-007", "timestamp": "2026-03-24T13:00:00",
            "event_type": "quantum_attack", "source": "SIEM",
            "entity_id": "ENT-099", "user": "unknown.user",
            "session_id": "SES-QA01",
        },
    ]

    print("=" * 70)
    print("  Schema Validator — Smoke Test (All 10 Fixes)")
    print("=" * 70)

    for i, ev in enumerate(test_events, 1):
        result = validate(ev, seen_ids=_seen_ids, seen_hashes=_seen_hashes)
        status = "✅ VALID" if result["valid"] else "❌ ERRORS"
        e      = result["event"]
        print(f"\n[Test {i:02d}] {status}")
        for w in result["warnings"][:3]:
            print(f"  ⚠  {w}")
        for err in result["errors"]:
            print(f"  🚨 {err}")
        fields_shown = [
            "event_id", "event_type", "entity_id", "user",
            "session_id", "event_category", "severity",
        ]
        for f in fields_shown:
            if f in e:
                print(f"  {f:<20} = {e[f]}")
        if e.get("_duplicate_detected"):
            print(f"  _duplicate_detected = True  hash={e.get('_event_hash')}")
        if isinstance(e.get("details"), dict) and e["details"].get("original_event_type"):
            print(f"  original_event_type  = {e['details']['original_event_type']}")
        geo = e.get("geo_location")
        if geo:
            print(f"  geo_location         = {geo}")

    print(f"\n{'='*70}")
    print("Smoke test complete.")
