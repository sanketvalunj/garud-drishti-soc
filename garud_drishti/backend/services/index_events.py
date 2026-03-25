"""
Garud-Drishti — AI SOC Platform
Elasticsearch Index Service

Handles:
  - Index creation with correct mappings
  - Bulk insertion of normalised events
  - Single event insertion
  - Index health checks
"""

import logging
from typing import List, Dict, Any, Optional

from backend.services.elastic_client import get_es_client, ES_INDEX

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Index Mappings
# ---------------------------------------------------------------------------

INDEX_MAPPINGS = {
    "mappings": {
        "properties": {
            "event_id":       {"type": "keyword"},
            "timestamp":      {"type": "date",    "format": "strict_date_time_no_millis"},
            "user":           {"type": "keyword"},
            "device":         {"type": "keyword"},
            "asset":          {"type": "keyword"},
            "ip":             {"type": "ip"},
            "src_ip":         {"type": "ip"},
            "dest_ip":        {"type": "ip"},
            "port":           {"type": "keyword"},
            "protocol":       {"type": "keyword"},
            "process":        {"type": "keyword"},
            "event_type":     {"type": "keyword"},
            "event_category": {"type": "keyword"},
            "source":         {"type": "keyword"},
            "severity":       {"type": "keyword"},
            "session_id":     {"type": "keyword"},
            "attack_chain":   {"type": "keyword"},
            # MITRE ATT&CK
            "mitre_technique":      {"type": "keyword"},
            "mitre_sub_technique":  {"type": "keyword"},
            "mitre_tactic":         {"type": "keyword"},
            "mitre_technique_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
            # Security context enrichment
            "geo_country":      {"type": "keyword"},
            "geo_city":         {"type": "keyword"},
            "geo_risk":         {"type": "keyword"},
            "network_zone":     {"type": "keyword"},
            "asset_criticality":{"type": "keyword"},
            "user_risk_score":  {"type": "float"},
            "threat_score":     {"type": "integer"},
            "event_category":   {"type": "keyword"},
            "details":        {"type": "object", "dynamic": True},
        }
    },
    "settings": {
        "number_of_shards":   1,
        "number_of_replicas": 0,
        "refresh_interval":   "1s",
    },
}

# Mapping for mock (which ignores settings)
MOCK_MAPPINGS = {"mappings": INDEX_MAPPINGS["mappings"]}


# ---------------------------------------------------------------------------
# IP sanitiser (ES ip type rejects empty strings)
# ---------------------------------------------------------------------------

import re as _re
_IP_RE = _re.compile(
    r"^(\d{1,3}\.){3}\d{1,3}$"
)


def _sanitise_ip(val: Any) -> Optional[str]:
    if not val:
        return None
    s = str(val).strip()
    if _IP_RE.match(s):
        return s
    return None


def sanitise_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fix fields that Elasticsearch strict typing will reject.
    Mutates a copy and returns it.
    """
    e = dict(event)
    for field in ("ip", "src_ip", "dest_ip"):
        cleaned = _sanitise_ip(e.get(field))
        if cleaned:
            e[field] = cleaned
        else:
            e.pop(field, None)  # remove empty / invalid IPs
    return e


# ---------------------------------------------------------------------------
# Index lifecycle
# ---------------------------------------------------------------------------

def ensure_index(index: str = ES_INDEX) -> bool:
    """Create the index if it does not exist. Returns True on success."""
    es = get_es_client()
    try:
        if not es.indices.exists(index=index):
            es.indices.create(index=index, body=INDEX_MAPPINGS)
            logger.info("Created index: %s", index)
        else:
            logger.debug("Index already exists: %s", index)
        return True
    except Exception as exc:
        logger.error("Failed to ensure index '%s': %s", index, exc)
        return False


def delete_index(index: str = ES_INDEX) -> bool:
    """Drop the index (used for re-ingestion). Returns True on success."""
    es = get_es_client()
    try:
        es.indices.delete(index=index)
        logger.info("Deleted index: %s", index)
        return True
    except Exception as exc:
        logger.warning("Could not delete index '%s': %s", index, exc)
        return False


# ---------------------------------------------------------------------------
# Single event insert
# ---------------------------------------------------------------------------

def index_event(event: Dict[str, Any], index: str = ES_INDEX) -> bool:
    """Index a single normalised event. Returns True on success."""
    es  = get_es_client()
    doc = sanitise_event(event)
    try:
        es.index(index=index, document=doc, id=doc.get("event_id"))
        return True
    except Exception as exc:
        logger.error("Failed to index event %s: %s", doc.get("event_id"), exc)
        return False


# ---------------------------------------------------------------------------
# Bulk insert
# ---------------------------------------------------------------------------

BULK_CHUNK = 500   # events per bulk request


def bulk_index(events: List[Dict[str, Any]], index: str = ES_INDEX) -> Dict[str, int]:
    """
    Bulk-insert a list of normalised events into Elasticsearch.
    Returns {"indexed": N, "errors": M}.
    """
    ensure_index(index)
    es      = get_es_client()
    total   = len(events)
    indexed = 0
    errors  = 0

    # Check if we're using the real ES client
    is_real_es = hasattr(es, "helpers") or _has_real_bulk(es)

    for chunk_start in range(0, total, BULK_CHUNK):
        chunk = events[chunk_start: chunk_start + BULK_CHUNK]

        if is_real_es:
            # Real elasticsearch-py helpers format
            try:
                from elasticsearch import helpers as es_helpers
                actions = [
                    {
                        "_index": index,
                        "_id":    e.get("event_id"),
                        "_source": sanitise_event(e),
                    }
                    for e in chunk
                ]
                ok, failed = es_helpers.bulk(es, actions, raise_on_error=False)
                indexed += ok
                errors  += len(failed) if failed else 0
            except Exception as exc:
                logger.error("Bulk index chunk failed: %s", exc)
                errors += len(chunk)
        else:
            # Mock client: call bulk with plain list of sanitised docs
            sanitised = [sanitise_event(e) for e in chunk]
            try:
                es.bulk(sanitised)
                indexed += len(chunk)
            except Exception as exc:
                logger.error("Mock bulk index chunk failed: %s", exc)
                errors += len(chunk)

    logger.info("Bulk index complete: %d indexed, %d errors / %d total", indexed, errors, total)
    return {"indexed": indexed, "errors": errors}


def _has_real_bulk(client) -> bool:
    """Detect if client is a real elasticsearch-py Elasticsearch instance."""
    return type(client).__name__ == "Elasticsearch"


# ---------------------------------------------------------------------------
# Stats helper
# ---------------------------------------------------------------------------

def get_index_stats(index: str = ES_INDEX) -> Dict[str, Any]:
    es = get_es_client()
    try:
        result = es.count(index=index)
        return {"index": index, "doc_count": result.get("count", 0)}
    except Exception as exc:
        return {"index": index, "error": str(exc)}


# ---------------------------------------------------------------------------
# Quick test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json
    from simulator.log_generator import LogGenerator
    from backend.ingestion.normalize_logs import normalise_batch

    print("Generating 200 events…")
    gen    = LogGenerator()
    events = normalise_batch(gen.generate_batch(200))

    print("Ensuring index…")
    ensure_index()

    print("Bulk indexing…")
    result = bulk_index(events)
    print("Result:", result)

    print("Stats:", get_index_stats())