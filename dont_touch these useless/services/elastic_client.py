"""
Garud-Drishti SOC — Elasticsearch Client
==========================================
Provides a resilient Elasticsearch client wrapper with
connection management, health checks, and graceful fallback.
"""

import os
import logging

logger = logging.getLogger("garud_drishti.elastic")

try:
    from elasticsearch import Elasticsearch
    ES_AVAILABLE = True
except ImportError:
    Elasticsearch = None
    ES_AVAILABLE = False
    logger.warning("elasticsearch package not installed. ES features disabled.")


class ElasticClient:
    """
    Elasticsearch client with automatic fallback for offline/dev mode.
    When ES is unavailable, operations silently return empty results.
    """

    INDEX_NAME = "security_events"

    def __init__(self, host: str = None):
        self.host = host or os.getenv("ES_HOST", "http://localhost:9200")
        self.client = None
        self.enabled = False

        if ES_AVAILABLE:
            try:
                self.client = Elasticsearch(
                    self.host,
                    request_timeout=10,
                    retry_on_timeout=True,
                    max_retries=2,
                )
                if self.client.ping():
                    self.enabled = True
                    logger.info(f"✅ Connected to Elasticsearch at {self.host}")
                else:
                    logger.warning(f"⚠ Elasticsearch at {self.host} not responding")
            except Exception as e:
                logger.warning(f"⚠ Elasticsearch connection failed: {e}")
                self.client = None

    def is_enabled(self) -> bool:
        return self.enabled

    def index_document(self, doc: dict, index: str = None, doc_id: str = None) -> bool:
        """Index a single document."""
        if not self.enabled:
            return False
        try:
            idx = index or self.INDEX_NAME
            kwargs = {"index": idx, "document": doc}
            if doc_id:
                kwargs["id"] = doc_id
            self.client.index(**kwargs)
            return True
        except Exception as e:
            logger.error(f"Index error: {e}")
            return False

    def bulk_index(self, docs: list, index: str = None) -> int:
        """Bulk index documents. Returns count of successfully indexed docs."""
        if not self.enabled:
            return 0
        try:
            from elasticsearch import helpers
            idx = index or self.INDEX_NAME
            actions = []
            for doc in docs:
                action = {
                    "_index": idx,
                    "_source": doc,
                }
                if doc.get("event_id"):
                    action["_id"] = doc["event_id"]
                actions.append(action)

            success, errors = helpers.bulk(
                self.client,
                actions,
                chunk_size=500,
                raise_on_error=False,
            )
            if errors:
                logger.warning(f"Bulk index had {len(errors)} errors")
            return success
        except Exception as e:
            logger.error(f"Bulk index error: {e}")
            return 0

    def search(self, query: dict = None, index: str = None, size: int = 100) -> list:
        """Search and return list of source documents."""
        if not self.enabled:
            return []
        try:
            idx = index or self.INDEX_NAME
            body = {"query": query or {"match_all": {}}, "size": size}
            res = self.client.search(index=idx, body=body)
            return [hit["_source"] for hit in res["hits"]["hits"]]
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []

    def aggregate(self, agg_body: dict, index: str = None) -> dict:
        """Run an aggregation query."""
        if not self.enabled:
            return {}
        try:
            idx = index or self.INDEX_NAME
            res = self.client.search(index=idx, body=agg_body, size=0)
            return res.get("aggregations", {})
        except Exception as e:
            logger.error(f"Aggregation error: {e}")
            return {}

    def count(self, query: dict = None, index: str = None) -> int:
        """Count documents matching query."""
        if not self.enabled:
            return 0
        try:
            idx = index or self.INDEX_NAME
            body = {"query": query or {"match_all": {}}}
            res = self.client.count(index=idx, body=body)
            return res["count"]
        except Exception as e:
            logger.error(f"Count error: {e}")
            return 0

    def delete_index(self, index: str = None) -> bool:
        """Delete an index."""
        if not self.enabled:
            return False
        try:
            idx = index or self.INDEX_NAME
            if self.client.indices.exists(index=idx):
                self.client.indices.delete(index=idx)
                return True
        except Exception as e:
            logger.error(f"Delete index error: {e}")
        return False

    def health(self) -> dict:
        """Get cluster health info."""
        if not self.enabled:
            return {"status": "disconnected"}
        try:
            return dict(self.client.cluster.health())
        except Exception:
            return {"status": "error"}
