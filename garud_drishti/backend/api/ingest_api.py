from fastapi import APIRouter
from garud_drishti.backend.utils.json_helpers import load_json
from garud_drishti.ingestion.ingestion_api import IngestionService

router = APIRouter()

@router.post("/ingest")
def ingest_logs():
    """
    Runs ingestion step only.
    """
    raw = load_json("data/raw_logs/fake_logs.json") or []
    service = IngestionService()
    normalized = service.ingest(raw)

    return {
        "raw_logs": len(raw),
        "normalized": len(normalized),
        "sample": normalized[:3]
    }