from fastapi import APIRouter
from garud_drishti.backend.utils.json_helpers import load_json, save_json
from garud_drishti.ingestion.ingestion_api import IngestionService
from garud_drishti.detectiontemp import DetectionService
from garud_drishti.correlation_engine.correlation_service import CorrelationService

router = APIRouter()


@router.get("/incidents")
def get_incidents():
    data = load_json("data/incident_records/incidents.json") or []
    return {"total": len(data), "incidents": data}


@router.post("/build-incidents")
def build_incidents():
    """
    Runs full detection + correlation.
    """

    raw = load_json("data/raw_logs/fake_logs.json") or []

    ingestion = IngestionService()
    normalized = ingestion.ingest(raw)

    detector = DetectionService()
    detected = detector.run(normalized)

    correlation = CorrelationService()
    incidents = correlation.build_incidents(detected)

    save_json("data/incident_records/incidents.json", incidents)

    return {"incidents": len(incidents)}