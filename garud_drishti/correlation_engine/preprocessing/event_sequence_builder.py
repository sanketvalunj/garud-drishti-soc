<<<<<<< HEAD
"""
event_sequence_builder.py

Builds ordered event sequences for suspicious users.

This module prepares data for the attack graph stage.
Events are grouped by user and sorted by timestamp.

Output format:

{
"user_id": [
    {event1},
    {event2},
    {event3}
]
}
"""
=======
"""Build event-time sequences for offline correlation analysis."""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any
>>>>>>> 6bd384c36c960584426c4e6347a32d9f9c031e3e

import pandas as pd


class EventSequenceBuilder:
<<<<<<< HEAD

    def __init__(self, logs_df):
        """
        logs_df : pandas dataframe containing logs
        """

        self.logs_df = logs_df.copy()

        # ensure timestamp is datetime
        if "timestamp" in self.logs_df.columns:
            self.logs_df["timestamp"] = pd.to_datetime(
                self.logs_df["timestamp"]
            )

    def build_sequences(self):
        """
        Build ordered event sequences for each user.
        """

        sequences = {}

        # detect user column automatically
        if "user" in self.logs_df.columns:
            user_col = "user"
        elif "user_id" in self.logs_df.columns:
            user_col = "user_id"
        else:
            raise Exception("No user column found in logs")

        # group logs by user
        grouped = self.logs_df.groupby(user_col)

        for user, user_logs in grouped:

            # sort events by timestamp
            user_logs = user_logs.sort_values("timestamp")

            # convert rows to dictionary
            events = user_logs.to_dict("records")

            sequences[user] = events

        return sequences

    def print_sequences(self, sequences):
        """
        Debug helper to print event sequences.
        """

        for user, events in sequences.items():

            print("\nUser:", user)

            for event in events:

                print(
                    event["timestamp"],
                    "→",
                    event.get("action", "unknown")
                )
=======
    """Group canonical events into correlation sequences using event time."""

    def __init__(
        self,
        logs_df: pd.DataFrame,
        correlation_config_path: str | Path = r"garud_drishti\correlation_engine\config\correlation_config.json",
        entity_rules_path: str | Path = r"garud_drishti\correlation_engine\config\entity_linking_rules.json",
    ) -> None:
        self.logs_df = logs_df.copy()
        self.config = self._load_json(correlation_config_path)
        self.entity_rules = self._load_json(entity_rules_path)
        self.window = timedelta(minutes=int(self.config.get("sliding_window_minutes", 10)))
        self.sequence_gap = timedelta(minutes=int(self.config.get("sequence_gap_minutes", 5)))
        self.deduplicate = bool(self.config.get("deduplicate_before_correlation", True))

        if "timestamp" not in self.logs_df.columns:
            raise ValueError("Correlation logs must include a timestamp column.")

        self.logs_df["timestamp"] = pd.to_datetime(self.logs_df["timestamp"], errors="coerce")
        self.logs_df = self.logs_df.dropna(subset=["timestamp"]).copy()
        self.logs_df = self.logs_df.sort_values(["timestamp", "event_id"]).reset_index(drop=True)

    @staticmethod
    def _load_json(path_value: str | Path) -> dict[str, Any]:
        path = Path(path_value)
        if not path.exists():
            raise FileNotFoundError(f"Required configuration file not found: {path}")
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, dict):
            raise ValueError(f"Configuration file must contain a JSON object: {path}")
        return payload

    @staticmethod
    def _has_values(event: dict[str, Any], fields: list[str]) -> bool:
        return all(str(event.get(field, "")).strip() not in {"", "none", "null", "nan"} for field in fields)

    def _derive_entity(self, event: dict[str, Any]) -> tuple[str, str]:
        for rule in self.entity_rules.get("group_priority", []):
            fields = [str(field) for field in rule.get("fields", [])]
            required = [str(field) for field in rule.get("required_non_empty", fields)]
            if not fields or not self._has_values(event, required):
                continue

            entity_type = str(rule.get("entity_type", "entity")).strip().lower() or "entity"
            parts = [f"{field}={str(event.get(field, '')).strip()}" for field in fields]
            return entity_type, f"{entity_type}|" + "|".join(parts)

        fallback_user = str(event.get("user_id", "unknown_user")).strip() or "unknown_user"
        return "user", f"user|user_id={fallback_user}"

    def build_sequences(self) -> list[dict[str, Any]]:
        """Build windowed sequences for each correlation entity."""

        if self.logs_df.empty:
            return []

        frame = self.logs_df.copy()
        entity_data = frame.apply(
            lambda row: self._derive_entity(row.to_dict()),
            axis=1,
            result_type="expand",
        )
        entity_data.columns = ["entity_type", "entity_key"]
        frame[["entity_type", "entity_key"]] = entity_data
        frame = frame.sort_values(["entity_key", "timestamp", "event_id"]).reset_index(drop=True)

        sequences: list[dict[str, Any]] = []
        sequence_index = 0

        for (entity_type, entity_key), group in frame.groupby(["entity_type", "entity_key"], dropna=False, sort=False):
            current_events: list[dict[str, Any]] = []
            duplicate_count = 0
            current_start = None
            previous_time = None

            for event in group.to_dict("records"):
                timestamp = event["timestamp"]
                is_duplicate = bool(event.get("is_duplicate", False))
                if self.deduplicate and is_duplicate:
                    duplicate_count += 1
                    continue

                should_flush = False
                if current_events:
                    if previous_time is not None and timestamp - previous_time > self.sequence_gap:
                        should_flush = True
                    elif current_start is not None and timestamp - current_start > self.window:
                        should_flush = True

                if should_flush and current_events:
                    sequence_index += 1
                    sequences.append(
                        self._build_sequence_record(
                            sequence_index=sequence_index,
                            entity_type=str(entity_type),
                            entity_key=str(entity_key),
                            events=current_events,
                            duplicate_count=duplicate_count,
                        )
                    )
                    current_events = []
                    duplicate_count = 0

                current_events.append(event)
                current_start = current_events[0]["timestamp"]
                previous_time = timestamp

            if current_events:
                sequence_index += 1
                sequences.append(
                    self._build_sequence_record(
                        sequence_index=sequence_index,
                        entity_type=str(entity_type),
                        entity_key=str(entity_key),
                        events=current_events,
                        duplicate_count=duplicate_count,
                    )
                )

        return sequences

    @staticmethod
    def _build_sequence_record(
        sequence_index: int,
        entity_type: str,
        entity_key: str,
        events: list[dict[str, Any]],
        duplicate_count: int,
    ) -> dict[str, Any]:
        start_time = events[0]["timestamp"]
        end_time = events[-1]["timestamp"]
        return {
            "sequence_id": f"SEQ-{sequence_index:05d}",
            "entity_type": entity_type,
            "entity_key": entity_key,
            "user_id": str(events[0].get("user_id", "unknown_user")),
            "session_id": str(events[0].get("session_id", "no_session")),
            "src_ip": str(events[0].get("src_ip", "unknown_ip")),
            "device_id": str(events[0].get("device_id", "")),
            "asset_id": str(events[0].get("asset_id", "unknown_asset")),
            "window_start": start_time,
            "window_end": end_time,
            "event_count": len(events),
            "duplicate_count": duplicate_count,
            "source_systems": sorted({str(event.get("source_system", "unknown")) for event in events}),
            "events": events,
        }

    def print_sequences(self, sequences: list[dict[str, Any]]) -> None:
        """Print a concise sequence summary for debugging."""

        for sequence in sequences[:10]:
            print(
                f"{sequence['sequence_id']} | {sequence['entity_key']} | "
                f"{sequence['window_start']} -> {sequence['window_end']} | "
                f"events={sequence['event_count']}"
            )
>>>>>>> 6bd384c36c960584426c4e6347a32d9f9c031e3e
