class ThreatReasoner:
    """
    Analyzes anomalies and correlated incidents to determine the threat type and risk score.
    """
    def __init__(self):
        # Map correlation pattern names (from `correlated_incidents.json`) to threat playbook categories.
        self.pattern_to_threat_type = {
            "transaction_abuse_sequence": "data_breach",
            "data_exfiltration_sequence": "data_breach",
            "credential_access_sequence": "privilege_attack",
            "credentialed_process_execution": "privilege_attack",
            "persistence_change_sequence": "privilege_attack",
            "privilege_escalation_sequence": "privilege_attack",
            "network_reconnaissance_sequence": "reconnaissance",
        }

        # Fallback mapping using MITRE tactics if patterns are not present.
        self.tactic_to_threat_type = {
            "Exfiltration": "data_breach",
            "Collection": "data_breach",
            "Command and Control": "data_breach",
            "Reconnaissance": "reconnaissance",
            "Defense Evasion": "privilege_attack",
            "Persistence": "privilege_attack",
            "Privilege Escalation": "privilege_attack",
        }

    def _infer_threat_type(self, incident: dict) -> str:
        attack_summary = incident.get("attack_summary", {}) if isinstance(incident.get("attack_summary", {}), dict) else {}
        patterns_detected = attack_summary.get("patterns_detected", [])
        if isinstance(patterns_detected, list) and patterns_detected:
            pattern_name = str(patterns_detected[0]).strip()
            return self.pattern_to_threat_type.get(pattern_name, "unknown_threat")

        mitre = incident.get("mitre_attack", {}) if isinstance(incident.get("mitre_attack", {}), dict) else {}
        tactics = mitre.get("tactics", [])
        if isinstance(tactics, list) and tactics:
            for tactic in tactics:
                mapped = self.tactic_to_threat_type.get(str(tactic), None)
                if mapped:
                    return mapped

        return "unknown_threat"

    def analyze(self, incident: dict, anomalies: list) -> dict:
        # Risk scoring is driven by the correlation engine output (no LLM / no full anomaly scan).
        risk_assessment = incident.get("risk_assessment", {}) if isinstance(incident.get("risk_assessment", {}), dict) else {}

        raw_risk_score = risk_assessment.get("risk_score", incident.get("risk_score", 0))
        try:
            risk_score = int(round(float(raw_risk_score)))
        except Exception:
            risk_score = 0

        # Normalize risk level into severity buckets used by playbooks/explanations.
        raw_risk_level = risk_assessment.get("risk_level", incident.get("severity", "LOW"))
        risk_level_str = str(raw_risk_level).upper()
        if risk_level_str in {"CRITICAL", "HIGH"}:
            severity = "high"
        elif risk_level_str in {"MEDIUM"}:
            severity = "medium"
        else:
            severity = "low"

        threat_type = self._infer_threat_type(incident)

        return {"threat_type": threat_type, "risk_score": risk_score, "severity": severity}
