import os
from garud_drishti.backend.utils.json_helpers import load_json, save_json
from .elastic_client import ElasticClient


class LogRepository:

    JSON_PATH = "data/normalized_events/events.json"
    INDEX = "garud_logs"

    def __init__(self):
        self.es = ElasticClient()

    # -------------------------
    # SAVE LOGS
    # -------------------------
    def save(self, logs):
        if not logs:
            return

        # JSON storage (always)
        save_json(self.JSON_PATH, logs)

        # Elasticsearch (optional)
        if self.es.is_enabled():
            for log in logs:
                self.es.index(self.INDEX, log)

    # -------------------------
    # LOAD LOGS
    # -------------------------
    def load(self):
        if self.es.is_enabled():
            return self.es.search(self.INDEX)
        return load_json(self.JSON_PATH) or []