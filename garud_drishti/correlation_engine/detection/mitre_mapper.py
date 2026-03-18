"""
mitre_mapper.py

Generic MITRE ATT&CK mapping module.

Maps normalized security events to MITRE techniques
using external configuration.

Supports future expansion and integration with
risk scoring and incident generation modules.
"""

import json
from pathlib import Path


class MitreMapper:

    def __init__(self, mapping_path="data/mitre/mitre_attack_mapping.json"):

        mapping_path = Path(mapping_path)

        if not mapping_path.exists():
            raise FileNotFoundError(
                f"MITRE mapping file not found: {mapping_path}"
            )

        with open(mapping_path) as f:
            self.mapping = json.load(f)

        self.mapping = {
            key.lower().strip(): value
            for key, value in self.mapping.items()
        }

    # ---------------------------------------------------

    def map_actions(self, actions):

        mapped = []

        seen = set()

        for action in actions:

            action = action.lower().strip()

            if action not in self.mapping:
                continue

            technique = self.mapping[action]

            tech_id = technique["technique_id"]

            if tech_id in seen:
                continue

            mapped.append({
                "action": action,
                "technique_id": tech_id,
                "technique_name": technique["technique_name"],
                "tactic": technique["tactic"]
            })

            seen.add(tech_id)

        return mapped

    # ---------------------------------------------------

    def map_graph(self, graph):

        actions = []

        for node in graph.nodes:

            action = graph.nodes[node].get("action")

            if action:
                actions.append(action)

        return self.map_actions(actions)

    # ---------------------------------------------------

    def print_mitre(self, techniques):

        print("\nMITRE ATT&CK Techniques:\n")

        if not techniques:
            print("No MITRE techniques mapped.")
            return

        for tech in techniques:

            print(
                f"{tech['technique_id']} - {tech['technique_name']} ({tech['tactic']})"
            )