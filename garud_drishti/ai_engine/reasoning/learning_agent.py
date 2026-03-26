import json
from pathlib import Path
from collections import Counter

class LearningAgent:
    """
    Analyzes analyst feedback to suggest weight adjustments 
    for the ThreatReasoner and VotingEngine.
    """
    def __init__(self):
        self.log_path = Path(__file__).resolve().parent.parent.parent.parent / "garud_drishti" / "data" / "ai_engine" / "decision_log.json"

    def analyze_feedback(self) -> dict:
        """
        Scans logs for False Positives and generates an Optimization Report.
        """
        if not self.log_path.exists():
            return {"error": "No logs found to analyze."}

        with open(self.log_path, "r") as f:
            logs = json.load(f)

        false_positives = [
            log["decision"] for log in logs 
            if log["decision"].get("feedback") == "False Positive"
        ]
        
        total_decisions = len(logs)
        fp_count = len(false_positives)
        
        if fp_count == 0:
            return {
                "status": "Healthy",
                "accuracy_estimate": f"{(total_decisions - fp_count) / total_decisions * 100:.2f}%",
                "recommendations": "No adjustments needed."
            }

        # Identify which threat types are "noisy"
        noisy_threats = Counter([fp.get("threat_type") for fp in false_positives])
        
        recommendations = []
        for threat, count in noisy_threats.items():
            # If more than 20% of decisions for a type are False Positives
            recommendations.append({
                "target_module": "ThreatReasoner",
                "threat_type": threat,
                "issue": f"High False Positive Rate ({count} occurrences)",
                "action": f"REDUCE base_score or anomaly_weight for '{threat}'"
            })

        return {
            "metrics": {
                "total_processed": total_decisions,
                "false_positives": fp_count,
                "precision_rate": f"{(total_decisions - fp_count) / total_decisions * 100:.2f}%"
            },
            "recommendations": recommendations
        }