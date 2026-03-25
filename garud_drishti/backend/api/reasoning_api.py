from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
import random
from datetime import datetime

router = APIRouter()

INCIDENT_FILE = Path("data/incident_records/incidents.json")

def load_incidents():
    if not INCIDENT_FILE.exists():
        return []
    with open(INCIDENT_FILE, "r") as f:
        return json.load(f)

def generate_reasoning(incident):
    """
    Reverse-engineers a 'reasoning' object from an incident.
    Simulates what an LLM would output.
    """
    severity = incident.get("severity", "medium")
    story = incident.get("story", "")
    summary = incident.get("summary", "")
    
    # 1. Construct the Prompt (Simulation)
    llm_prompt = f"""
SYSTEM: You are a Tier-3 SOC Analyst AI. Analyze the following security events and determine if this represents a genuine threat.
INPUT_STORY: "{story}"
INSTRUCTIONS:
- Classify the attack type.
- Identify the threat actor's objective.
- List all affected assets.
- Calculate a confidence score (0-1).
- Recommend containment and investigation steps.
""".strip()

    # 2. Derive Analysis
    attack_type = "Unknown Anomaly"
    threat_goal = "Unauthorized access"
    
    if "privilege" in story.lower() or "escalation" in story.lower():
        attack_type = "Privilege Escalation"
        threat_goal = "Gain administrative control"
    elif "lateral" in story.lower():
        attack_type = "Lateral Movement"
        threat_goal = "Expand network footprint"
    elif "exfiltration" in story.lower() or "data" in story.lower():
        attack_type = "Data Exfiltration"
        threat_goal = "Steal sensitive intellectual property"
    
    # 3. Decision Logic
    reasons = []
    if severity == "high":
        reasons.append("Critical assets involved in event chain")
        reasons.append("Pattern matches known APT signatures")
    if "failed" in story.lower():
        reasons.append("Repeated authentication failures detected")
    if "powershell" in story.lower():
        reasons.append("Suspicious PowerShell execution observed")
        
    confidence = 0.85 if severity == "high" else 0.65
    if len(reasons) > 2:
        confidence += 0.1
        
    # 4. Strategy
    containment = [
        "Isolate affected endpoint immediately",
        "Reset credentials for compromised user"
    ]
    investigation = [
        "Review logs for 24h prior to event",
        "Check for persistence mechanisms (Scheduled Tasks, Registry)"
    ]
    
    if attack_type == "Data Exfiltration":
        containment.append("Block outbound traffic to destination IP")
        investigation.append("Analyze DLP logs for sensitive data matching")

    return {
        "incident_id": incident.get("incident_id"),
        "timestamp": datetime.now().isoformat(),
        "model_used": "cryptix-finetuned-7b (Simulated)",
        "fallback": True, # consistent with requirements
        
        "llm_prompt": llm_prompt,
        
        "analysis": {
            "attack_type": attack_type,
            "threat_goal": threat_goal,
            "affected_assets": incident.get("entities", {}).get("assets", []),
            "risk_factors": reasons
        },
        
        "decision_logic": {
            "why_high_risk": f"Detected behavior consistent with {attack_type} targeting critical infrastructure.",
            "confidence": min(confidence, 0.99),
            "reasoning_steps": [
                "Ingested raw signals from multiple sources",
                f"Correlated {incident.get('related_events', 5)} events into a single timeline",
                f"Identified {attack_type} pattern with {(confidence * 100):.0f}% confidence",
                "Mapped activity to MITRE ATT&CK framework"
            ]
        },
        
        "recommended_strategy": {
            "containment": containment,
            "investigation": investigation
        }
    }

@router.get("/reasoning/{incident_id}")
def get_incident_reasoning(incident_id: str):
    incidents = load_incidents()
    incident = next((i for i in incidents if i["incident_id"] == incident_id), None)
    
    if not incident:
        # Generate a fake one if ID is not found (for demo purposes) or error? 
        # Let's error to be correct, but maybe the frontend passes a dummy ID?
        # The frontend will navigate from the incident list, so ID should exist.
        raise HTTPException(status_code=404, detail="Incident not found")
        
    return generate_reasoning(incident)
