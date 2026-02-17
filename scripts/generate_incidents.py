import json
from pathlib import Path
from datetime import datetime
from uuid import uuid4

from garud_drishti.correlation.correlation_service import correlate_events

OUT = Path("data/incident_records/incidents.json")
OUT.parent.mkdir(parents=True, exist_ok=True)


def severity_from_fidelity(score):
    if score > 0.85:
        return "high"
    elif score > 0.6:
        return "medium"
    else:
        return "low"


def main():

    incidents = correlate_events()

    final_incidents = []

    for inc in incidents:

        # tolerate different correlation field names
        fidelity = (
            inc.get("fidelity_score")
            or inc.get("fidelity")
            or inc.get("risk_score")
            or 0.5
        )

        final_incidents.append({
            "incident_id": inc.get("incident_id", str(uuid4())),
            "timestamp": datetime.now().isoformat(),
            "severity": severity_from_fidelity(fidelity),
            "risk_score": fidelity,
            "summary": inc.get(
                "summary",
                "Correlated suspicious activity detected"
            ),
            "recommended_action":
                "Review correlated events and initiate response workflow",
            "related_events":
                inc.get("event_count", inc.get("events", 0)),
            "entities": inc.get("entities", {})
        })

    with open(OUT, "w") as f:
        json.dump(final_incidents, f, indent=2)

    print(f"Generated {len(final_incidents)} CORRELATED incidents")


if __name__ == "__main__":
    main()