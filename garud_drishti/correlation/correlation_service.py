import pandas as pd

from .timeline_generator import build_timeline_groups
from .graph_constructor import build_graph
from .fidelity_scoring import calculate_fidelity
from .incident_builder import build_incident


def correlate_events(events_path="data/normalized_events/events.csv"):
    df = pd.read_csv(events_path)

    groups = build_timeline_groups(df)
    graph = build_graph(df)

    incidents = []

    for g in groups:
        score = compute_fidelity_score(g)

        severity = "low"
        if score > 0.85:
            severity = "high"
        elif score > 0.6:
            severity = "medium"

        summary = build_incident_summary(g)

        incidents.append({
            "incident_id": f"INC-{random.randint(100000,999999)}",
            "severity": severity,
            "fidelity": float(score),
            "risk_score": float(score),
            "timestamp": int(time.time() * 1000),
            "summary": summary
        })

    return incidents