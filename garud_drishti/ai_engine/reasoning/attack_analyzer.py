class AttackAnalyzer:
    """
    Analyzes correlated incidents and builds an attack progression chain.
    """
    def __init__(self):
        self.stage_mapping = {
            "port_scan": "reconnaissance",
            "login_failed": "credential_access",
            "login_success": "credential_access",
            "privilege_escalation": "privilege_escalation",
            "data_download": "data_exfiltration"
        }

    def analyze(self, incident: dict) -> dict:
        """
        Build an attack chain based on the incident's timeline of events.
        """
        timeline = incident.get("timeline", [])
        
        # If no timeline but signals exist, extract event_type from signals
        if not timeline and "signals" in incident:
            timeline = [s.get("event_type", "unknown") for s in incident["signals"]]
            
        # If the incident only has an event_type but no timeline, use that as a single event
        if not timeline and "event_type" in incident:
            timeline = [incident["event_type"]]
            
        # Deduplicate sequential events or just map them directly. Let's map directly.
        # But maybe unique stages in order? Let's just map all and then remove exact duplicates sequentially to clean up the output.
        attack_chain = []
        last_stage = None
        for event in timeline:
            stage = self.stage_mapping.get(event, event)
            if stage != last_stage:
                attack_chain.append({"stage": stage})
                last_stage = stage
            
        return {
            "attack_chain": attack_chain,
            "attack_depth": len(attack_chain)
        }
