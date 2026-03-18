class DecisionExplainer:
    """
    Converts AI reasoning outputs into human readable SOC explanations.
    """
    def explain(self, incident, decision, memory):
        explanation = {}
        explanation["incident"] = incident.get("incident_id")
        
        summary_lines = []
        
        # Build explanation from agents and reasoning logic natively
        impact = memory.get("impact", {})
        if impact.get("business_impact") == "critical":
            summary_lines.append("Core banking asset targeted")
            
        incident_type = incident.get("event_type", incident.get("summary", ""))
        events_or_timeline = str(incident.get("timeline", [])) + str(incident_type)
        if "privilege" in events_or_timeline.lower():
            summary_lines.append("Privilege escalation detected")
        elif "exfiltration" in events_or_timeline.lower() or "download" in events_or_timeline.lower():
            summary_lines.append("Data exfiltration detected")
            
        compliance = memory.get("compliance", {})
        if compliance.get("violations"):
            summary_lines.append("Policy violation triggered")
            
        risk = memory.get("risk", {})
        if risk.get("risk_score", 0) >= 8 and not summary_lines:
            summary_lines.append("High technical severity reported")

        explanation["summary_lines"] = summary_lines
        return explanation
