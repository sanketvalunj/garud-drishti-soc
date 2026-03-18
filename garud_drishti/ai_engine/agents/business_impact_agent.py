class BusinessImpactAgent:
    def __init__(self):
        pass

    def assess(self, incident):
        # Infer asset from incident, or from timeline events if structured
        asset = incident.get("asset", "")
        # sometimes it could be in the first signal
        if not asset and incident.get("signals"):
            asset = incident["signals"][0].get("asset", "")
            
        if "core-banking" in str(incident) or asset == "core-banking":
            impact = "critical"
        else:
            impact = "moderate"

        return {
            "business_impact": impact,
            "impact_score": 8 if impact == "critical" else 4
        }
