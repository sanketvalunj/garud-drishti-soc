import uuid


class IncidentBuilder:
    """
    Converts event cluster into incident object.
    """

    def build(self, events: list, graph: dict, fidelity: float):

        summary = events[0].get("event_type", "Suspicious activity")

        return {
            "incident_id": str(uuid.uuid4())[:8],
            "summary": summary,
            "signals": events,
            "graph": graph,
            "fidelity_score": fidelity,
            "anomaly_score": sum(e.get("anomaly_score",0) for e in events)/max(len(events),1),
            "severity": self._severity_from_score(fidelity)
        }

    def _severity_from_score(self, score):
        if score > 80:
            return "Critical"
        if score > 60:
            return "High"
        if score > 40:
            return "Medium"
        return "Low"