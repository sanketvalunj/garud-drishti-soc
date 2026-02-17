import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
from pathlib import Path

from garud_drishti.ai_engine.playbook.generator import generate_playbook

INCIDENT_FILE = Path("data/incident_records/incidents.json")
PLAYBOOK_FILE = Path("data/incident_records/playbooks.json")

def main():

    if not INCIDENT_FILE.exists():
        print("No incidents found")
        return

    with open(INCIDENT_FILE, "r") as f:
        incidents = json.load(f)

    playbooks = []

    for incident in incidents:
        pb = generate_playbook(incident)
        playbooks.append(pb)

    PLAYBOOK_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(PLAYBOOK_FILE, "w") as f:
        json.dump(playbooks, f, indent=2)

    print(f"Generated {len(playbooks)} AI playbooks")


if __name__ == "__main__":
    main()