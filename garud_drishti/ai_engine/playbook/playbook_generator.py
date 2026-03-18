class PlaybookGenerator:
    """
    Generates structured SOC response steps.
    """
    def __init__(self):
        self.playbooks = {
            "privilege_escalation_response": [
                "Disable compromised account",
                "Audit admin activity",
                "Reset credentials",
                "Check lateral movement"
            ],
            "data_exfiltration_response": [
                "Block suspicious IP",
                "Review outbound traffic",
                "Inspect accessed files",
                "Notify security team"
            ],
            "network_recon_response": [
                "Monitor source IP",
                "Review firewall logs",
                "Check for successful connections"
            ]
        }

    def generate(self, playbook_name: str) -> dict:
        steps = self.playbooks.get(playbook_name, [
            "Review incident details",
            "Acknowledge alert",
            "Escalate if necessary"
        ])
        
        return {
            "playbook": playbook_name,
            "steps": steps
        }
