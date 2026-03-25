"""
incident_builder.py

Builds final SOC incident objects and saves them as JSON.

This module creates:
• attack timeline
• attack narrative
• MITRE ATT&CK stages
• risk assessment
• structured incident JSON

The output JSON is designed for AI agents and playbook generation.
"""

import uuid
import json
from datetime import datetime
from pathlib import Path


class IncidentBuilder:

    def __init__(
        self,
        user,
        anomaly_score,
        patterns,
        mitre_techniques,
        attack_paths,
        event_sequences,
        risk_score,
        risk_level
    ):

        self.user = user
        self.anomaly_score = anomaly_score
        self.patterns = patterns
        self.mitre_techniques = mitre_techniques
        self.attack_paths = attack_paths
        self.event_sequences = event_sequences
        self.risk_score = risk_score
        self.risk_level = risk_level

    # ---------------------------------------------------
    # Generate incident ID
    # ---------------------------------------------------

    def generate_incident_id(self):

        uid = str(uuid.uuid4())[:8]

        timestamp = datetime.utcnow().strftime("%Y%m%d")

        return f"INC-{timestamp}-{uid}"

    # ---------------------------------------------------
    # Extract MITRE techniques
    # ---------------------------------------------------

    def extract_mitre_techniques(self):

        techniques = set()

        for tech in self.mitre_techniques:
            techniques.add(tech["technique_id"])

        return list(techniques)

    # ---------------------------------------------------
    # Extract MITRE tactics
    # ---------------------------------------------------

    def extract_tactics(self):

        tactics = set()

        for tech in self.mitre_techniques:

            tactic = tech.get("tactic")

            if tactic:
                tactics.add(tactic)

        return list(tactics)

    # ---------------------------------------------------
    # Attack chain complexity
    # ---------------------------------------------------

    def attack_chain_length(self):

        if not self.attack_paths:
            return 0

        return max(len(path) for path in self.attack_paths)

    # ---------------------------------------------------
    # Build attack timeline
    # ---------------------------------------------------

    def build_timeline(self):

        timeline = []

        for user, events in self.event_sequences.items():

            for event in events:

                timeline.append({
                    "timestamp": str(event["timestamp"]),
                    "event": event["action"]
                })

        timeline.sort(key=lambda x: x["timestamp"])

        return timeline

    # ---------------------------------------------------
    # Generate attack narrative
    # ---------------------------------------------------

    def generate_attack_story(self):

        story = []

        story.append(
            f"User {self.user} triggered anomaly detection due to unusual behavioral activity."
        )

        if self.patterns:

            pattern_text = ", ".join(self.patterns.keys())

            story.append(
                f"The correlation engine detected suspicious behaviors including {pattern_text}."
            )

        stages = self.extract_tactics()

        if stages:

            stage_text = " → ".join(stages)

            story.append(
                f"The attack progression follows MITRE ATT&CK stages: {stage_text}."
            )

        chain_len = self.attack_chain_length()

        story.append(
            f"The reconstructed attack chain contains {chain_len} correlated events."
        )

        if "Exfiltration" in stages:

            story.append(
                "The presence of exfiltration techniques indicates possible data theft."
            )

        return " ".join(story)

    # ---------------------------------------------------
    # Build final incident object
    # ---------------------------------------------------

    def build_incident(self):

        incident = {

            "incident_id": self.generate_incident_id(),

            "generated_at": datetime.utcnow().isoformat(),

            "entity": {
                "user": self.user
            },

            "risk_assessment": {
                "risk_score": self.risk_score,
                "risk_level": self.risk_level,
                "anomaly_score": self.anomaly_score
            },

            "attack_summary": {
                "patterns_detected": list(self.patterns.keys()),
                "pattern_counts": self.patterns
            },

            "mitre_attack": {
                "techniques": self.extract_mitre_techniques(),
                "stages": self.extract_tactics()
            },

            "attack_graph": {
                "path_count": len(self.attack_paths),
                "longest_chain": self.attack_chain_length()
            },

            "attack_timeline": self.build_timeline(),

            "attack_story": self.generate_attack_story()

        }

        return incident

    # ---------------------------------------------------
    # Save incident JSON
    # ---------------------------------------------------

    def save_incident(self, incident, output_dir="data/incidents"):

        output_path = Path(output_dir)

        output_path.mkdir(parents=True, exist_ok=True)

        file_path = output_path / f"{incident['incident_id']}.json"

        with open(file_path, "w") as f:
            json.dump(incident, f, indent=4)

        print(f"\nIncident JSON saved at: {file_path}")

        return file_path