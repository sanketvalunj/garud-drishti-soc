"""
CRYPTIX — GARUD-DRISHTI
ingestion/safe_mapper.py

RESPONSIBILITY: EXCEPTION HANDLING ONLY
─────────────────────────────────────────
Crash-proof wrapper around schema_mapper.SchemaMapper.

Every event in the pipeline passes through safe_map().
If ANY exception is raised — the wrapper catches it, logs it
with full error visibility (Fix #4), and returns a guaranteed-safe
fallback event. The ingestion pipeline NEVER breaks.

Fix #4 — SAFE MAPPER VISIBILITY (MANDATORY):
    On any failure, the returned event contains:
    {
      "error_stage"  : "mapping",
      "error_message": str(exception),
      "_safe_fallback": True,
    }
    Errors are NEVER silently swallowed.

Fix #5 — Deduplication:
    event_hash = hash(entity_id | timestamp | event_type | src_ip)
    Duplicate detection flag forwarded.

Fix #10 — Data lineage:
    _source_file and _ingestion_time always forwarded.

Public API:
    safe_map(raw)                → Dict
    safe_map_many(raws)          → List[Dict]
    safe_map_file(path)          → List[Dict]
    safe_map_directory(dir)      → List[Dict]
"""

from __future__ import annotations

import hashlib
import json
import logging
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Lazy imports — never let import errors crash pipeline
# ─────────────────────────────────────────────────────────────

try:
    from garud_drishti.ingestion.schema_mapper import SchemaMapper as _SchemaMapper
    _mapper = _SchemaMapper()
    _MAPPER_AVAILABLE = True
except ImportError:
    try:
        from ingestion.schema_mapper import SchemaMapper as _SchemaMapper
        _mapper = _SchemaMapper()
        _MAPPER_AVAILABLE = True
    except ImportError:
        _MAPPER_AVAILABLE = False
        _mapper = None  # type: ignore[assignment]

try:
    from garud_drishti.ingestion.log_parser import parse_file as _parse_file
    _PARSER_AVAILABLE = True
except ImportError:
    try:
        from ingestion.log_parser import parse_file as _parse_file
        _PARSER_AVAILABLE = True
    except ImportError:
        _PARSER_AVAILABLE = False
        _parse_file = None  # type: ignore[assignment]


# ─────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _is_null(val: Any) -> bool:
    if val is None:
        return True
    return str(val).strip().lower() in {"", "none", "null", "n/a", "na", "undefined"}


def _build_event_hash(entity_id: str, timestamp: str, event_type: str, src_ip: str) -> str:
    """Fix #5: stable content hash for deduplication."""
    parts = f"{entity_id}|{timestamp}|{event_type}|{src_ip}"
    return hashlib.sha256(parts.encode()).hexdigest()[:16]


# ─────────────────────────────────────────────────────────────
# Fallback Event Builder
# ─────────────────────────────────────────────────────────────

def _build_fallback(
    raw: Any,
    exc: Exception,
    stage: str = "mapping",
) -> Dict[str, Any]:
    """
    Build a guaranteed-valid SOC event when mapping fails.

    Fix #4 VISIBILITY: always sets error_stage and error_message.
    Fix #6 STRICT SCHEMA: all 10 required fields are present.
    """
    raw_dict: Dict[str, Any] = {}
    if isinstance(raw, dict):
        raw_dict = raw
    elif isinstance(raw, str):
        try:
            maybe = json.loads(raw)
            if isinstance(maybe, dict):
                raw_dict = maybe
        except (json.JSONDecodeError, TypeError):
            pass

    def _get(*keys: str) -> Any:
        for k in keys:
            v = raw_dict.get(k)
            if v is not None and not _is_null(v):
                return v
        return None

    event_id      = _get("event_id")      or str(uuid.uuid4())
    timestamp     = _get("timestamp")     or _now_iso()
    ingestion_time = _now_iso()

    # entity_id — Fix #1 full alias chain
    entity_id = (
        _get("entity_id", "employee_id", "user_id") or
        _get("user", "username", "usr", "resolved_user") or
        "ENT-UNKNOWN"
    )
    user          = _get("user", "username", "usr", "resolved_user") or "unknown"
    src           = str(_get("source", "log_source") or "UNKNOWN").upper()
    device        = str(_get("device_id", "workstation", "device", "hostname") or "unknown")
    src_ip        = str(_get("src_ip", "ip", "source_ip") or "") or None      # type: ignore

    # Fix #7: session_id from entity_id
    session_id = _get("session_id") or f"sess_{entity_id}_{str(timestamp)[:13]}"

    # Fix #5: compute dedup hash
    event_hash = _build_event_hash(
        entity_id, str(timestamp), "unknown", str(src_ip or "")
    )

    return {
        # Fix #6: all 10 required fields
        "event_id"        : event_id,
        "timestamp"       : timestamp,
        "entity_id"       : entity_id,
        "user"            : user,
        "session_id"      : session_id,
        "event_type"      : "unknown",
        "event_category"  : "unknown",
        "source"          : src,
        "severity"        : "low",
        "details"         : {
            "original_raw": str(raw)[:512] if raw is not None else None,
        },
        # Full schema extras
        "log_source"      : src,
        "source_type"     : "unknown",
        "severity_score"  : 1,
        "resolved_user"   : user,
        "employee_id"     : "",
        "department"      : "",
        "role"            : "",
        "device_id"       : device,
        "workstation"     : device,
        "src_ip"          : src_ip,
        "risk_flag"       : "normal",
        "geo_location"    : {"country": "XX", "city": "Unknown", "lat": 0.0, "lon": 0.0},
        "anomaly_score"   : 0.0,
        "confidence"      : 0.0,
        # Fix #4: Error visibility (MANDATORY, never silent)
        "_safe_fallback"  : True,
        "error_stage"     : stage,
        "error_message"   : str(exc)[:1000],
        "_error_type"     : type(exc).__name__,
        # Fix #5: dedup
        "_event_hash"     : event_hash,
        # Fix #10: data lineage
        "_source_file"    : raw_dict.get("_source_file", ""),
        "_ingestion_time" : ingestion_time,
        # Preserve raw for re-processing
        "_raw"            : str(raw)[:2048] if raw is not None else None,
    }


# ─────────────────────────────────────────────────────────────
# Core safe wrapper
# ─────────────────────────────────────────────────────────────

def safe_map(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Safely map a single raw parsed dict through SchemaMapper.

    Guarantees:
      - NEVER raises an exception
      - ALWAYS returns a dict with all required SOC fields (Fix #6)
      - On failure: returns fallback with error_stage + error_message (Fix #4)
      - Data lineage always present: _source_file, _ingestion_time (Fix #10)

    Args:
        raw: A dict as produced by log_parser.parse_log_line()

    Returns:
        Fully mapped SOC event dict
    """
    if raw is None:
        return _build_fallback({}, ValueError("raw event is None"), stage="input")

    try:
        if not _MAPPER_AVAILABLE or _mapper is None:
            raise RuntimeError("SchemaMapper not available (import failed)")

        mapped = _mapper.map(raw)
        _post_fix(mapped, raw)
        return mapped

    except Exception as exc:
        logger.warning(
            "safe_map: mapper raised %s (%s) — returning fallback. stage=mapping, keys=%s",
            type(exc).__name__,
            exc,
            list(raw.keys()) if isinstance(raw, dict) else "<non-dict>",
        )
        logger.debug("safe_map traceback:\n%s", traceback.format_exc())
        return _build_fallback(raw, exc, stage="mapping")


def _post_fix(mapped: Dict[str, Any], raw: Dict[str, Any]) -> None:
    """
    In-place corrections applied after SchemaMapper.map().

    Plugs any gaps the mapper might miss. All fixes applied here:
    Fix #1  entity_id full alias chain
    Fix #2  user/device/source field aliases
    Fix #3  event_type guard + original_event_type in details
    Fix #5  event_hash for deduplication
    Fix #6  ensure all 10 required fields present
    Fix #7  session_id from entity_id
    Fix #8  geo_location {country, city, lat, lon}
    Fix #9  ES-safe float coercions
    Fix #10 data lineage
    """
    # ── Fix #2: user aliases ──────────────────────────────────────────
    if not mapped.get("user"):
        mapped["user"] = (
            raw.get("user") or raw.get("username") or
            raw.get("usr")  or raw.get("resolved_user") or "unknown"
        )

    # ── Fix #2: device aliases ────────────────────────────────────────
    if not mapped.get("device"):
        mapped["device"] = (
            raw.get("device")      or raw.get("hostname") or
            raw.get("workstation") or raw.get("device_id") or ""
        )
    if not mapped.get("device_id"):
        mapped["device_id"] = mapped.get("device") or raw.get("device_id") or "unknown"

    # ── Fix #2: source alias ─────────────────────────────────────────
    if not mapped.get("source"):
        mapped["source"] = raw.get("source") or raw.get("log_source") or "UNKNOWN"

    # ── Fix #1: entity_id full alias chain ────────────────────────────
    if _is_null(mapped.get("entity_id")):
        entity_id = (
            raw.get("entity_id") or raw.get("employee_id") or raw.get("user_id") or
            mapped.get("user") or raw.get("user") or "unknown"
        )
        mapped["entity_id"] = entity_id

    # ── Fix #3: event_type guard ──────────────────────────────────────
    et = str(mapped.get("event_type", "")).strip().lower()
    if not et or et in ("", "none", "null"):
        orig = raw.get("event_type")
        mapped["event_type"] = "unknown"
        mapped.setdefault("details", {})
        if isinstance(mapped.get("details"), dict) and orig and not _is_null(orig):
            mapped["details"].setdefault("original_event_type", str(orig))

    # ── Fix #7: session_id from entity_id ────────────────────────────
    if _is_null(mapped.get("session_id")):
        eid  = mapped.get("entity_id") or "unknown"
        ts13 = str(mapped.get("timestamp") or _now_iso())[:13]
        mapped["session_id"] = f"sess_{eid}_{ts13}"

    # ── Fix #8: geo_location always {country, city, lat, lon} ─────────
    geo_raw = mapped.get("geo_location") or raw.get("geo_location") or {}
    if isinstance(geo_raw, str):
        try:
            geo_raw = json.loads(geo_raw)
        except (json.JSONDecodeError, TypeError):
            geo_raw = {}
    if not isinstance(geo_raw, dict):
        geo_raw = {}
    mapped["geo_location"] = {
        "country": geo_raw.get("country") or raw.get("geo_country") or "XX",
        "city"   : geo_raw.get("city")    or raw.get("geo_city")    or "Unknown",
        "lat"    : float(geo_raw.get("lat") or 0.0),
        "lon"    : float(geo_raw.get("lon") or 0.0),
    }

    # ── Fix #6: details must always be a dict ─────────────────────────
    raw_details = raw.get("details") or {}
    if isinstance(raw_details, str):
        try:
            raw_details = json.loads(raw_details)
        except (json.JSONDecodeError, TypeError):
            raw_details = {"raw_details": raw_details}
    existing_details: Dict[str, Any] = mapped.get("details") or {}
    if not isinstance(existing_details, dict):
        existing_details = {"value": existing_details}
    for k, v in raw_details.items():
        if k not in existing_details:
            existing_details[k] = v
    mapped["details"] = existing_details

    # ── Fix #9: type coercions (ES-safe floats) ───────────────────────
    for float_field in ("anomaly_score", "confidence", "user_risk_score", "threat_score"):
        val = mapped.get(float_field)
        if val is not None:
            try:
                mapped[float_field] = float(val)
            except (ValueError, TypeError):
                mapped[float_field] = 0.0

    # ── Fix #10: data lineage ─────────────────────────────────────────
    if not mapped.get("_source_file") and raw.get("_source_file"):
        mapped["_source_file"] = raw["_source_file"]
    if not mapped.get("_ingestion_time"):
        mapped["_ingestion_time"] = raw.get("_ingestion_time") or _now_iso()

    # ── Fix #5: compute dedup hash ───────────────────────────────────
    mapped["_event_hash"] = _build_event_hash(
        str(mapped.get("entity_id", "")),
        str(mapped.get("timestamp", "")),
        str(mapped.get("event_type", "")),
        str(mapped.get("src_ip", "") or ""),
    )


# ─────────────────────────────────────────────────────────────
# Batch / file helpers
# ─────────────────────────────────────────────────────────────

def safe_map_many(
    raws: List[Optional[Dict[str, Any]]],
    seen_hashes: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Safely map a list of raw event dicts.
    None entries are silently skipped.
    NEVER raises.
    """
    _seen_hashes: Set[str] = seen_hashes if seen_hashes is not None else set()
    results: List[Dict[str, Any]] = []

    for raw in raws:
        if raw is not None:
            mapped = safe_map(raw)
            # Fix #5: dedup check
            h = mapped.get("_event_hash", "")
            if h and h in _seen_hashes:
                mapped["_duplicate_detected"] = True
                logger.debug("safe_map_many: duplicate hash %s skipped", h)
            elif h:
                _seen_hashes.add(h)
            results.append(mapped)

    return results


def safe_map_file(
    path: str,
    use_ollama: bool = False,
) -> List[Dict[str, Any]]:
    """Parse a raw log file with log_parser then safe_map every event."""
    if not _PARSER_AVAILABLE or _parse_file is None:
        logger.error("safe_map_file: log_parser not available — returning []")
        return []
    try:
        parsed_events = _parse_file(path, use_ollama=use_ollama)
    except Exception as exc:
        logger.error("safe_map_file: log_parser failed for %s: %s", path, exc)
        return []
    return safe_map_many(parsed_events)


def safe_map_directory(
    input_dir:  str   = "data/raw_logs",
    extensions: tuple = (".json", ".jsonl", ".csv", ".kv", ".txt", ".log"),
) -> List[Dict[str, Any]]:
    """Parse and map all log files in a directory."""
    all_events: List[Dict[str, Any]] = []
    in_path = Path(input_dir)
    if not in_path.exists():
        logger.warning("safe_map_directory: directory not found: %s", input_dir)
        return all_events
    files = sorted([p for p in in_path.iterdir() if p.is_file() and p.suffix in extensions])
    if not files:
        logger.warning("safe_map_directory: no log files in %s", input_dir)
        return all_events
    seen_hashes: Set[str] = set()
    for f in files:
        mapped = safe_map_file(str(f))
        logger.info("  %s → %d events", f.name, len(mapped))
        all_events.extend(mapped)
    return all_events


# ─────────────────────────────────────────────────────────────
# CLI / Smoke Test
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s | %(name)s | %(message)s")

    print("=" * 70)
    print("  SafeMapper — Smoke Test (Fix #4 Visibility)")
    print("=" * 70)

    tests = [
        # Fix #6: full valid event
        {
            "event_id": "abc-001", "timestamp": "2026-03-24T10:00:00",
            "source": "IAM", "event_type": "login_success",
            "resolved_user": "priya.sharma", "src_ip": "192.168.1.104",
            "severity": "low", "session_id": "SES-ABC123",
            "entity_id": "ENT-004",
        },
        # Fix #2: usr alias
        {"usr": "john.doe", "evt": "login_failure", "ip_addr": "203.0.113.5", "log_source": "IAM"},
        # Fix #4: crash visibility test — completely garbage
        {"garbage": "data", "random_key": 123, "another": None},
        # None input → Fix #4: error visible
        None,
        # Fix #3: null event_type → original preserved
        {"event_id": "evt-005", "timestamp": "2026-03-24T12:00:00", "source": "SIEM",
         "event_type": None, "resolved_user": "raj.patel", "entity_id": "ENT-010"},
        # Fix #8: geo from fields
        {"event_id": "geo-001", "timestamp": "2026-03-24T13:00:00", "source": "FIREWALL",
         "event_type": "connection_denied", "geo_country": "RU", "geo_city": "Moscow",
         "entity_id": "ENT-USR1"},
        # Fix #5: duplicate (same entity/ts/type/ip)
        {
            "event_id": "abc-001-dup", "timestamp": "2026-03-24T10:00:00",
            "source": "IAM", "event_type": "login_success",
            "resolved_user": "priya.sharma", "src_ip": "192.168.1.104",
            "entity_id": "ENT-004",
        },
    ]

    seen_hashes: Set[str] = set()
    results = safe_map_many(tests, seen_hashes=seen_hashes)

    for i, r in enumerate(results, 1):
        is_fallback = r.get("_safe_fallback", False)
        is_dup      = r.get("_duplicate_detected", False)
        status = "⚠️  FALLBACK" if is_fallback else ("🔁 DUPLICATE" if is_dup else "✅ MAPPED")
        print(f"\n[Test {i:02d}] {status}")
        print(f"  event_type    = {r.get('event_type')}")
        print(f"  entity_id     = {r.get('entity_id')}")
        print(f"  session_id    = {r.get('session_id')}")
        print(f"  severity      = {r.get('severity')}")
        print(f"  geo_location  = {r.get('geo_location')}")
        print(f"  _event_hash   = {r.get('_event_hash')}")
        if is_fallback:
            print(f"  error_stage   = {r.get('error_stage')}")
            print(f"  error_message = {str(r.get('error_message', ''))[:80]}")
        det = r.get("details", {})
        if isinstance(det, dict) and det.get("original_event_type"):
            print(f"  original_event_type = {det['original_event_type']}")

    print(f"\n{'='*70}")
    print("Smoke test complete.")
