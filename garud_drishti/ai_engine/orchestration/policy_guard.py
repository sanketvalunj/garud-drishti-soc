class PolicyGuard:
    """
    Enforces SOC governance policies before response execution.
    """
    def __init__(self):
        pass

    def validate(self, decision: dict) -> dict:
        level = decision.get("decision", "").lower()
        
        if level == "critical":
            decision["requires_approval"] = True
        else:
            decision["requires_approval"] = False

        return decision
