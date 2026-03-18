"""
Garud-Drishti SOC — Event Indexing Service
============================================
Handles Elasticsearch index setup with proper mappings,
bulk event ingestion, and JSON file fallback for offline mode.
"""

import json
import os
import logging
from pathlib import Path
from typing import List, Dict

from backend.services.elastic_client import ElasticClient

logger = logging.getLogger("garud_drishti.indexer")


# ─────────────────────────────────────────────
# INDEX MAPPING
# ─────────────────────────────────────────────

SECURITY_EVENTS_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "refresh_interval": "1s",
    },
    "mappings": {
        "properties": {
            "event_id": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "user": {"type": "keyword"},
            "device": {"type": "keyword"},
            "asset": {"type": "keyword"},
            "ip": {"type": "ip", "ignore_malformed": True},
            "dest_ip": {"type": "ip", "ignore_malformed": True},
            "event_type": {"type": "keyword"},
            "source": {"type": "keyword"},
            "severity": {"type": "keyword"},
            "severity_score": {"type": "integer"},
            "event_category": {"type": "keyword"},
            "session_id": {"type": "keyword"},
            "risk_flag": {"type": "keyword"},
            "port": {"type": "keyword"},
            "process": {"type": "keyword"},
            "records_accessed": {"type": "integer"},
            "bytes_transferred": {"type": "long"},
            "attack_chain": {"type": "keyword"},
            "chain_step": {"type": "integer"},
            "login_hour": {"type": "integer"},
            "night_login": {"type": "boolean"},
            "event_hash": {"type": "keyword"},
        }
    }
}


class EventIndexer:
    """
    Manages Elasticsearch index lifecycle and event ingestion.
    Falls back to JSON file storage when ES is unavailable.
    """

    INDEX_NAME = "security_events"

    def __init__(self, es_client: ElasticClient = None):
        self.es = es_client or ElasticClient()
        self._events_cache: List[Dict] = []  # In-memory fallback

    # ─────────────────────────────────────────
    # INDEX SETUP
    # ─────────────────────────────────────────

    def create_index(self) -> bool:
        """Create the security_events index with proper mappings."""
        if not self.es.is_enabled():
            logger.info("ES disabled — using in-memory/file storage")
            return False

        try:
            if self.es.client.indices.exists(index=self.INDEX_NAME):
                logger.info(f"Index '{self.INDEX_NAME}' already exists")
                return True

            self.es.client.indices.create(
                index=self.INDEX_NAME,
                body=SECURITY_EVENTS_MAPPING,
            )
            logger.info(f"✅ Created index '{self.INDEX_NAME}'")
            return True
        except Exception as e:
            logger.error(f"Failed to create index: {e}")
            return False

    def reset_index(self) -> bool:
        """Delete and recreate the index."""
        self.es.delete_index(self.INDEX_NAME)
        self._events_cache.clear()
        return self.create_index()

    # ─────────────────────────────────────────
    # EVENT INGESTION
    # ─────────────────────────────────────────

    def index_events(self, events: List[Dict]) -> Dict:
        """
        Index a list of normalized events.
        Uses Elasticsearch if available, otherwise stores in memory + file.

        Returns:
            Status dict with counts
        """
        if not events:
            return {"indexed": 0, "storage": "none"}

        # Always cache in memory
        self._events_cache.extend(events)

        # Try Elasticsearch
        if self.es.is_enabled():
            count = self.es.bulk_index(events, self.INDEX_NAME)
            logger.info(f"🚀 Indexed {count}/{len(events)} events to Elasticsearch")
            return {
                "indexed": count,
                "total": len(events),
                "storage": "elasticsearch",
                "index": self.INDEX_NAME,
            }

        # Fallback to file storage
        return self._save_to_file(events)

    def index_single(self, event: Dict) -> bool:
        """Index a single event."""
        self._events_cache.append(event)

        if self.es.is_enabled():
            return self.es.index_document(
                event, self.INDEX_NAME,
                doc_id=event.get("event_id")
            )
        return True  # Stored in cache

    # ─────────────────────────────────────────
    # QUERY EVENTS
    # ─────────────────────────────────────────

    def get_all_events(self, size: int = 1000) -> List[Dict]:
        """Get all events."""
        if self.es.is_enabled():
            return self.es.search({"match_all": {}}, self.INDEX_NAME, size)
        return self._events_cache[-size:]

    def get_events_by_user(self, user: str, size: int = 200) -> List[Dict]:
        """Get events for a specific user."""
        if self.es.is_enabled():
            return self.es.search(
                {"term": {"user": user}},
                self.INDEX_NAME, size
            )
        return [e for e in self._events_cache if e.get("user") == user][-size:]

    def get_events_by_asset(self, asset: str, size: int = 200) -> List[Dict]:
        """Get events for a specific asset."""
        if self.es.is_enabled():
            return self.es.search(
                {"term": {"asset": asset}},
                self.INDEX_NAME, size
            )
        return [e for e in self._events_cache if e.get("asset") == asset][-size:]

    def get_events_by_type(self, event_type: str, size: int = 200) -> List[Dict]:
        """Get events of a specific type."""
        if self.es.is_enabled():
            return self.es.search(
                {"term": {"event_type": event_type}},
                self.INDEX_NAME, size
            )
        return [e for e in self._events_cache if e.get("event_type") == event_type][-size:]

    def get_timeline(self, user: str, size: int = 500) -> List[Dict]:
        """Get chronological events for a user."""
        if self.es.is_enabled():
            try:
                body = {
                    "query": {"term": {"user": user}},
                    "sort": [{"timestamp": {"order": "asc"}}],
                    "size": size,
                }
                res = self.es.client.search(index=self.INDEX_NAME, body=body)
                return [hit["_source"] for hit in res["hits"]["hits"]]
            except Exception as e:
                logger.error(f"Timeline query error: {e}")
                return []

        # Fallback: sort in-memory
        user_events = [e for e in self._events_cache if e.get("user") == user]
        user_events.sort(key=lambda x: x.get("timestamp", ""))
        return user_events[-size:]

    def get_events_by_severity(self, severity: str, size: int = 200) -> List[Dict]:
        """Get events of a specific severity level."""
        if self.es.is_enabled():
            return self.es.search(
                {"term": {"severity": severity}},
                self.INDEX_NAME, size
            )
        return [e for e in self._events_cache if e.get("severity") == severity][-size:]

    def search_events(self, query: dict, size: int = 200) -> List[Dict]:
        """Run a custom search query."""
        if self.es.is_enabled():
            return self.es.search(query, self.INDEX_NAME, size)
        return self._events_cache[-size:]

    # ─────────────────────────────────────────
    # ANALYTICS / AGGREGATIONS
    # ─────────────────────────────────────────

    def get_top_attacked_assets(self, size: int = 10) -> Dict:
        """Get assets with most security events."""
        if self.es.is_enabled():
            body = {
                "size": 0,
                "query": {
                    "bool": {
                        "must_not": [{"term": {"risk_flag": "normal"}}]
                    }
                },
                "aggs": {
                    "top_assets": {
                        "terms": {"field": "asset", "size": size}
                    }
                }
            }
            return self.es.aggregate(body, self.INDEX_NAME)

        # Fallback aggregation
        counts = {}
        for e in self._events_cache:
            if e.get("risk_flag") != "normal":
                asset = e.get("asset", "unknown")
                counts[asset] = counts.get(asset, 0) + 1
        sorted_assets = sorted(counts.items(), key=lambda x: -x[1])[:size]
        return {"top_assets": {"buckets": [{"key": a, "doc_count": c} for a, c in sorted_assets]}}

    def get_failed_login_counts(self) -> Dict:
        """Get failed login counts per user."""
        if self.es.is_enabled():
            body = {
                "size": 0,
                "query": {"term": {"event_type": "login_failed"}},
                "aggs": {
                    "by_user": {
                        "terms": {"field": "user", "size": 50}
                    }
                }
            }
            return self.es.aggregate(body, self.INDEX_NAME)

        # Fallback
        counts = {}
        for e in self._events_cache:
            if e.get("event_type") == "login_failed":
                user = e.get("user", "unknown")
                counts[user] = counts.get(user, 0) + 1
        sorted_users = sorted(counts.items(), key=lambda x: -x[1])
        return {"by_user": {"buckets": [{"key": u, "doc_count": c} for u, c in sorted_users]}}

    def get_user_activity_patterns(self, user: str = None) -> Dict:
        """Get activity patterns (events per hour)."""
        if self.es.is_enabled():
            query = {"term": {"user": user}} if user else {"match_all": {}}
            body = {
                "size": 0,
                "query": query,
                "aggs": {
                    "hourly_activity": {
                        "histogram": {"field": "login_hour", "interval": 1}
                    },
                    "by_source": {
                        "terms": {"field": "source"}
                    },
                    "by_severity": {
                        "terms": {"field": "severity"}
                    }
                }
            }
            return self.es.aggregate(body, self.INDEX_NAME)

        # Fallback
        events = self._events_cache
        if user:
            events = [e for e in events if e.get("user") == user]

        hourly = {}
        sources = {}
        severities = {}
        for e in events:
            h = e.get("login_hour", 0)
            hourly[h] = hourly.get(h, 0) + 1
            s = e.get("source", "unknown")
            sources[s] = sources.get(s, 0) + 1
            sev = e.get("severity", "low")
            severities[sev] = severities.get(sev, 0) + 1

        return {
            "hourly_activity": {"buckets": [{"key": h, "doc_count": c} for h, c in sorted(hourly.items())]},
            "by_source": {"buckets": [{"key": s, "doc_count": c} for s, c in sorted(sources.items(), key=lambda x: -x[1])]},
            "by_severity": {"buckets": [{"key": s, "doc_count": c} for s, c in sorted(severities.items(), key=lambda x: -x[1])]},
        }

    def get_event_stats(self) -> Dict:
        """Get overall event statistics."""
        total = self.es.count(index=self.INDEX_NAME) if self.es.is_enabled() else len(self._events_cache)

        return {
            "total_events": total,
            "elasticsearch_enabled": self.es.is_enabled(),
            "index_name": self.INDEX_NAME,
        }

    # ─────────────────────────────────────────
    # FILE FALLBACK
    # ─────────────────────────────────────────

    def _save_to_file(self, events: List[Dict]) -> Dict:
        """Save events to JSON file when ES is unavailable."""
        data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "data", "normalized_events"
        )
        os.makedirs(data_dir, exist_ok=True)
        path = os.path.join(data_dir, "events.json")

        # Append to existing
        existing = []
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    existing = json.load(f)
            except Exception:
                existing = []

        existing.extend(events)

        with open(path, "w") as f:
            json.dump(existing, f, indent=2, default=str)

        logger.info(f"💾 Saved {len(events)} events to {path}")
        return {
            "indexed": len(events),
            "total": len(existing),
            "storage": "file",
            "path": path,
        }

    def load_from_file(self, path: str = None) -> List[Dict]:
        """Load events from JSON file into memory cache."""
        if path is None:
            path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "data", "normalized_events", "events.json"
            )

        if not os.path.exists(path):
            return []

        with open(path, "r") as f:
            events = json.load(f)

        self._events_cache.extend(events)
        logger.info(f"📦 Loaded {len(events)} events from {path}")
        return events

    @property
    def cached_event_count(self) -> int:
        return len(self._events_cache)
