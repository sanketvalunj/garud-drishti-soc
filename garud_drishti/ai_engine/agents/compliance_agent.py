class ComplianceAgent:
    def __init__(self):
        self.compliance_rules = {
            "privilege": "Unauthorized access policy violation",
            "T1078": "Unauthorized access policy violation",
            "exfiltration": "Data handling policy violation",
            "T1048": "Data handling policy violation",
            "recon": "Network scanning policy trigger"
        }

    def analyze(self, incident: dict) -> dict:
        violations = []
        
        # Check against mapped rules
        events_or_timeline = str(incident.get("timeline", [])).lower() + str(incident.get("event_type", incident.get("summary", ""))).lower()
        mitre = str(incident.get("mitre", "")).upper()
        
        for key, violation_name in self.compliance_rules.items():
            if key.lower() in events_or_timeline or key.upper() == mitre:
                if violation_name not in violations:
                    violations.append(violation_name)
            
        return {
            "compliance_score": 7 if violations else 2,
            "violations": violations
        }
