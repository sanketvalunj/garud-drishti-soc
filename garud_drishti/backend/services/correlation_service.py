from garud_drishti.detection import DetectionService
from .ingestion_service import run_ingestion


def run_detection():
    """
    Runs ingestion + anomaly detection pipeline safely.
    """

    ingestion = run_ingestion()

    # ---- tolerate multiple ingestion formats ----
    events = (
        ingestion.get("normalized")
        or ingestion.get("events")
        or ingestion.get("normalized_events")
        or []
    )

    if not events:
        print("⚠️ No events received from ingestion")
        return {"events": [], "anomalies": 0}

    print(f"🔹 Detection received {len(events)} events")

    detector = DetectionService()
    detected = detector.run(events)

    anomalies = sum(1 for e in detected if e.get("is_anomaly"))

    print(f"🔹 Detected anomalies: {anomalies}")

    return {
        "events": detected,
        "anomalies": anomalies
    }
