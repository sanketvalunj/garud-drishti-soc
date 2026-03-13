import json
from pathlib import Path
from datetime import datetime
from uuid import uuid4

import pandas as pd

from garud_drishti.correlation.correlation_service import CorrelationService

OUT = Path("data/incident_records/incidents.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

EVENTS_FILE = Path("data/normalized_events/events.json")
ANOM_FILE = Path("data/incident_records/anomaly_results.csv")


def severity_from_fidelity(score):
    if score > 0.85:
        return "high"
    elif score > 0.6:
        return "medium"
    else:
        return "low"


# ---------------------------------------------------
# INCIDENT STORY GENERATOR
# ---------------------------------------------------
def build_incident_story(signals, summary):
    if not signals:
        return "No detailed event chain available."

    signals = sorted(signals, key=lambda x: x.get("timestamp", ""))

    parts = []

    first = signals[0]
    user = first.get("user", "unknown user")
    asset = first.get("asset", "unknown system")
    ip = first.get("source_ip", "unknown IP")

    parts.append(
        f"User {user} initiated activity on {asset} from IP {ip}."
    )

    for prev, curr in zip(signals, signals[1:]):
        if prev.get("asset") != curr.get("asset"):
            parts.append(
                f"Activity then moved from {prev.get('asset')} "
                f"to {curr.get('asset')}."
            )

        if prev.get("event_type") != curr.get("event_type"):
            parts.append(
                f"A {curr.get('event_type','event').replace('_',' ')} "
                f"event was observed."
            )

    parts.append(
        f"This sequence indicates possible {summary.replace('_',' ')} behaviour."
    )

    return " ".join(parts)


# ---------------------------------------------------
# MAIN PIPELINE
# ---------------------------------------------------
def main():
    # Ensure normalized events exist
    if not EVENTS_FILE.exists():
        print(f"⚠️ No events file found at {EVENTS_FILE}")
        print("Running normalization first...")
        import subprocess
        subprocess.run(["python", "scripts/normalize_logs.py"], check=True)

    with open(EVENTS_FILE, "r") as f:
        events = json.load(f)

    print("Loaded events:", len(events))

    # Ensure anomaly file exists
    if not ANOM_FILE.exists():
        print("⚠️ No anomaly file found. Running detection...")
        import subprocess
        subprocess.run(["python", "scripts/detect_anomalies.py"], check=True)

    anomaly_df = pd.read_csv(ANOM_FILE)

    # Align lengths safely
    usable_len = min(len(events), len(anomaly_df))

    enriched_events = []
    for i in range(usable_len):
        e = events[i]
        e["is_anomaly"] = int(anomaly_df.loc[i, "is_anomaly"])
        e["anomaly_score"] = float(anomaly_df.loc[i, "anomaly_score"])
        enriched_events.append(e)

    # Filter suspicious only
    suspicious_events = [e for e in enriched_events if e["is_anomaly"] == 1]

    print("Suspicious events:", len(suspicious_events))

    if not suspicious_events:
        print("⚠️ No anomalous events found. Correlation skipped.")
        OUT.write_text("[]")
        return

    # Run correlation engine
    service = CorrelationService()
    incidents = service.build_incidents(suspicious_events)

    print("Raw correlated incidents:", len(incidents))

    # Convert to final output
    final_incidents = []

    for inc in incidents:
        fidelity = (
            inc.get("fidelity_score")
            or inc.get("fidelity")
            or inc.get("risk_score")
            or 0.5
        )

        signals = inc.get("signals", [])

        story = build_incident_story(
            signals,
            inc.get("summary", "suspicious activity")
        )

        final_incident = {
            "incident_id": inc.get("incident_id", str(uuid4())),
            "timestamp": datetime.now().isoformat(),
            "severity": severity_from_fidelity(fidelity),
            "risk_score": fidelity,
            "summary": inc.get(
                "summary",
                "Correlated suspicious activity detected"
            ),
            "story": story,
            "signals": signals,
            "recommended_action":
                "Review correlated events and initiate response workflow",
            "related_events": len(signals),
            "entities": {
                "assets": list({s.get("asset") for s in signals}),
                "users": list({s.get("user") for s in signals}),
                "ips": list({s.get("source_ip") for s in signals}),
            },
            "graph": inc.get("graph", {})
        }

        # Clean duplicate edges in graph
        if "graph" in inc:
            edges = inc["graph"].get("edges", [])
            unique = []
            seen = set()
            for e in edges:
                key = (e["from"], e["to"])
                if key not in seen:
                    seen.add(key)
                    unique.append(e)
            
            # Update the graph edges in the final object, not the original 'inc'
            if "graph" not in final_incident:
                final_incident["graph"] = {}
            final_incident["graph"]["edges"] = unique
            final_incident["graph"]["nodes"] = inc["graph"].get("nodes", [])

        final_incidents.append(final_incident)

    # Save incidents
    with open(OUT, "w") as f:
        json.dump(final_incidents, f, indent=2)

    print(f"Generated {len(final_incidents)} CORRELATED incidents")


if __name__ == "__main__":
    main()
