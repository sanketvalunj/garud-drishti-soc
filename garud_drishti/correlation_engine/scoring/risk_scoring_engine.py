"""
risk_scoring_engine.py

Generic and scalable risk scoring engine.

This module calculates risk scores using multiple signals
such as anomaly score, attack chain complexity, detected
patterns, and MITRE ATT&CK techniques.

Designed to work with ANY type of security event.
"""

import json
from pathlib import Path


class RiskScoringEngine:

    def __init__(self, config_path="data/risk_config.json"):

        config_path = Path(config_path)

        if not config_path.exists():
            raise FileNotFoundError(
                f"Risk config not found: {config_path}"
            )

        with open(config_path) as f:
            self.config = json.load(f)

        self.weights = self.config["weights"]
        self.tactic_severity = self.config["tactic_severity"]

        self.max_score = 100

    # ---------------------------------------------------
    # Anomaly component
    # ---------------------------------------------------

    def score_anomaly(self, anomaly_score):

        weight = self.weights["anomaly_score"]

        return anomaly_score * weight

    # ---------------------------------------------------
    # MITRE technique diversity
    # ---------------------------------------------------

    def score_mitre_techniques(self, mitre_techniques):

        unique_techniques = {
            tech["technique_id"]
            for tech in mitre_techniques
        }

        weight = self.weights["mitre_techniques"]

        return min(len(unique_techniques) * 5, weight)

    # ---------------------------------------------------
    # MITRE tactic severity
    # ---------------------------------------------------

    def score_tactics(self, mitre_techniques):

        total = 0

        seen = set()

        for tech in mitre_techniques:

            tactic = tech.get("tactic")

            if tactic and tactic not in seen:

                total += self.tactic_severity.get(tactic, 5)

                seen.add(tactic)

        return min(total, self.weights["tactic_severity"])

    # ---------------------------------------------------
    # Attack chain complexity
    # ---------------------------------------------------

    def score_attack_chain(self, attack_paths):

        if not attack_paths:
            return 0

        longest = max(len(path) for path in attack_paths)

        weight = self.weights["attack_chain"]

        return min(longest * 2, weight)

    # ---------------------------------------------------
    # Pattern count score
    # ---------------------------------------------------

    def score_patterns(self, patterns):

        pattern_count = sum(patterns.values())

        weight = self.weights["patterns"]

        return min(pattern_count * 3, weight)

    # ---------------------------------------------------
    # Final risk score
    # ---------------------------------------------------

    def calculate_risk_score(
        self,
        anomaly_score,
        patterns,
        mitre_techniques,
        attack_paths
    ):

        score = 0

        score += self.score_anomaly(anomaly_score)

        score += self.score_mitre_techniques(mitre_techniques)

        score += self.score_tactics(mitre_techniques)

        score += self.score_attack_chain(attack_paths)

        score += self.score_patterns(patterns)

        return min(int(score), self.max_score)

    # ---------------------------------------------------
    # Risk classification
    # ---------------------------------------------------

    def classify_risk(self, score):

        if score >= 80:
            return "CRITICAL"

        if score >= 60:
            return "HIGH"

        if score >= 40:
            return "MEDIUM"

        return "LOW"