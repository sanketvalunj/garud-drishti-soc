"""Configuration-driven attack pattern detection over extracted graph paths."""

from __future__ import annotations

import json
from collections import Counter
from datetime import timedelta
from pathlib import Path
from typing import Any


class PatternDetector:
    """Detect ordered multi-stage patterns from event-time paths."""

    def __init__(
        self,
        paths: list[dict[str, Any]],
        graph,
        # Use POSIX-style paths (forward slashes) for macOS/Linux compatibility.
        rule_path: str | Path = "garud_drishti/correlation_engine/config/detection_rules.json",
    ) -> None:
        self.paths = paths
        self.graph = graph

        config_file = Path(rule_path)
        if not config_file.exists():
            raise FileNotFoundError(f"Rule file not found: {config_file}")

        with open(config_file, encoding="utf-8") as handle:
            self.rules: dict[str, dict[str, Any]] = json.load(handle)

    def _events_for_path(self, path: dict[str, Any]) -> list[dict[str, Any]]:
        events = [dict(self.graph.nodes[node_id]) for node_id in path.get("node_ids", []) if node_id in self.graph.nodes]
        events.sort(key=lambda event: (event.get("timestamp"), event.get("event_code", "unknown.event")))
        return events

    @staticmethod
    def _event_matches_stage(event: dict[str, Any], stage: dict[str, Any]) -> bool:
        candidates = []
        if "event_code" in stage:
            candidates.append(str(stage["event_code"]).strip().lower())
        if "event_code_any_of" in stage:
            candidates.extend(str(item).strip().lower() for item in stage.get("event_code_any_of", []))
        return str(event.get("event_code", "unknown.event")).strip().lower() in set(candidates)

    def _match_rule(self, path: dict[str, Any], rule_name: str, rule: dict[str, Any]) -> dict[str, Any] | None:
        events = self._events_for_path(path)
        stages = [stage for stage in rule.get("sequence", []) if isinstance(stage, dict)]
        if not events or not stages:
            return None

        cursor = 0
        matched_events: list[dict[str, Any]] = []
        first_timestamp = None
        within = timedelta(minutes=int(rule.get("within_minutes", 10)))

        for stage in stages:
            stage_matches: list[dict[str, Any]] = []
            minimum = int(stage.get("min_occurrences", 1))

            while cursor < len(events):
                event = events[cursor]
                cursor += 1
                if not self._event_matches_stage(event, stage):
                    continue

                if first_timestamp is None:
                    first_timestamp = event.get("timestamp")
                if first_timestamp is not None and event.get("timestamp") is not None:
                    if event["timestamp"] - first_timestamp > within:
                        return None

                stage_matches.append(event)
                if len(stage_matches) >= minimum:
                    matched_events.extend(stage_matches)
                    break
            else:
                return None

        matched_sources = sorted({str(event.get("source_system", "unknown")) for event in matched_events})
        minimum_sources = int(rule.get("minimum_distinct_sources", 1))
        if len(matched_sources) < minimum_sources:
            return None

        start_time = matched_events[0].get("timestamp")
        end_time = matched_events[-1].get("timestamp")
        return {
            "pattern_name": rule_name,
            "description": str(rule.get("description", "")).strip(),
            "severity": str(rule.get("severity", "medium")).strip().lower(),
            "sequence_id": path.get("sequence_id"),
            "entity_key": path.get("entity_key"),
            "entity_type": path.get("entity_type"),
            "path_id": path.get("path_id"),
            "matched_event_ids": [str(event.get("event_id") or "") for event in matched_events],
            "matched_event_codes": [str(event.get("event_code", "unknown.event")) for event in matched_events],
            "source_systems": matched_sources,
            "start_time": start_time,
            "end_time": end_time,
            "within_minutes": int(rule.get("within_minutes", 10)),
        }

    def detect_patterns(self) -> list[dict[str, Any]]:
        """Return detailed pattern matches across all paths."""

        matches: list[dict[str, Any]] = []

        for path in self.paths:
            for pattern_name, rule in self.rules.items():
                matched = self._match_rule(path=path, rule_name=pattern_name, rule=rule)
                if matched is not None:
                    matches.append(matched)

        return matches

    @staticmethod
    def summarize_patterns(patterns: list[dict[str, Any]]) -> dict[str, int]:
        """Return per-pattern occurrence counts."""

        counter = Counter(pattern["pattern_name"] for pattern in patterns)
        return dict(counter)

    def print_patterns(self, patterns: list[dict[str, Any]]) -> None:
        """Print a readable pattern summary."""

        print("\nDetected Attack Patterns:\n")

        if not patterns:
            print("No patterns detected.")
            return


        for pattern_name, count in self.summarize_patterns(patterns).items():
            print(f"{pattern_name} (Occurrences: {count})")

