class VotingEngine:
    def __init__(self):
        pass

    def decide(self, risk, compliance, impact):
        score = round((
            risk.get("risk_score", 0) +
            compliance.get("compliance_score", 0) +
            impact.get("impact_score", 0)
        ) / 3)

        if score >= 8:
            decision = "critical"
        elif score >= 6:
            decision = "high"
        else:
            decision = "medium"

        return {
            "final_score": score,
            "decision": decision
        }
