class ComplianceAgent:
    def __init__(self):
        pass

    def analyze(self, incident):
        violations = []
        
        # Check if privilege escalation is in the attack chain or timeline
        events_or_timeline = str(incident.get("timeline", [])) + str(incident.get("event_type", incident.get("summary", "")))
        mitre = incident.get("mitre", "")
        
        if "privilege_escalation" in events_or_timeline or mitre == "T1078":
            violations.append("Unauthorized access policy violation")
            
        return {
            "compliance_score": 7 if violations else 2,
            "violations": violations
        }
