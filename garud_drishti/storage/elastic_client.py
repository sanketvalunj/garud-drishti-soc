import os

try:
    from elasticsearch import Elasticsearch
except ImportError:
    Elasticsearch = None


class ElasticClient:

    def __init__(self, host=None):
        self.host = host or os.getenv("ES_HOST", "http://localhost:9200")

        if Elasticsearch:
            try:
                self.client = Elasticsearch(self.host)
                self.enabled = True
            except Exception:
                self.client = None
                self.enabled = False
        else:
            self.client = None
            self.enabled = False

    def is_enabled(self):
        return self.enabled

    def index(self, index, doc):
        if not self.enabled:
            return False
        self.client.index(index=index, document=doc)
        return True

    def search(self, index, query=None):
        if not self.enabled:
            return []
        query = query or {"match_all": {}}
        res = self.client.search(index=index, query=query)
        return [hit["_source"] for hit in res["hits"]["hits"]]