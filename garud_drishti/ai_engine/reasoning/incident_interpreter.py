class IncidentInterpreter:
    """
    Converts incident record into structured intelligence summary.
    """

    def __init__(self):
        pass

    def interpret(self, incident: dict) -> dict:
        """
        Extract key security signals from incident record.
        """

        signals = incident.get("signals", [])
        assets = set()
        event_types = set()

        for s in signals:
            assets.add(s.get("asset", "unknown"))
            event_types.add(s.get("event_type", "unknown"))

        interpretation = {
            "incident_id": incident.get("incident_id"),
            "asset_count": len(assets),
            "assets": list(assets),
            "event_types": list(event_types),
            "timeline_length": len(signals),
            "anomaly_score": incident.get("anomaly_score", 0),
            "fidelity_score": incident.get("fidelity_score", 0),
        }

        return interpretation