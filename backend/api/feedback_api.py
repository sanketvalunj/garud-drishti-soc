import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/feedback", tags=["Feedback Loop"])

# Path to the log file created by DecisionLogger
LOG_FILE = Path(__file__).resolve().parent.parent.parent / "garud_drishti" / "data" / "ai_engine" / "decision_log.json"

class FeedbackUpdate(BaseModel):
    trace_id: str
    incident_id: str
    status: str  # e.g., "True Positive", "False Positive", "Benign"
    analyst_notes: str
    accuracy_score: int  # 1-5 scale of how good the AI's response was

@router.post("/submit")
async def submit_feedback(feedback: FeedbackUpdate):
    """
    Updates a specific AI decision with human expert feedback.
    """
    if not LOG_FILE.exists():
        raise HTTPException(status_code=404, detail="Decision log not found.")

    try:
        # 1. Load existing logs
        with open(LOG_FILE, "r") as f:
            logs = json.load(f)

        # 2. Find and update the specific record
        found = False
        for entry in logs:
            decision = entry.get("decision", {})
            if (decision.get("trace_id") == feedback.trace_id and 
                decision.get("incident_id") == feedback.incident_id):
                
                # Update the feedback fields
                decision["feedback"] = feedback.status
                decision["analyst_notes"] = feedback.analyst_notes
                decision["accuracy_score"] = feedback.accuracy_score
                decision["reviewed_at"] = datetime.utcnow().isoformat()
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail="Incident/Trace ID not found in logs.")

        # 3. Save the updated logs back to the JSON file
        with open(LOG_FILE, "w") as f:
            json.dump(logs, f, indent=2)

        return {"status": "success", "message": f"Feedback recorded for {feedback.incident_id}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update log: {str(e)}")