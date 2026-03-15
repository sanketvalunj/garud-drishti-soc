from fastapi import APIRouter
from garud_drishti.backend.utils.json_helpers import load_json
from garud_drishti.ingestion.ingestion_api import IngestionService
from garud_drishti.detectiontemp import DetectionService

router = APIRouter()

@router.post("/detect")
def detect_events():
    """
    Runs ingestion + detection.
    """
    raw = load_json("data/raw_logs/fake_logs.json") or []

    ingestion = IngestionService()
    normalized = ingestion.ingest(raw)

    detector = DetectionService()
    detected = detector.run(normalized)

    return {
        "events_processed": len(detected),
        "anomalies": sum(1 for e in detected if e.get("is_anomaly")),
        "sample": detected[:3]
    }