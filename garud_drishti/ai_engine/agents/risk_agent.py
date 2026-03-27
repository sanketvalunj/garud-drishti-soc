from __future__ import annotations

from typing import Any


class RiskAgent:
    """
    Deterministic risk scoring agent.

    This agent must not rely on external datasets for scoring; it derives risk
    purely from the correlation engine incident record (plus optional hints
    from `risk_factors`).
    """

    def __init__(self) -> None:
        pass

    def analyze(self, incident: dict[str, Any], attack_chain=None, risk_factors=None) -> dict[str, Any]:
        risk_assessment = incident.get("risk_assessment", {}) if isinstance(incident.get("risk_assessment", {}), dict) else {}
        raw_score = risk_assessment.get("risk_score", incident.get("risk_score", 0))

        try:
            raw_score_float = float(raw_score)
        except Exception:
            raw_score_float = 0.0

        # Correlation engine risk_score is 0-100. Agents expect a 0-10 scale.
        score_0_10 = int(round(raw_score_float / 10.0))
        score_0_10 = max(0, min(score_0_10, 10))

        raw_level = risk_assessment.get("risk_level", incident.get("severity", "LOW"))
        level_str = str(raw_level).upper()
        if level_str in {"CRITICAL", "HIGH"}:
            severity = "high"
        elif level_str in {"MEDIUM"}:
            severity = "medium"
        else:
            severity = "low"

        # Optional: carry through threat_type from ThreatReasoner if provided.
        threat_type = None
        if isinstance(risk_factors, dict):
            threat_type = risk_factors.get("threat_type")

        # Provide a conservative confidence baseline; the ConfidenceCalibrator
        # will convert it into a final % score.
        confidence = 70

        result: dict[str, Any] = {
            "risk_score": score_0_10,
            "severity": severity,
            "confidence": confidence,
        }
        if threat_type:
            result["threat_type"] = threat_type
        return result
