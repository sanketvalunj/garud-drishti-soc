import uuid

def build_incident(group_df, graph, fidelity):

    incident_id = "INC-" + uuid.uuid4().hex[:6].upper()

    # severity from fidelity
    if fidelity >= 0.75:
        severity = "high"
    elif fidelity >= 0.45:
        severity = "medium"
    else:
        severity = "low"

    first_time = group_df["timestamp"].min()

    summary = generate_summary(group_df, graph, fidelity)

    return {
        "incident_id": incident_id,
        "timestamp": str(first_time),
        "severity": severity,
        "fidelity_score": fidelity,
        "summary": summary,
        "graph": graph,
        "event_count": len(group_df)
    }


def generate_summary(group_df, graph, fidelity):

    users = ", ".join(graph["users"]) if graph["users"] else "unknown user"
    devices = ", ".join(graph["devices"]) if graph["devices"] else "unknown device"

    return (
        f"Suspicious activity involving {users} on {devices}. "
        f"{len(group_df)} related events detected. "
        f"Confidence score: {round(fidelity,2)}."
    )