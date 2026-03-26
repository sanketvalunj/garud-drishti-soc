"""Normalize Avantika's security events into GARUD-DRISHTI canonical events."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_INPUT = REPO_ROOT / "garud_drishti/data/normalized_events/normalized_events.json"
DEFAULT_OUTPUT = REPO_ROOT / "garud_drishti/data/normalized_events/vishvesh_normalized_events.json"
DEFAULT_CATALOG = REPO_ROOT / "garud_drishti/correlation_engine/config/normalized_event_catalog.json"


def load_catalog(catalog_path: str | Path = DEFAULT_CATALOG) -> dict[str, dict[str, Any]]:
    """Load the canonical event catalog used for event-code normalization."""

    path = Path(catalog_path)
    if not path.exists():
        raise FileNotFoundError(f"Normalized event catalog not found: {path}")

    with open(path, encoding="utf-8") as handle:
        catalog = json.load(handle)

    if not isinstance(catalog, dict):
        raise ValueError("Normalized event catalog must be a JSON object.")

    return {str(key).strip().lower(): value for key, value in catalog.items()}


def load_raw_logs(input_path: str | Path) -> list[dict[str, Any]]:
    """Load raw or semi-normalized JSON events from disk."""

    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Input event file not found: {path}")

    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list):
        raise ValueError("Input event file must contain a JSON array of events.")

    return [row for row in payload if isinstance(row, dict)]


def _clean_text(value: Any, *, lowercase: bool = False) -> str:
    text = "" if value is None else str(value).strip()
    if text.lower() in {"", "nan", "none", "null"}:
        return ""
    return text.lower() if lowercase else text


def _coalesce(event: dict[str, Any], keys: list[str], default: str = "") -> str:
    for key in keys:
        value = event.get(key)
        cleaned = _clean_text(value)
        if cleaned:
            return cleaned
    return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _parse_login_hour(timestamp: str) -> tuple[int | None, bool]:
    if not timestamp:
        return None, False

    for parser in (datetime.fromisoformat,):
        try:
            dt_value = parser(timestamp.replace("Z", "+00:00"))
            return dt_value.hour, bool(dt_value.hour < 6 or dt_value.hour >= 22)
        except ValueError:
            continue

    return None, False


def _normalize_unknown_device(device_id: str) -> str | None:
    lowered = device_id.strip().lower()
    if lowered in {"", "unknown", "none", "null", "nan", "n/a"}:
        return None
    return device_id.strip()


def _derive_asset_id(event: dict[str, Any], device_id: str | None) -> str:
    direct_asset = _coalesce(event, ["asset_id", "asset", "resource", "dest_ip", "file_path"])
    if direct_asset:
        return direct_asset
    return device_id or "unknown_asset"


def _severity_score(event: dict[str, Any], mapped_severity: str) -> int:
    existing_score = event.get("severity_score")
    if existing_score not in (None, ""):
        return _safe_int(existing_score, 0)

    defaults = {
        "critical": 4,
        "high": 3,
        "medium": 2,
        "low": 1,
        "info": 0,
    }
    return defaults.get(mapped_severity.lower(), 1)


def _compute_event_hash(parts: list[str]) -> str:
    payload = "|".join(parts)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def normalize_event(
    event: dict[str, Any],
    catalog: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Normalize a single event into the canonical Vishvesh schema."""

    raw_event_type = _coalesce(event, ["event_type", "raw_event_type", "action"], default="unknown").lower()
    mapping = catalog.get(raw_event_type, catalog.get("__default__", {}))

    timestamp = _coalesce(event, ["timestamp"])
    if not timestamp:
        raise ValueError("Event missing required timestamp field.")

    source_system = _coalesce(event, ["source_system", "log_source", "source", "source_type"], default="unknown")
    user_id = _coalesce(
        event,
        ["user_id", "resolved_user", "user", "employee_id", "entity_id"],
        default="unknown_user",
    )
    entity_id = _coalesce(event, ["entity_id", "employee_id", "user_id"], default="")
    src_ip = _coalesce(event, ["src_ip", "source_ip", "ip"], default="unknown_ip")
    device_id = _normalize_unknown_device(
        _coalesce(event, ["device_id", "device", "workstation"], default="")
    )
    asset_id = _derive_asset_id(event, device_id)
    session_id = _coalesce(event, ["session_id"], default="no_session")
    severity = _coalesce(event, ["severity"], default=_clean_text(mapping.get("severity", "low"))).lower()
    event_code = _clean_text(mapping.get("event_code", "unknown.event")).lower()
    event_category = _coalesce(
        event,
        ["event_category", "source_type"],
        default=_clean_text(mapping.get("event_category", "unknown")).lower(),
    ).lower()
    event_outcome = _coalesce(event, ["event_outcome"], default=_clean_text(mapping.get("event_outcome", "unknown")).lower()).lower()
    risk_flag = _coalesce(event, ["risk_flag"], default="normal").lower()
    login_hour, night_login = _parse_login_hour(timestamp)
    severity_score = _severity_score(event, severity)

    event_id = _coalesce(event, ["event_id"], default="")
    event_hash = _coalesce(event, ["event_hash", "_event_hash"], default="")
    if not event_hash:
        event_hash = _compute_event_hash(
            [
                event_id or "no-id",
                timestamp,
                user_id,
                src_ip,
                session_id,
                event_code,
                source_system.lower(),
            ]
        )

    return {
        "event_id": event_id or event_hash,
        "timestamp": timestamp,
        "user_id": user_id,
        "entity_id": entity_id,
        "src_ip": src_ip,
        "device_id": device_id,
        "asset_id": asset_id,
        "session_id": session_id,
        "source_system": source_system,
        "raw_event_type": raw_event_type,
        "event_code": event_code,
        "event_category": event_category,
        "event_outcome": event_outcome,
        "severity": severity,
        "severity_score": severity_score,
        "risk_flag": risk_flag,
        "login_hour": login_hour,
        "night_login": night_login,
        "event_hash": event_hash,
        "dest_ip": _coalesce(event, ["dest_ip"]),
        "resource": _coalesce(event, ["resource"]),
        "file_path": _coalesce(event, ["file_path"]),
        "process_name": _coalesce(event, ["process", "process_name"]),
        "department": _coalesce(event, ["department"]),
        "role": _coalesce(event, ["role"]),
        "duplicate_detected": bool(event.get("_duplicate_detected", False)),
        "original_event_id": _coalesce(event, ["_original_event_id"]),
        "source_file": _coalesce(event, ["_source_file"]),
        "ingestion_time": _coalesce(event, ["_ingestion_time"]),
        "raw_event": event,
    }


def normalize_events(
    events: list[dict[str, Any]],
    catalog_path: str | Path = DEFAULT_CATALOG,
) -> list[dict[str, Any]]:
    """Normalize a list of events using the shared canonical catalog."""

    catalog = load_catalog(catalog_path)
    normalized: list[dict[str, Any]] = []

    for event in events:
        try:
            normalized.append(normalize_event(event, catalog))
        except ValueError:
            continue

    return normalized


def write_normalized_events(events: list[dict[str, Any]], output_path: str | Path) -> Path:
    """Write normalized events to disk."""

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(events, handle, indent=2)
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize GARUD-DRISHTI events into canonical correlation schema.")
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help="Path to the source Avantika event JSON file.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Path to write the canonical Vishvesh-normalized JSON file.",
    )
    parser.add_argument(
        "--catalog",
        default=str(DEFAULT_CATALOG),
        help="Path to the normalized event catalog JSON file.",
    )
    args = parser.parse_args()

    raw_logs = load_raw_logs(args.input)
    normalized = normalize_events(raw_logs, args.catalog)
    output_path = write_normalized_events(normalized, args.output)

    print("GARUD-DRISHTI event normalization completed")
    print(f"Input records   : {len(raw_logs)}")
    print(f"Output records  : {len(normalized)}")
    print(f"Catalog used    : {Path(args.catalog)}")
    print(f"Written to      : {output_path}")


if __name__ == "__main__":
    main()
