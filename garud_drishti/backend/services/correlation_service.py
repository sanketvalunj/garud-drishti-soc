from garud_drishti.detection import DetectionService
from .ingestion_service import run_ingestion


def run_detection():
    """
    Runs ingestion + anomaly detection.
    """
    ingestion = run_ingestion()
    events = ingestion["normalized"]

    detector = DetectionService()
    detected = detector.run(events)

    anomalies = sum(1 for e in detected if e.get("is_anomaly"))

    return {
        "events": detected,
        "anomalies": anomalies
    }