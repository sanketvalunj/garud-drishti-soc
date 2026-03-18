class ConfidenceCalibrator:
    def calibrate(self, risk, compliance, impact):
        scores = [
            risk.get("risk_score", 0),
            compliance.get("compliance_score", 0),
            impact.get("impact_score", 0)
        ]

        confidence = sum(scores) / (len(scores) * 10)
        return round(confidence, 2)
