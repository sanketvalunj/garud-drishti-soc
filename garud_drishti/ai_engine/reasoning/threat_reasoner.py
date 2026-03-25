class ThreatReasoner:
    """
    Analyzes anomalies and correlated incidents to determine the threat type and risk score.
    """
    def __init__(self):
        # Rule-based weighted config
        self.threat_rules = {
            "privilege": {"type": "privilege_attack", "base_score": 6, "anomaly_weight": 0.5},
            "exfiltration": {"type": "data_breach", "base_score": 8, "anomaly_weight": 0.8},
            "recon": {"type": "reconnaissance", "base_score": 4, "anomaly_weight": 0.2},
            "default": {"type": "unknown_threat", "base_score": 5, "anomaly_weight": 0.3}
        }

    def analyze(self, incident: dict, anomalies: list) -> dict:
        event_type = incident.get("event_type") or incident.get("summary") or "generic"
        if not isinstance(event_type, str):
            event_type = str(event_type)
        event_type = event_type.lower()
        anomaly_count = len(anomalies)
        
        # Match rule based on keyword
        matched_rule = self.threat_rules["default"]
        for key, rule in self.threat_rules.items():
            if key in event_type:
                matched_rule = rule
                break
                
        threat_type = str(matched_rule["type"])
        base_score = float(matched_rule["base_score"])
        anomaly_weight = float(matched_rule["anomaly_weight"])
        
        risk_score = base_score + (anomaly_count * anomaly_weight)
        risk_score = int(min(round(risk_score), 10))  # Cap at 10
        
        # Classify severity based on final score
        if risk_score >= 8:
            severity = "high"
        elif risk_score >= 5:
            severity = "medium"
        else:
            severity = "low"
            
        return {
            "threat_type": threat_type,
            "risk_score": risk_score,
            "severity": severity
        }
