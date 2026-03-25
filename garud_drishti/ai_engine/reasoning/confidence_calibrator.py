class ConfidenceCalibrator:
    def calibrate(self, risk: dict, compliance: dict, impact: dict) -> float:
        risk_score = risk.get("risk_score", 0)
        compliance_score = compliance.get("compliance_score", 0)
        impact_score = impact.get("impact_score", 0)

        # Apply pure weighted formula
        # Weights: Risk (50%), Impact (30%), Compliance (20%)
        weighted_avg = (risk_score * 0.5) + (impact_score * 0.3) + (compliance_score * 0.2)
        
        confidence = (weighted_avg / 10) * 100 # percentage scale
        return round(confidence, 2)
