"""
pattern_detector.py

Generic pattern detection engine.

Uses configuration-driven detection rules to identify
attack behaviors from correlated event sequences.

Works with ANY event type.
"""

import json
from pathlib import Path
from collections import defaultdict


class PatternDetector:

    def __init__(self, paths, graph, rule_path="data/detection_rules.json"):

        self.paths = paths
        self.graph = graph

        rule_path = Path(rule_path)

        if not rule_path.exists():
            raise FileNotFoundError(f"Rule file not found: {rule_path}")

        with open(rule_path) as f:
            self.rules = json.load(f)

    # ---------------------------------------------------

    def _extract_actions(self, path):

        actions = []

        for node in path:

            action = self.graph.nodes[node].get("action")

            if action:
                actions.append(action.lower().strip())

        return actions

    # ---------------------------------------------------

    def detect_patterns(self):

        detected = defaultdict(int)

        for path in self.paths:

            actions = self._extract_actions(path)

            action_counts = defaultdict(int)

            for action in actions:
                action_counts[action] += 1

            for pattern_name, rule in self.rules.items():

                required_events = rule.get("required_events", [])
                min_occ = rule.get("min_occurrences", 1)

                matched = True

                for event in required_events:

                    if action_counts.get(event, 0) < min_occ:
                        matched = False
                        break

                if matched:
                    detected[pattern_name] += 1

        return dict(detected)

    # ---------------------------------------------------

    def print_patterns(self, patterns):

        print("\nDetected Attack Patterns:\n")

        if not patterns:
            print("No patterns detected.")
            return

        for pattern, count in patterns.items():
            print(f"{pattern}  (Occurrences: {count})")