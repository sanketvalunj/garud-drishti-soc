class ThreatReasoner:
    """
    Analyzes anomalies and correlated incidents to determine the threat type and risk score.
    """
    def __init__(self):
        pass

    def analyze(self, incident: dict, anomalies: list) -> dict:
        event_type = incident.get("event_type", incident.get("summary", "generic"))
        
        # Count anomaly signals
        anomaly_count = len(anomalies)
        
        # Base risk score
        risk_score = 5 
        
        # Increase risk score if anomalies > 5
        if anomaly_count > 5:
            risk_score += 2
            
        # Inspect incident event types and classify threat type
        event_type_lower = event_type.lower()
        if "privilege" in event_type_lower or event_type == "privilege_escalation":
            threat_type = "privilege_attack"
            risk_score += 1  # add risk weight
        elif "exfiltration" in event_type_lower or event_type == "data_exfiltration":
            threat_type = "data_breach"
            risk_score = 10  # highest risk
        elif "recon" in event_type_lower or event_type == "reconnaissance":
            threat_type = "reconnaissance"
        else:
            threat_type = event_type
            
        # Classify severity
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
