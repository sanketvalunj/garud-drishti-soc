"""Config-driven, incident-local risk scoring for the correlation engine."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class RiskScoringEngine:
    """Combine anomaly, sequence, MITRE, and entity context signals into final risk."""

    def __init__(
        self,
        # Use POSIX-style paths (forward slashes) for macOS/Linux compatibility.
        config_path: str | Path = "garud_drishti/correlation_engine/config/risk_config.json",
        entity_weights_path: str | Path = "garud_drishti/correlation_engine/config/entity_weights.json",
    ) -> None:
        self.config = self._load_json(config_path)
        self.entity_weights = self._load_json(entity_weights_path)
        self.weights = self.config["weights"]
        self.thresholds = self.config["thresholds"]
        self.pattern_severity = self.config.get("pattern_severity", {})
        self.tactic_severity = self.config.get("tactic_severity", {})
        self.max_score = int(self.config.get("max_score", 100))

    @staticmethod
    def _load_json(path_value: str | Path) -> dict[str, Any]:
        path = Path(path_value)
        if not path.exists():
            raise FileNotFoundError(f"Risk configuration not found: {path}")
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, dict):
            raise ValueError(f"Risk configuration must contain a JSON object: {path}")
        return payload

    def _severity_component(self, events: list[dict[str, Any]]) -> float:
        severity_weights = self.entity_weights.get("severity_weights", {})
        total = sum(float(severity_weights.get(str(event.get("severity", "unknown")).lower(), 1.0)) for event in events)
        return min(total, float(self.weights.get("event_severity", 10.0)))

    def _risk_flag_component(self, events: list[dict[str, Any]]) -> float:
        risk_flag_weights = self.entity_weights.get("risk_flag_weights", {})
        total = sum(float(risk_flag_weights.get(str(event.get("risk_flag", "unknown")).lower(), 0.0)) for event in events)
        return min(total, float(self.weights.get("risk_flags", 8.0)))

    def _anomaly_component(self, events: list[dict[str, Any]]) -> tuple[float, dict[str, float]]:
        scores = [float(event.get("anomaly_score", 0.0) or 0.0) for event in events]
        if not scores:
            return 0.0, {"max_anomaly_score": 0.0, "mean_anomaly_score": 0.0}

        maximum = max(scores)
        mean_value = sum(scores) / len(scores)
        component = min((maximum * 12.0) + (mean_value * 6.0), float(self.weights.get("anomaly_score", 18.0)))
        return component, {"max_anomaly_score": round(maximum, 4), "mean_anomaly_score": round(mean_value, 4)}

    def _pattern_component(self, patterns: list[dict[str, Any]]) -> float:
        unique_patterns = {pattern["pattern_name"] for pattern in patterns}
        total = sum(float(self.pattern_severity.get(pattern_name, 8.0)) for pattern_name in unique_patterns)
        return min(total, float(self.weights.get("pattern_score", 22.0)))

    def _mitre_component(self, event_mitre: list[dict[str, Any]], pattern_mitre: list[dict[str, Any]]) -> tuple[float, float, float]:
        candidate_count = len({item["technique_id"] for item in event_mitre})
        confirmed_count = len({item["technique_id"] for item in pattern_mitre})
        candidate_score = min(candidate_count * 2.0, float(self.weights.get("candidate_techniques", 8.0)))
        confirmed_score = min(confirmed_count * 4.0, float(self.weights.get("confirmed_techniques", 14.0)))

        unique_tactics = set()
        for item in event_mitre + pattern_mitre:
            for tactic in item.get("tactics", []):
                if tactic:
                    unique_tactics.add(str(tactic))
        tactic_score = min(
            sum(float(self.tactic_severity.get(tactic, 3.0)) for tactic in unique_tactics),
            float(self.weights.get("tactic_severity", 12.0)),
        )
        return candidate_score, confirmed_score, tactic_score

    def _source_diversity_component(self, events: list[dict[str, Any]]) -> float:
        sources = {str(event.get("source_system", "unknown")).lower() for event in events}
        total = 0.0
        source_weights = self.entity_weights.get("source_system_weights", {})
        for source in sources:
            total += float(source_weights.get(source, source_weights.get("unknown", 1.0)))
        return min(total, float(self.weights.get("source_diversity", 5.0)))

    def _entity_context_component(self, sequence: dict[str, Any], events: list[dict[str, Any]]) -> float:
        role_keywords = [str(item).lower() for item in self.entity_weights.get("privileged_role_keywords", [])]
        asset_keywords = [str(item).lower() for item in self.entity_weights.get("critical_asset_keywords", [])]
        score = 0.0

        roles = " ".join(str(event.get("role", "")) for event in events).lower()
        asset_text = " ".join(str(event.get("asset_id", "")) for event in events).lower()
        if any(keyword in roles for keyword in role_keywords):
            score += float(self.entity_weights.get("privileged_role_bonus", 0.0))
        if any(keyword in asset_text for keyword in asset_keywords):
            score += float(self.entity_weights.get("critical_asset_bonus", 0.0))
        if str(sequence.get("entity_type", "")) == "session":
            score += 1.0

        return min(score, float(self.weights.get("entity_context", 6.0)))

    def _path_component(self, path: dict[str, Any]) -> float:
        return min(float(path.get("length", 0)) * 1.0, float(self.weights.get("path_length", 5.0)))

    def _duplicate_penalty(self, sequence: dict[str, Any]) -> float:
        duplicate_count = int(sequence.get("duplicate_count", 0))
        return min(float(duplicate_count) * 0.5, float(self.weights.get("duplicate_penalty", 4.0)))

    def calculate_incident_risk(
        self,
        sequence: dict[str, Any],
        path: dict[str, Any],
        pattern_matches: list[dict[str, Any]],
        event_mitre: list[dict[str, Any]],
        pattern_mitre: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Calculate a final risk score for a single incident candidate."""

        events = sequence.get("events", [])
        anomaly_component, anomaly_stats = self._anomaly_component(events)
        candidate_score, confirmed_score, tactic_score = self._mitre_component(event_mitre, pattern_mitre)

        components = {
            "pattern_score": round(self._pattern_component(pattern_matches), 2),
            "event_severity": round(self._severity_component(events), 2),
            "risk_flags": round(self._risk_flag_component(events), 2),
            "anomaly_score": round(anomaly_component, 2),
            "candidate_techniques": round(candidate_score, 2),
            "confirmed_techniques": round(confirmed_score, 2),
            "tactic_severity": round(tactic_score, 2),
            "source_diversity": round(self._source_diversity_component(events), 2),
            "path_length": round(self._path_component(path), 2),
            "entity_context": round(self._entity_context_component(sequence, events), 2),
            "duplicate_penalty": round(self._duplicate_penalty(sequence), 2),
        }

        total = (
            components["pattern_score"]
            + components["event_severity"]
            + components["risk_flags"]
            + components["anomaly_score"]
            + components["candidate_techniques"]
            + components["confirmed_techniques"]
            + components["tactic_severity"]
            + components["source_diversity"]
            + components["path_length"]
            + components["entity_context"]
            - components["duplicate_penalty"]
        )

        final_score = min(max(int(round(total)), 0), self.max_score)
        return {
            "risk_score": final_score,
            "risk_level": self.classify_risk(final_score),
            "alert_threshold_met": final_score >= int(self.thresholds["medium"]),
            "components": components,
            "anomaly_contribution": anomaly_stats,
        }

    def classify_risk(self, score: int) -> str:
        """Classify the risk score into a severity level."""

        if score >= int(self.thresholds["critical"]):
            return "CRITICAL"
        if score >= int(self.thresholds["high"]):
            return "HIGH"
        if score >= int(self.thresholds["medium"]):
            return "MEDIUM"
        return "LOW"
