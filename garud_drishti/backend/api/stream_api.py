from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json
from collections import Counter
from pathlib import Path
from datetime import datetime
from typing import Optional

router = APIRouter()

# --------------------------------------------------------------------------------------
# Load demo logs once and stream them via SSE.
# Dashboard expects: {timestamp, event_type, user, asset, severity, source_ip, ...}
# --------------------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEMO_LOGS_PATH = _PROJECT_ROOT / "garud_drishti" / "data" / "raw_logs" / "demo_logs.json"


def _normalize_severity(severity: Optional[str]) -> str:
    """
    Map raw severities in demo_logs.json (LOW/MEDIUM/INFO/HIGH/CRITICAL) into
    buckets the UI understands (critical/high/warning/info).
    """
    raw = (severity or "info").strip().lower()
    if raw in {"critical"}:
        return "critical"
    if raw in {"high"}:
        return "high"
    if raw in {"medium"}:
        return "warning"
    # Includes "low" and "info" and anything unknown.
    return "info"


def _load_demo_logs() -> list[dict]:
    if not _DEMO_LOGS_PATH.exists():
        return []
    with open(_DEMO_LOGS_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    if isinstance(payload, list):
        return payload
    return []


_DEMO_LOGS: list[dict] = _load_demo_logs()
_DEMO_LOGS_SORTED: list[dict] = sorted(
    _DEMO_LOGS,
    key=lambda x: str(x.get("timestamp") or ""),
)
_DEMO_LOG_COUNT = len(_DEMO_LOGS_SORTED)

_SEVERITY_COUNTS = Counter(
    _normalize_severity(e.get("severity"))
    for e in _DEMO_LOGS_SORTED
)


async def event_generator():
    """
    Stream real demo logs from disk instead of random simulated events.
    """
    if not _DEMO_LOGS_SORTED:
        # Keep the SSE connection alive but idle.
        while True:
            await asyncio.sleep(2.0)
        # unreachable

    idx = 0
    while True:
        event = _DEMO_LOGS_SORTED[idx]
        idx = (idx + 1) % _DEMO_LOG_COUNT

        user = event.get("resolved_user") or event.get("user") or event.get("entity_id") or "unknown"
        asset = (
            event.get("workstation")
            or event.get("device_id")
            or event.get("asset_id")
            or event.get("file_path")
            or "unknown"
        )
        src_ip = event.get("src_ip") or ""
        source = event.get("source") or event.get("log_source") or "unknown"

        raw_sev = event.get("severity") or event.get("severity_level") or "info"
        sev = _normalize_severity(str(raw_sev))

        event_data = {
            "event_id": event.get("event_id"),
            "timestamp": event.get("timestamp") or datetime.now().isoformat(),
            "event_type": event.get("event_type") or "event",
            "event_category": event.get("event_category") or "",
            "user": user,
            "asset": asset,
            "severity": sev,
            "source_ip": src_ip,
            "entity_id": event.get("entity_id") or "",
            "source": source,
        }

        yield f"data: {json.dumps(event_data)}\n\n"

        # Small delay to make the stream visually “live”.
        await asyncio.sleep(0.8)


@router.get("/stream-events")
async def stream_events():
    """
    Server-Sent Events (SSE) endpoint for live SOC monitoring.
    """
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/demo-logs-count")
async def demo_logs_count():
    """
    Used by the dashboard to show total event count based on demo_logs.json.
    """
    return {"count": _DEMO_LOG_COUNT, "by_severity": dict(_SEVERITY_COUNTS)}
