"""Build SOC incident objects and persist them under ``garud_drishti/data``."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class IncidentBuilder:
    """Create and persist incident payloads from correlation outputs."""

    def __init__(
        self,
        by_incident_dir: str | Path = r"garud_drishti\data\incidents\by_incident",
        index_path: str | Path = r"garud_drishti\data\incidents\correlated_incidents.json",
    ) -> None:
        self.by_incident_dir = Path(by_incident_dir)
        self.index_path = Path(index_path)

    @staticmethod
    def _serialize_timestamp(value: Any) -> str:
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value or "")

    def _generate_incident_id(self, sequence: dict[str, Any], patterns: list[dict[str, Any]]) -> str:
        seed = "|".join(
            [
                str(sequence.get("entity_key", "")),
                self._serialize_timestamp(sequence.get("window_start")),
                self._serialize_timestamp(sequence.get("window_end")),
                ",".join(sorted(pattern["pattern_name"] for pattern in patterns)) or "sequence-only",
            ]
        )
        digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12].upper()
        return f"INC-{digest}"

    def _build_timeline(self, events: list[dict[str, Any]], max_events: int = 50) -> list[dict[str, Any]]:
        timeline = []
        for event in sorted(events, key=lambda row: (row.get("timestamp"), row.get("event_id"))):
            timeline.append(
                {
                    "timestamp": self._serialize_timestamp(event.get("timestamp")),
                    "event_id": str(event.get("event_id", "")),
                    "event_code": str(event.get("event_code", "unknown.event")),
                    "raw_event_type": str(event.get("raw_event_type", "unknown")),
                    "source_system": str(event.get("source_system", "unknown")),
                    "event_outcome": str(event.get("event_outcome", "unknown")),
                    "severity": str(event.get("severity", "unknown")),
                    "risk_flag": str(event.get("risk_flag", "unknown")),
                    "anomaly_score": float(event.get("anomaly_score", 0.0) or 0.0),
                }
            )
        return timeline[:max_events]

    def _build_story(
        self,
        sequence: dict[str, Any],
        patterns: list[dict[str, Any]],
        risk: dict[str, Any],
        combined_mitre: list[dict[str, Any]],
    ) -> str:
        pattern_names = ", ".join(sorted({pattern["pattern_name"] for pattern in patterns})) or "sequence correlation"
        tactics = sorted({tactic for item in combined_mitre for tactic in item.get("tactics", []) if tactic})
        tactic_story = f" MITRE tactics involved: {' -> '.join(tactics)}." if tactics else ""
        return (
            f"Entity {sequence.get('entity_key')} produced {sequence.get('event_count', 0)} correlated events "
            f"between {self._serialize_timestamp(sequence.get('window_start'))} and "
            f"{self._serialize_timestamp(sequence.get('window_end'))}. "
            f"Detected pattern set: {pattern_names}. "
            f"Final risk score is {risk['risk_score']} ({risk['risk_level']})."
            f"{tactic_story}"
        )

    def build_incident(
        self,
        sequence: dict[str, Any],
        path: dict[str, Any],
        patterns: list[dict[str, Any]],
        event_level_mitre: list[dict[str, Any]],
        pattern_level_mitre: list[dict[str, Any]],
        combined_mitre: list[dict[str, Any]],
        risk: dict[str, Any],
        max_timeline_events: int = 50,
    ) -> dict[str, Any]:
        """Build a single incident object from correlation outputs."""

        incident_id = self._generate_incident_id(sequence=sequence, patterns=patterns)
        now = datetime.now(timezone.utc).isoformat()
        events = sequence.get("events", [])

        return {
            "incident_id": incident_id,
            "generated_at": now,
            "entity": {
                "entity_key": sequence.get("entity_key"),
                "entity_type": sequence.get("entity_type"),
                "user_id": sequence.get("user_id"),
                "session_id": sequence.get("session_id"),
                "src_ip": sequence.get("src_ip"),
                "device_id": sequence.get("device_id"),
                "asset_id": sequence.get("asset_id"),
            },
            "correlation_window": {
                "start": self._serialize_timestamp(sequence.get("window_start")),
                "end": self._serialize_timestamp(sequence.get("window_end")),
                "event_count": int(sequence.get("event_count", len(events))),
                "duplicate_count": int(sequence.get("duplicate_count", 0)),
                "source_systems": sequence.get("source_systems", []),
            },
            "risk_assessment": risk,
            "attack_summary": {
                "patterns_detected": sorted({pattern["pattern_name"] for pattern in patterns}),
                "pattern_details": [
                    {
                        "pattern_name": pattern["pattern_name"],
                        "severity": pattern["severity"],
                        "description": pattern["description"],
                        "matched_event_codes": pattern["matched_event_codes"],
                        "matched_event_ids": pattern["matched_event_ids"],
                    }
                    for pattern in patterns
                ],
            },
            "mitre_attack": {
                "event_level_candidates": event_level_mitre,
                "pattern_level_confirmed": pattern_level_mitre,
                "techniques": combined_mitre,
                "tactics": sorted({tactic for item in combined_mitre for tactic in item.get("tactics", []) if tactic}),
            },
            "attack_graph": {
                "path_id": path.get("path_id"),
                "sequence_id": path.get("sequence_id"),
                "node_count": len(path.get("node_ids", [])),
                "path_length": int(path.get("length", 0)),
                "duration_seconds": float(path.get("duration_seconds", 0.0)),
                "source_systems": path.get("source_systems", []),
            },
            "ordered_timeline": self._build_timeline(events, max_events=max_timeline_events),
            "attack_story": self._build_story(sequence, patterns, risk, combined_mitre),
        }

    def save_incident(self, incident: dict[str, Any]) -> Path:
        """Persist a single incident JSON document."""

        self.by_incident_dir.mkdir(parents=True, exist_ok=True)
        file_path = self.by_incident_dir / f"{incident['incident_id']}.json"
        with open(file_path, "w", encoding="utf-8") as handle:
            json.dump(incident, handle, indent=2)
        return file_path

    def save_incidents(self, incidents: list[dict[str, Any]]) -> tuple[Path, list[Path]]:
        """Persist the incident index and all by-incident artifacts."""

        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        saved_paths = [self.save_incident(incident) for incident in incidents]
        with open(self.index_path, "w", encoding="utf-8") as handle:
            json.dump(incidents, handle, indent=2)
        return self.index_path, saved_paths
