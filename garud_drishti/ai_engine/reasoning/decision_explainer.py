class DecisionExplainer:
    """
    Converts AI reasoning outputs into human readable SOC explanations.
    """
    def explain(self, incident_id: str, threat_type: str, attack_chain: list, entity_context: dict, risk_score: int):
        explanation: dict = {}
        explanation["incident"] = incident_id
        
        summary_lines = []
        
        # Build explanation dynamically from parameters
        summary_lines.append(f"Detected Threat Classification: {threat_type.replace('_', ' ').title()}")
        
        if attack_chain:
            chain_str = " -> ".join([str(step) for step in attack_chain])
            summary_lines.append(f"Attack Chain Context: {chain_str}")
            
        if entity_context:
            entities = [f"{k}: {v}" for k, v in entity_context.items()]
            summary_lines.append(f"Entity Context: {', '.join(entities)}")
            
        score_denominator = 100 if int(risk_score) > 10 else 10
        summary_lines.append(f"Calculated Risk Score: {risk_score}/{score_denominator}")

        explanation["summary_lines"] = summary_lines
        return explanation
