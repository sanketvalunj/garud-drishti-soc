def calculate_fidelity(group_df, graph):
    """
    Multi-signal fidelity scoring.
    Produces score between 0 and 1.
    """

    score = 0.0

    # multiple systems triggered
    unique_events = group_df["event_type"].nunique()
    score += min(unique_events * 0.15, 0.45)

    # multiple entities involved
    score += min(len(graph["users"]) * 0.1, 0.2)
    score += min(len(graph["devices"]) * 0.1, 0.2)

    # suspicious event keywords
    suspicious_keywords = [
        "login_failed", "powershell", "download",
        "external_connection", "privilege_escalation"
    ]

    for ev in group_df["event_type"].astype(str):
        if any(k in ev for k in suspicious_keywords):
            score += 0.1
            break

    return min(score, 1.0)