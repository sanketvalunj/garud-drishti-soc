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

        mitre_attack = incident.get("mitre_attack", {})
        tactics = []
        technique_ids = set()

        if isinstance(mitre_attack, dict):
            tactics = mitre_attack.get("tactics", []) if isinstance(mitre_attack.get("tactics", []), list) else []

            # Prefer the flattened "techniques" list when present.
            techniques = mitre_attack.get("techniques", [])
            if isinstance(techniques, list):
                for t in techniques:
                    if isinstance(t, dict) and t.get("technique_id"):
                        technique_ids.add(str(t["technique_id"]))

            # Fallback to event-level candidates.
            if not technique_ids:
                candidates = mitre_attack.get("event_level_candidates", [])
                if isinstance(candidates, list):
                    for c in candidates:
                        if isinstance(c, dict) and c.get("technique_id"):
                            technique_ids.add(str(c["technique_id"]))

        tactics_text = " ".join(str(t) for t in tactics).lower()

        for key, violation_name in self.compliance_rules.items():
            # Technique-id match (e.g. "T1078")
            if str(key).upper().startswith("T") and str(key).upper() in technique_ids:
                if violation_name not in violations:
                    violations.append(violation_name)
                continue

            # Keyword match against MITRE tactics.
            if str(key).lower() in tactics_text:
                if violation_name not in violations:
                    violations.append(violation_name)

        return {
            "compliance_score": 7 if violations else 2,
            "violations": violations
        }
