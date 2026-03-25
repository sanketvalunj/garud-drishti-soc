from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
import re
from datetime import datetime

router = APIRouter()

INCIDENT_FILE = Path("data/incident_records/incidents.json")

# MITRE Knowledge Base (Simplified)
MITRE_KB = {
    "initial_access": {
        "id": "TA0001",
        "name": "Initial Access",
        "techniques": {
            "phishing": {"id": "T1566", "name": "Phishing"},
            "login failed": {"id": "T1078", "name": "Valid Accounts"},
            "brute force": {"id": "T1110", "name": "Brute Force"},
        }
    },
    "execution": {
        "id": "TA0002",
        "name": "Execution",
        "techniques": {
            "powershell": {"id": "T1059.001", "name": "Command and Scripting Interpreter: PowerShell"},
            "cmd": {"id": "T1059.003", "name": "Windows Command Shell"},
            "script": {"id": "T1059", "name": "Command and Scripting Interpreter"},
        }
    },
    "persistence": {
        "id": "TA0003",
        "name": "Persistence",
        "techniques": {
            "scheduled task": {"id": "T1053", "name": "Scheduled Task/Job"},
            "registry": {"id": "T1547", "name": "Boot or Logon Autostart Execution"},
            "service": {"id": "T1543", "name": "Create or Modify System Process"},
        }
    },
    "privilege_escalation": {
        "id": "TA0004",
        "name": "Privilege Escalation",
        "techniques": {
            "privilege escalation": {"id": "T1068", "name": "Exploitation for Privilege Escalation"},
            "admin": {"id": "T1078", "name": "Valid Accounts"},
        }
    },
    "lateral_movement": {
        "id": "TA0008",
        "name": "Lateral Movement",
        "techniques": {
            "lateral movement": {"id": "T1021", "name": "Remote Services"},
            "rdp": {"id": "T1021.001", "name": "Remote Desktop Protocol"},
            "ssh": {"id": "T1021.004", "name": "SSH"},
            "moved from": {"id": "T1021", "name": "Remote Services"},
        }
    },
    "exfiltration": {
        "id": "TA0010",
        "name": "Exfiltration",
        "techniques": {
            "exfiltration": {"id": "T1041", "name": "Exfiltration Over C2 Channel"},
            "data loss": {"id": "T1048", "name": "Exfiltration Over Alternative Protocol"},
            "download": {"id": "T1041", "name": "Exfiltration Over C2 Channel"},
        }
    }
}

def load_incidents():
    if not INCIDENT_FILE.exists():
        return []
    with open(INCIDENT_FILE, "r") as f:
        return json.load(f)

def map_incident_to_mitre(incident):
    """
    Analyzes incident story and signals to map to MITRE ATT&CK.
    """
    story = incident.get("story", "").lower()
    summary = incident.get("summary", "").lower()
    signals = incident.get("signals", [])
    
    # Combine text for analysis
    full_text = f"{story} {summary}"
    
    mapped_tactics = {}
    attack_path = []

    # 1. Analyze by Signal Event Types
    for signal in signals:
        evt_type = signal.get("event_type", "").lower()
        # Check against KB
        for tactic_key, tactic_info in MITRE_KB.items():
            for tech_key, tech_info in tactic_info["techniques"].items():
                if tech_key in evt_type:
                    if tactic_key not in mapped_tactics:
                        mapped_tactics[tactic_key] = {
                            "name": tactic_info["name"],
                            "id": tactic_info["id"],
                            "techniques": []
                        }
                    
                    # Add technique if not present
                    existing_tech = next((t for t in mapped_tactics[tactic_key]["techniques"] if t["id"] == tech_info["id"]), None)
                    if not existing_tech:
                        mapped_tactics[tactic_key]["techniques"].append({
                            "id": tech_info["id"],
                            "name": tech_info["name"],
                            "confidence": 0.85, # High confidence if explicit event
                            "evidence": f"Detected '{evt_type}' event on {signal.get('asset', 'unknown asset')}"
                        })

    # 2. Analyze by Text (Story/Summary)
    for tactic_key, tactic_info in MITRE_KB.items():
        for tech_key, tech_info in tactic_info["techniques"].items():
            if tech_key in full_text:
                if tactic_key not in mapped_tactics:
                    mapped_tactics[tactic_key] = {
                        "name": tactic_info["name"],
                        "id": tactic_info["id"],
                        "techniques": []
                    }
                
                # Add technique if not present
                existing_tech = next((t for t in mapped_tactics[tactic_key]["techniques"] if t["id"] == tech_info["id"]), None)
                if not existing_tech:
                    mapped_tactics[tactic_key]["techniques"].append({
                        "id": tech_info["id"],
                        "name": tech_info["name"],
                        "confidence": 0.65, # Lower confidence if just text match
                        "evidence": f"Found reference to '{tech_key}' in incident narrative."
                    })

    # 3. Order Tactics (Kill Chain)
    ordered_tactics = []
    # Define standard order
    kill_chain_order = [
        "initial_access", "execution", "persistence", 
        "privilege_escalation", "lateral_movement", "exfiltration"
    ]
    
    for key in kill_chain_order:
        if key in mapped_tactics:
            ordered_tactics.append(mapped_tactics[key])
            attack_path.append(mapped_tactics[key]["name"])

    return {
        "incident_id": incident.get("incident_id"),
        "tactics": ordered_tactics,
        "attack_path": attack_path,
        "model_used": "Rule-Based Mapper v1.0",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/mitre/{incident_id}")
def get_mitre_mapping(incident_id: str):
    incidents = load_incidents()
    incident = next((i for i in incidents if i["incident_id"] == incident_id), None)
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    return map_incident_to_mitre(incident)
