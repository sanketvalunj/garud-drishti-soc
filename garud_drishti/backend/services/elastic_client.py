"""
Garud-Drishti — AI SOC Platform
Elasticsearch Client

Provides a cached singleton Elasticsearch client.
Falls back gracefully to an in-memory mock when ES is unavailable.

Edge cases fixed:
  EC-06: MockElasticsearch now handles bool.should (OR) queries
         so /events/search returns results against the mock store.
  EC-08: _store uses collections.deque(maxlen=50_000) to cap
         memory at ~60 MB and auto-discard oldest events.
"""

import logging
import os
from collections import deque
from typing import Optional

logger = logging.getLogger(__name__)

ES_HOST      = os.getenv("ES_HOST",  "http://localhost:9200")
ES_INDEX     = os.getenv("ES_INDEX", "security_events")
MOCK_MAX     = int(os.getenv("MOCK_STORE_MAX", "50000"))
ES_TIMEOUT   = int(os.getenv("ES_TIMEOUT", "5"))

try:
    from elasticsearch import Elasticsearch, helpers as es_helpers
    _ES_AVAILABLE = True
except ImportError:
    _ES_AVAILABLE = False
    logger.warning("elasticsearch-py not installed — using in-memory mock.")


# ---------------------------------------------------------------------------
# In-memory mock
# ---------------------------------------------------------------------------

class _MockElasticsearch:
    """
    Lightweight in-memory mock with a bounded deque store.

    Supports the minimal ES API surface used by this platform:
      search  — bool.must / bool.filter / bool.should / match_all / wildcard / range
      index   — single document insert
      bulk    — batch insert
      count   — total document count
      indices.exists / create / delete
    """

    def __init__(self):
        # EC-08: bounded deque — oldest events auto-discarded when full
        self._store: deque = deque(maxlen=MOCK_MAX)
        logger.info("MockElasticsearch: in-memory store (maxlen=%d).", MOCK_MAX)

    def ping(self) -> bool:
        return True

    def info(self):
        return {"version": {"number": "mock-8.x"}}

    @property
    def indices(self):
        return self

    def exists(self, index: str = None, **kwargs) -> bool:
        return True

    def create(self, index: str = None, body: dict = None, **kwargs):
        pass

    def delete(self, index: str = None, **kwargs):
        self._store.clear()

    def index(self, index: str, document: dict, id: str = None, **kwargs):
        doc = dict(document)
        doc["_id"] = id or doc.get("event_id", str(len(self._store)))
        self._store.append(doc)
        return {"result": "created", "_id": doc["_id"]}

    def bulk(self, operations: list, **kwargs):
        indexed = 0
        for item in operations:
            if isinstance(item, dict) and "event_id" in item:
                self._store.append(item)
                indexed += 1
        return {"errors": False, "items": [{"index": {"result": "created"}}] * indexed}

    def search(self, index: str, body: dict, **kwargs):
        query  = body.get("query", {})
        from_  = body.get("from", 0)
        size   = body.get("size", 10)

        results = list(self._store)

        # ── must / filter clauses ─────────────────────────────────────────
        must_clauses = (
            query.get("bool", {}).get("must", []) or
            query.get("bool", {}).get("filter", [])
        )
        for clause in must_clauses:
            if "match" in clause:
                for field, val in clause["match"].items():
                    results = [r for r in results if str(r.get(field, "")) == str(val)]
            elif "term" in clause:
                for field, val in clause["term"].items():
                    results = [r for r in results if str(r.get(field, "")) == str(val)]
            elif "range" in clause:
                for field, bounds in clause["range"].items():
                    gte = bounds.get("gte")
                    lte = bounds.get("lte")
                    if gte:
                        results = [r for r in results if r.get(field, "") >= gte]
                    if lte:
                        results = [r for r in results if r.get(field, "") <= lte]

        # ── should clauses (OR logic) — EC-06 fix ─────────────────────────
        should_clauses = query.get("bool", {}).get("should", [])
        if should_clauses:
            matched = set()
            for clause in should_clauses:
                if "wildcard" in clause:
                    for field, spec in clause["wildcard"].items():
                        val = spec.get("value", spec) if isinstance(spec, dict) else spec
                        pattern = str(val).replace("*", "").lower()
                        for i, r in enumerate(results):
                            if pattern in str(r.get(field, "")).lower():
                                matched.add(i)
                elif "term" in clause:
                    for field, val in clause["term"].items():
                        for i, r in enumerate(results):
                            if str(r.get(field, "")) == str(val):
                                matched.add(i)
                elif "match" in clause:
                    for field, val in clause["match"].items():
                        for i, r in enumerate(results):
                            if str(val).lower() in str(r.get(field, "")).lower():
                                matched.add(i)
            results = [results[i] for i in sorted(matched)]

        # ── match_all ─────────────────────────────────────────────────────
        if "match_all" in query:
            pass  # keep all

        # ── top-level wildcard ─────────────────────────────────────────────
        if "wildcard" in query:
            for field, spec in query["wildcard"].items():
                val = spec.get("value", spec) if isinstance(spec, dict) else spec
                pattern = str(val).replace("*", "").lower()
                results = [r for r in results
                           if pattern in str(r.get(field, "")).lower()]

        total = len(results)
        try:
            results.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
        except Exception:
            pass

        hits = results[from_: from_ + size]
        return {
            "hits": {
                "total": {"value": total, "relation": "eq"},
                "hits":  [{"_source": h, "_id": h.get("event_id", "")} for h in hits],
            },
            "aggregations": {},
        }

    def count(self, index: str = None, body: dict = None, **kwargs) -> dict:
        return {"count": len(self._store)}

    def get_all(self) -> list:
        return list(self._store)


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

_client_instance = None


def get_es_client():
    """Return cached Elasticsearch client (real or mock). Thread-safe enough for single-process."""
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    if _ES_AVAILABLE:
        try:
            client = Elasticsearch(ES_HOST, request_timeout=ES_TIMEOUT)
            if client.ping():
                logger.info("Connected to Elasticsearch at %s", ES_HOST)
                _client_instance = client
                return _client_instance
        except Exception as exc:
            logger.warning("Could not connect to Elasticsearch: %s", exc)

    logger.info("Using in-memory MockElasticsearch (maxlen=%d).", MOCK_MAX)
    _client_instance = _MockElasticsearch()
    return _client_instance


def reset_client():
    """Reset the singleton — useful in tests."""
    global _client_instance
    _client_instance = None