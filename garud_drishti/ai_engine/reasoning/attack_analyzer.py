class AttackAnalyzer:
    """
    Analyzes correlated incidents and builds an attack progression chain.
    """
    def analyze(self, incident: dict) -> dict:
        """
        Build an attack chain from correlation engine output.

        The correlation step produces MITRE tactics and detected patterns, but not
        an event-level timeline; so we derive an ordered chain from those fields.
        """
        attack_chain: list[str] = []

        mitre = incident.get("mitre_attack", {}) if isinstance(incident.get("mitre_attack", {}), dict) else {}
        tactics = mitre.get("tactics", [])
        if isinstance(tactics, list) and tactics:
            for tactic in tactics:
                stage = str(tactic).strip().lower().replace(" ", "_")
                if stage and (not attack_chain or attack_chain[-1] != stage):
                    attack_chain.append(stage)

        if not attack_chain:
            attack_summary = incident.get("attack_summary", {}) if isinstance(incident.get("attack_summary", {}), dict) else {}
            patterns_detected = attack_summary.get("patterns_detected", [])
            if isinstance(patterns_detected, list) and patterns_detected:
                for pattern_name in patterns_detected:
                    stage = str(pattern_name).strip().lower()
                    if stage and (not attack_chain or attack_chain[-1] != stage):
                        attack_chain.append(stage)

        return {
            "attack_chain": attack_chain,
            "attack_depth": len(attack_chain)
        }
