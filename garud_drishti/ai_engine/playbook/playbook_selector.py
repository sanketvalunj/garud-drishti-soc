class PlaybookSelector:
    """
    Selects an appropriate response playbook based on the detected threat.
    """
    def __init__(self):
        self.mapping = {
            "privilege_attack": "privilege_escalation_response",
            "data_breach": "data_exfiltration_response",
            "reconnaissance": "network_recon_response"
        }

    def select(self, threat_type: str) -> str:
        return self.mapping.get(threat_type, "generic_incident_response")
