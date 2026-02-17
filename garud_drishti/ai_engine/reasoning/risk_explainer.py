class RiskExplainer:
    """
    Generates human-readable explanation of incident severity.
    """

    def __init__(self):
        pass

    def explain(self, incident: dict, interpretation: dict, mitre_matches: list) -> dict:
        """
        Build structured risk explanation.
        """

        fidelity = incident.get("fidelity_score", 0)
        anomaly = incident.get("anomaly_score", 0)

        # Basic severity logic
        if fidelity > 80:
            severity = "Critical"
        elif fidelity > 60:
            severity = "High"
        elif fidelity > 40:
            severity = "Medium"
        else:
            severity = "Low"

        explanation = {
            "incident_id": incident.get("incident_id"),
            "severity": severity,
            "reasoning": {
                "fidelity_score": fidelity,
                "anomaly_score": anomaly,
                "affected_assets": interpretation.get("assets", []),
                "timeline_events": interpretation.get("timeline_length", 0),
                "mitre_techniques": mitre_matches,
            },
            "summary": (
                f"Incident involves {interpretation.get('asset_count')} assets "
                f"with anomaly score {anomaly} and fidelity {fidelity}. "
                f"Mapped to {len(mitre_matches)} MITRE techniques."
            )
        }

        return explanation