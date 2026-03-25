class MitreMapper:
    """
    Maps incident event types to MITRE ATT&CK techniques.
    Offline static mapping (safe for banking deployment).
    """

    MITRE_MAP = {
        "multiple_failed_logins": {
            "technique": "T1110",
            "name": "Brute Force"
        },
        "privilege_escalation": {
            "technique": "T1068",
            "name": "Exploitation for Privilege Escalation"
        },
        "suspicious_ip_access": {
            "technique": "T1078",
            "name": "Valid Accounts"
        },
        "lateral_movement": {
            "technique": "T1021",
            "name": "Remote Services"
        },
        "data_exfiltration": {
            "technique": "T1041",
            "name": "Exfiltration Over C2 Channel"
        }
    }

    def __init__(self):
        pass

    def map(self, interpretation: dict) -> list:
        """
        Return list of MITRE techniques linked to incident.
        """

        event_types = interpretation.get("event_types", [])
        mapped = []

        for event in event_types:
            if event in self.MITRE_MAP:
                mapped.append(self.MITRE_MAP[event])

        return mapped