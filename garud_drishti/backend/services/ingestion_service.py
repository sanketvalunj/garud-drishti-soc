from garud_drishti.backend.utils.json_helpers import load_json
from garud_drishti.ingestion.ingestion_api import IngestionService


def run_ingestion(path="data/raw_logs/fake_logs.json"):
    """
    Loads raw logs and normalizes them.
    """
    raw = load_json(path) or []
    service = IngestionService()
    normalized = service.ingest(raw)

    return {
        "raw_logs": len(raw),
        "normalized": normalized
    }