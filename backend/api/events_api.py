"""
Garud-Drishti SOC — Events API
================================
FastAPI router for querying security events.

Endpoints:
  GET  /events                    — All events (paginated)
  GET  /events/{user}             — Events by user
  GET  /events/asset/{asset}      — Events by asset
  GET  /events/type/{event_type}  — Events by type
  GET  /events/severity/{level}   — Events by severity
  GET  /events/timeline           — Chronological timeline for a user
  GET  /events/stats              — Overall statistics
  GET  /events/analytics/top-attacked-assets
  GET  /events/analytics/failed-logins
  GET  /events/analytics/user-activity
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional

router = APIRouter(prefix="/events", tags=["Events"])

# Global reference — set by main.py during startup
_indexer = None


def set_indexer(indexer):
    """Set the shared EventIndexer instance."""
    global _indexer
    _indexer = indexer


def get_indexer():
    """Get the shared EventIndexer instance."""
    if _indexer is None:
        raise HTTPException(status_code=503, detail="Event indexer not initialized")
    return _indexer


# ─────────────────────────────────────────────
# GET /events — List all events
# ─────────────────────────────────────────────

@router.get("")
@router.get("/")
def get_events(
    size: int = Query(default=200, ge=1, le=5000, description="Max events to return"),
    source: Optional[str] = Query(default=None, description="Filter by source (IAM/EDR/FIREWALL/APP)"),
    severity: Optional[str] = Query(default=None, description="Filter by severity"),
):
    """Return all security events with optional filters."""
    indexer = get_indexer()

    if severity:
        events = indexer.get_events_by_severity(severity, size)
    elif source:
        events = indexer.search_events({"term": {"source": source.upper()}}, size)
    else:
        events = indexer.get_all_events(size)

    return {
        "total": len(events),
        "events": events,
    }


# ─────────────────────────────────────────────
# GET /events/{user} — Events by user
# ─────────────────────────────────────────────

@router.get("/{user}")
def get_events_by_user(
    user: str,
    size: int = Query(default=200, ge=1, le=2000),
):
    """Return events for a specific user (e.g., emp_101)."""
    # Avoid clashing with other routes
    if user in ("stats", "timeline", "analytics"):
        raise HTTPException(status_code=400, detail="Use the correct endpoint path")

    indexer = get_indexer()
    events = indexer.get_events_by_user(user, size)

    return {
        "user": user,
        "total": len(events),
        "events": events,
    }


# ─────────────────────────────────────────────
# GET /events/asset/{asset} — Events by asset
# ─────────────────────────────────────────────

@router.get("/asset/{asset}")
def get_events_by_asset(
    asset: str,
    size: int = Query(default=200, ge=1, le=2000),
):
    """Return events for a specific asset (e.g., core-banking-db)."""
    indexer = get_indexer()
    events = indexer.get_events_by_asset(asset, size)

    return {
        "asset": asset,
        "total": len(events),
        "events": events,
    }


# ─────────────────────────────────────────────
# GET /events/type/{event_type} — Events by type
# ─────────────────────────────────────────────

@router.get("/type/{event_type}")
def get_events_by_type(
    event_type: str,
    size: int = Query(default=200, ge=1, le=2000),
):
    """Return events of a specific type (e.g., login_failed)."""
    indexer = get_indexer()
    events = indexer.get_events_by_type(event_type, size)

    return {
        "event_type": event_type,
        "total": len(events),
        "events": events,
    }


# ─────────────────────────────────────────────
# GET /events/severity/{level} — Events by severity
# ─────────────────────────────────────────────

@router.get("/severity/{level}")
def get_events_by_severity(
    level: str,
    size: int = Query(default=200, ge=1, le=2000),
):
    """Return events of a specific severity (low/medium/high/critical)."""
    valid = {"low", "medium", "high", "critical"}
    if level.lower() not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Use one of: {valid}"
        )

    indexer = get_indexer()
    events = indexer.get_events_by_severity(level.lower(), size)

    return {
        "severity": level.lower(),
        "total": len(events),
        "events": events,
    }


# ─────────────────────────────────────────────
# GET /events/timeline — Chronological timeline
# ─────────────────────────────────────────────

@router.get("/timeline/view")
def get_timeline(
    user: str = Query(..., description="User ID (e.g., emp_101)"),
    size: int = Query(default=500, ge=1, le=5000),
):
    """Return chronological event timeline for a user."""
    indexer = get_indexer()
    events = indexer.get_timeline(user, size)

    return {
        "user": user,
        "total": len(events),
        "timeline": events,
    }


# ─────────────────────────────────────────────
# GET /events/stats — Overall statistics
# ─────────────────────────────────────────────

@router.get("/stats/overview")
def get_stats():
    """Return overall event statistics."""
    indexer = get_indexer()
    return indexer.get_event_stats()


# ─────────────────────────────────────────────
# ANALYTICS ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/analytics/top-attacked-assets")
def analytics_top_attacked_assets(
    size: int = Query(default=10, ge=1, le=50),
):
    """Get the top attacked assets by event count."""
    indexer = get_indexer()
    result = indexer.get_top_attacked_assets(size)
    return {"analytics": "top_attacked_assets", "data": result}


@router.get("/analytics/failed-logins")
def analytics_failed_logins():
    """Get failed login counts grouped by user."""
    indexer = get_indexer()
    result = indexer.get_failed_login_counts()
    return {"analytics": "failed_login_counts", "data": result}


@router.get("/analytics/user-activity")
def analytics_user_activity(
    user: Optional[str] = Query(default=None, description="Optional user filter"),
):
    """Get user activity patterns (hourly, by source, by severity)."""
    indexer = get_indexer()
    result = indexer.get_user_activity_patterns(user)
    return {"analytics": "user_activity_patterns", "user": user or "all", "data": result}
