"""
Garud-Drishti — AI SOC Platform
Events Query API

Endpoints:
  GET /events                         — all events (paginated)
  GET /events/{user}                  — events by user
  GET /events/asset/{asset}           — events by asset
  GET /events/type/{event_type}       — events by event type
  GET /events/timeline?user=...       — chronological timeline for user
  GET /events/search?q=...            — free-text / field search
  GET /analytics/top-assets          — top attacked assets
  GET /analytics/failed-logins       — failed login counts by user
  GET /analytics/severity-breakdown  — event counts per severity
  GET /analytics/attack-chains       — events tagged with attack chains
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any

from backend.services.elastic_client import get_es_client, ES_INDEX
from backend.services.index_events    import get_index_stats

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hits_to_list(raw_response: dict) -> List[Dict[str, Any]]:
    hits = raw_response.get("hits", {}).get("hits", [])
    return [h["_source"] for h in hits]


def _total(raw_response: dict) -> int:
    return raw_response.get("hits", {}).get("total", {}).get("value", 0)


def _search(body: dict, index: str = ES_INDEX) -> dict:
    es = get_es_client()
    try:
        return es.search(index=index, body=body)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Elasticsearch error: {exc}")


# ---------------------------------------------------------------------------
# GET /events — all events
# ---------------------------------------------------------------------------

@router.get("/events", summary="List all security events")
async def list_events(
    page: int   = Query(1,   ge=1, description="Page number (1-based)"),
    size: int   = Query(20,  ge=1, le=200, description="Events per page"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    source:   Optional[str] = Query(None, description="Filter by source (IAM|EDR|FIREWALL|APP)"),
):
    must = []
    if severity:
        must.append({"term": {"severity": severity.lower()}})
    if source:
        must.append({"term": {"source": source.upper()}})

    body = {
        "from": (page - 1) * size,
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}],
        "query": {"bool": {"must": must}} if must else {"match_all": {}},
    }
    resp  = _search(body)
    return {
        "total":  _total(resp),
        "page":   page,
        "size":   size,
        "events": _hits_to_list(resp),
    }


# ---------------------------------------------------------------------------
# GET /events/{user} — events by user
# ---------------------------------------------------------------------------

@router.get("/events/{user}", summary="Events by user ID")
async def events_by_user(
    user: str,
    size: int = Query(50, ge=1, le=500),
    page: int = Query(1,  ge=1),
):
    body = {
        "from": (page - 1) * size,
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}],
        "query": {
            "bool": {
                "must": [{"term": {"user": user}}]
            }
        },
    }
    resp = _search(body)
    if _total(resp) == 0:
        raise HTTPException(status_code=404, detail=f"No events found for user '{user}'")
    return {
        "user":   user,
        "total":  _total(resp),
        "page":   page,
        "events": _hits_to_list(resp),
    }


# ---------------------------------------------------------------------------
# GET /events/asset/{asset} — events by asset
# ---------------------------------------------------------------------------

@router.get("/events/asset/{asset}", summary="Events by asset name")
async def events_by_asset(
    asset: str,
    size:  int = Query(50, ge=1, le=500),
    page:  int = Query(1, ge=1),
):
    body = {
        "from": (page - 1) * size,
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}],
        "query": {
            "bool": {
                "must": [{"term": {"asset": asset}}]
            }
        },
    }
    resp = _search(body)
    return {
        "asset":  asset,
        "total":  _total(resp),
        "page":   page,
        "events": _hits_to_list(resp),
    }


# ---------------------------------------------------------------------------
# GET /events/type/{event_type} — events by type
# ---------------------------------------------------------------------------

@router.get("/events/type/{event_type}", summary="Events by event type")
async def events_by_type(
    event_type: str,
    size: int = Query(50, ge=1, le=500),
    page: int = Query(1, ge=1),
):
    body = {
        "from": (page - 1) * size,
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}],
        "query": {
            "bool": {
                "must": [{"term": {"event_type": event_type}}]
            }
        },
    }
    resp = _search(body)
    return {
        "event_type": event_type,
        "total":      _total(resp),
        "page":       page,
        "events":     _hits_to_list(resp),
    }


# ---------------------------------------------------------------------------
# GET /events/timeline — chronological user timeline
# ---------------------------------------------------------------------------

@router.get("/events/timeline", summary="Chronological event timeline for a user")
async def user_timeline(
    user: str = Query(..., description="Employee ID, e.g. emp_101"),
    from_ts: Optional[str] = Query(None, description="ISO-8601 start timestamp"),
    to_ts:   Optional[str] = Query(None, description="ISO-8601 end timestamp"),
    size:    int = Query(100, ge=1, le=1000),
):
    must: list = [{"term": {"user": user}}]

    if from_ts or to_ts:
        range_clause: dict = {}
        if from_ts:
            range_clause["gte"] = from_ts
        if to_ts:
            range_clause["lte"] = to_ts
        must.append({"range": {"timestamp": range_clause}})

    body = {
        "from": 0,
        "size": size,
        "sort": [{"timestamp": {"order": "asc"}}],
        "query": {"bool": {"must": must}},
    }
    resp = _search(body)
    return {
        "user":   user,
        "total":  _total(resp),
        "events": _hits_to_list(resp),
    }


# ---------------------------------------------------------------------------
# GET /events/search — free search
# ---------------------------------------------------------------------------

@router.get("/events/search", summary="Search events across all fields")
async def search_events(
    q:    str = Query(..., description="Search term"),
    size: int = Query(20, ge=1, le=200),
    page: int = Query(1, ge=1),
):
    body = {
        "from": (page - 1) * size,
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}],
        "query": {
            "bool": {
                "should": [
                    {"wildcard": {"user":       {"value": f"*{q}*"}}},
                    {"wildcard": {"event_type": {"value": f"*{q}*"}}},
                    {"wildcard": {"asset":      {"value": f"*{q}*"}}},
                    {"wildcard": {"source":     {"value": f"*{q}*"}}},
                    {"wildcard": {"attack_chain":{"value": f"*{q}*"}}},
                ]
            }
        },
    }
    resp = _search(body)
    return {
        "query":  q,
        "total":  _total(resp),
        "page":   page,
        "events": _hits_to_list(resp),
    }


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics/top-assets", summary="Top assets by event count")
async def top_assets(top_n: int = Query(10, ge=1, le=50)):
    es = get_es_client()
    try:
        body = {
            "size": 0,
            "aggs": {
                "top_assets": {
                    "terms": {"field": "asset", "size": top_n}
                }
            },
        }
        resp = es.search(index=ES_INDEX, body=body)
        buckets = (
            resp.get("aggregations", {})
                .get("top_assets", {})
                .get("buckets", [])
        )
        if not buckets:
            # Fallback: compute from mock store
            store = getattr(es, "_store", [])
            from collections import Counter
            counts = Counter(e.get("asset", "") for e in store if e.get("asset"))
            buckets = [
                {"key": k, "doc_count": v}
                for k, v in counts.most_common(top_n)
            ]
        return {"top_assets": buckets}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/analytics/failed-logins", summary="Failed login counts per user")
async def failed_logins(top_n: int = Query(10, ge=1, le=50)):
    es = get_es_client()
    store = getattr(es, "_store", [])
    from collections import Counter
    counts = Counter(
        e.get("user", "unknown")
        for e in store
        if e.get("event_type") == "login_failed"
    )
    result = [{"user": u, "count": c} for u, c in counts.most_common(top_n)]
    return {"failed_logins": result, "total_events": sum(counts.values())}


@router.get("/analytics/severity-breakdown", summary="Event counts per severity level")
async def severity_breakdown():
    es = get_es_client()
    store = getattr(es, "_store", [])
    from collections import Counter
    counts = Counter(e.get("severity", "low") for e in store)
    return {
        "severity_breakdown": {
            sev: counts.get(sev, 0) for sev in ("critical", "high", "medium", "low")
        }
    }


@router.get("/analytics/attack-chains", summary="Events tagged with attack chains")
async def attack_chain_events(size: int = Query(50, ge=1, le=500)):
    es    = get_es_client()
    store = getattr(es, "_store", [])
    chain_events = [e for e in store if e.get("attack_chain")]
    from collections import Counter
    chain_counts = Counter(e["attack_chain"] for e in chain_events)
    return {
        "attack_chains": dict(chain_counts),
        "recent_chain_events": chain_events[:size],
    }


@router.get("/health", summary="Index health check")
async def health():
    stats = get_index_stats()
    return {"status": "ok", **stats}