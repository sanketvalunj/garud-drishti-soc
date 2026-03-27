from fastapi import APIRouter

router = APIRouter(prefix="/anomaly", tags=["Anomaly"])

@router.get("/detect")
async def detect_anomalies():
    return {"status": "inactive", "message": "Anomaly detection placeholder"}
