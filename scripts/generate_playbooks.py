import json
from pathlib import Path
from datetime import datetime

INPUT_FILE = Path("data/incident_records/incidents.json")
OUTPUT_FILE = Path("data/incident_records/playbooks.json")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(INPUT_FILE, "r") as f:
    incidents = json.load(f)

def build_playbook(incident):

    severity = incident["severity"]

    base_steps = [
        "Verify alert authenticity",
        "Review recent user activity logs",
        "Check login source IP reputation"
    ]

    if severity == "high":
        extra = [
            "Disable affected account temporarily",
            "Check for lateral movement",
            "Scan endpoint for malware",
            "Notify SOC lead immediately"
        ]
    elif severity == "medium":
        extra = [
            "Force password reset",
            "Enable MFA if not enabled",
            "Monitor account activity for next 24h"
        ]
    else:
        extra = [
            "Log event for audit",
            "Continue monitoring"
        ]

    return base_steps + extra

playbooks = []

for incident in incidents:

    pb = {
        "playbook_id": incident["incident_id"],
        "generated_at": datetime.utcnow().isoformat(),
        "incident_severity": incident["severity"],
        "steps": build_playbook(incident)
    }

    playbooks.append(pb)

# Save playbooks
with open(OUTPUT_FILE, "w") as f:
    json.dump(playbooks, f, indent=2)

print("✅ Playbooks generated successfully")
print(f"Saved to: {OUTPUT_FILE}")
print(f"Total playbooks: {len(playbooks)}")