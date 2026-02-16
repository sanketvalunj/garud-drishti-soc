from fastapi import APIRouter
from garud_drishti.correlation.correlation_service import correlate_events

router = APIRouter()

@router.get("/incidents")
def get_incidents():
    incidents = correlate_events()
    return {"incidents": incidents}