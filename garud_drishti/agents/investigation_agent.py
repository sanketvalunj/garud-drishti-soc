from garud_drishti.ai_engine.reasoning.threat_reasoner import ThreatReasoner

class InvestigationAgent:
    """
    Performs Phase-2 SOC investigation logic on incidents.
    """
    def __init__(self):
        self.reasoner = ThreatReasoner()

    def investigate(self, context: dict) -> dict:
        """
        Receives SOC context, runs ThreatReasoner, and produces structured investigation summary.
        """
        # Extract anomalies from context
        anomalies = context.get("anomalies", [])
        
        # Extract incident from context, defaulting to first item if inside list 'incidents'
        incident = context.get("incident")
        if not incident and context.get("incidents"):
            incident = context["incidents"][0]
        elif not incident:
            incident = {}
            
        analysis = self.reasoner.analyze(incident, anomalies)
        
        return {
            "summary": "Automated SOC investigation completed",
            "threat_type": analysis["threat_type"],
            "risk_score": analysis["risk_score"],
            "severity": analysis["severity"]
        }