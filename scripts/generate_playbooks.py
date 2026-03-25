import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
from pathlib import Path
from datetime import datetime

from garud_drishti.ai_engine.playbook.generator import PlaybookGenerator

INCIDENT_FILE = Path("data/incident_records/incidents.json")
PLAYBOOK_FILE = Path("data/incident_records/playbooks.json")


def main():

    if not INCIDENT_FILE.exists():
        print("No incidents found")
        PLAYBOOK_FILE.write_text("[]")
        return

    with open(INCIDENT_FILE, "r") as f:
        incidents = json.load(f)

    if not incidents:
        print("No incidents to generate playbooks for")
        PLAYBOOK_FILE.write_text("[]")
        return

    generator = PlaybookGenerator()
    playbooks = []

    for incident in incidents:
        try:
            pb = generator.generate(incident)
        except Exception as e:
            print("⚠️ Playbook fallback used:", e)
            pb = {
                "steps": [
                    "Validate alert",
                    "Check affected systems",
                    "Isolate impacted asset",
                    "Notify security team"
                ],
                "source": "fallback"
            }

        playbooks.append({
            "incident_id": incident.get("incident_id"),
            "generated_at": datetime.now().isoformat(),
            "summary": incident.get("summary"),
            "playbook": pb
        })

    PLAYBOOK_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(PLAYBOOK_FILE, "w") as f:
        json.dump(playbooks, f, indent=2)

    print(f"Generated {len(playbooks)} AI playbooks")


if __name__ == "__main__":
    main()
