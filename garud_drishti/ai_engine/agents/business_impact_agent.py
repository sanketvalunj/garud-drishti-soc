class BusinessImpactAgent:
    def __init__(self):
        self.asset_impact_map = {
            "core-banking": {"impact": "critical", "score": 10},
            "database": {"impact": "high", "score": 8},
            "workstation": {"impact": "moderate", "score": 4},
            "default": {"impact": "low", "score": 2}
        }

    def assess(self, incident: dict) -> dict:
        asset = str(incident.get("asset", "")).lower()
        if not asset and incident.get("signals"):
            asset = str(incident["signals"][0].get("asset", "")).lower()
            
        incident_context = str(incident).lower()
        
        # Determine rule match intelligently
        matched_rule = self.asset_impact_map["default"]
        for key, impact_data in self.asset_impact_map.items():
            if key != "default" and (key in asset or key in incident_context):
                matched_rule = impact_data
                break

        return {
            "business_impact": matched_rule["impact"],
            "impact_score": matched_rule["score"]
        }
