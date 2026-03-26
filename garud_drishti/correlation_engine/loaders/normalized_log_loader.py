<<<<<<< HEAD
"""
normalized_log_loader.py

Loads normalized security logs produced by the ingestion layer (Avantika).

Input file:
data/raw_logs/normalized_logs.json

This module prepares logs for correlation and graph building.
"""

import json
import pandas as pd
from pathlib import Path


class NormalizedLogLoader:

    def __init__(self, file_path=r"D:\garud-drishti-soc\data\incident_records\demo_logs.json"):
        """
        Initialize loader and read normalized logs.
        """

        self.file_path = Path(file_path)

        if not self.file_path.exists():
            raise FileNotFoundError(
                f"Normalized logs file not found: {self.file_path}"
            )

        # Load JSON logs
        with open(self.file_path) as f:
            logs = json.load(f)

        # Convert logs into pandas dataframe
        self.df = pd.DataFrame(logs)

        # Convert timestamp to datetime if available
        if "timestamp" in self.df.columns:
            self.df["timestamp"] = pd.to_datetime(self.df["timestamp"])

    def get_all_logs(self):
        """
        Return entire normalized log dataset.
        """

        return self.df

    def get_logs_for_user(self, user_id):
        """
        Return logs belonging to a single user.
        """

        user_logs = self.df[self.df["user"] == user_id]

        return user_logs

    def get_logs_for_users(self, user_list):
        """
        Return logs for multiple users (usually anomalous users).
        """

        logs = self.df[self.df["user_id"].isin(user_list)]

        return logs

    def get_logs_sorted(self, logs_df):
        """
        Sort logs by timestamp to build event sequences.
        """

        if "timestamp" in logs_df.columns:
            return logs_df.sort_values("timestamp")

        return logs_df

    def get_logs_in_time_window(self, start_time, end_time):
        """
        Return logs within a specific time range.
        Useful for real-time monitoring.
        """

        logs = self.df[
            (self.df["timestamp"] >= start_time)
            & (self.df["timestamp"] <= end_time)
        ]

        return logs

    def summary(self):
        """
        Print dataset statistics for debugging.
        """

        total_logs = len(self.df)

        unique_users = self.df["user"].nunique()

        print("Total logs loaded:", total_logs)
        print("Unique users:", unique_users)

        return {
            "total_logs": total_logs,
            "unique_users": unique_users
        }
=======
"""Load canonical GARUD-DRISHTI events for downstream correlation stages."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd


class NormalizedLogLoader:
    """Read canonical normalized events and expose a stable dataframe schema."""

    REQUIRED_COLUMNS = [
        "event_id",
        "timestamp",
        "user_id",
        "entity_id",
        "src_ip",
        "device_id",
        "asset_id",
        "session_id",
        "source_system",
        "raw_event_type",
        "event_code",
        "event_category",
        "event_outcome",
        "severity",
        "severity_score",
        "risk_flag",
        "login_hour",
        "night_login",
        "event_hash",
    ]

    def __init__(
        self,
        file_path: str | Path = r"garud_drishti\data\normalized_events\vishvesh_normalized_events.json",
    ) -> None:
        requested = Path(file_path)
        fallback = Path(r"garud_drishti\data\normalized_events\normalized_events.json")
        self.file_path = requested if requested.exists() else fallback
        if not self.file_path.exists():
            raise FileNotFoundError(f"Normalized logs file not found: {requested} or fallback {fallback}")

        with open(self.file_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        if not isinstance(payload, list):
            raise ValueError("Normalized log file must contain a JSON array of events.")

        self.df = pd.DataFrame(payload)
        self._normalize_schema()

    @staticmethod
    def _clean_text(series: pd.Series, default: str = "") -> pd.Series:
        cleaned = series.fillna(default).astype(str).str.strip()
        return cleaned.replace({"nan": default, "None": default, "null": default})

    def _ensure_column(self, column: str, default: Any) -> None:
        if column not in self.df.columns:
            self.df[column] = default

    def _normalize_schema(self) -> None:
        if self.df.empty:
            self.df = pd.DataFrame(columns=self.REQUIRED_COLUMNS + ["is_duplicate", "raw_event"])
            return

        for column in self.REQUIRED_COLUMNS:
            self._ensure_column(column, "")

        self.df["timestamp"] = pd.to_datetime(self.df["timestamp"], errors="coerce")
        self.df = self.df.dropna(subset=["timestamp"]).copy()

        text_columns = [
            "event_id",
            "user_id",
            "entity_id",
            "src_ip",
            "device_id",
            "asset_id",
            "session_id",
            "source_system",
            "raw_event_type",
            "event_code",
            "event_category",
            "event_outcome",
            "severity",
            "risk_flag",
            "event_hash",
            "department",
            "role",
            "dest_ip",
            "resource",
            "file_path",
            "process_name",
        ]
        for column in text_columns:
            self._ensure_column(column, "")
            self.df[column] = self._clean_text(self.df[column], "")

        self.df["source_system"] = self.df["source_system"].str.lower().replace({"": "unknown"})
        self.df["raw_event_type"] = self.df["raw_event_type"].str.lower().replace({"": "unknown"})
        self.df["event_code"] = self.df["event_code"].str.lower().replace({"": "unknown.event"})
        self.df["event_category"] = self.df["event_category"].str.lower().replace({"": "unknown"})
        self.df["event_outcome"] = self.df["event_outcome"].str.lower().replace({"": "unknown"})
        self.df["severity"] = self.df["severity"].str.lower().replace({"": "unknown"})
        self.df["risk_flag"] = self.df["risk_flag"].str.lower().replace({"": "unknown"})
        self.df["user_id"] = self.df["user_id"].replace({"": "unknown_user"})
        self.df["src_ip"] = self.df["src_ip"].replace({"": "unknown_ip"})
        self.df["session_id"] = self.df["session_id"].replace({"": "no_session"})
        self.df["asset_id"] = self.df["asset_id"].replace({"": "unknown_asset"})

        self.df["severity_score"] = pd.to_numeric(self.df["severity_score"], errors="coerce").fillna(0.0)
        self.df["login_hour"] = pd.to_numeric(self.df["login_hour"], errors="coerce")
        self.df["night_login"] = self.df["night_login"].fillna(False).astype(bool)
        self.df["duplicate_detected"] = self.df.get("duplicate_detected", False).fillna(False).astype(bool)

        self._ensure_column("anomaly_score", 0.0)
        self._ensure_column("anomaly_risk_score", self.df.get("risk_score", 0.0))
        self._ensure_column("is_anomaly", 0)
        self._ensure_column("confidence", 0.0)
        self.df["anomaly_score"] = pd.to_numeric(self.df["anomaly_score"], errors="coerce").fillna(0.0)
        self.df["anomaly_risk_score"] = pd.to_numeric(self.df["anomaly_risk_score"], errors="coerce").fillna(0.0)
        self.df["is_anomaly"] = pd.to_numeric(self.df["is_anomaly"], errors="coerce").fillna(0).astype(int)
        self.df["confidence"] = pd.to_numeric(self.df["confidence"], errors="coerce").fillna(0.0)

        self.df["action"] = self.df["event_code"]
        self.df["normalized_event"] = self.df["event_code"]
        self.df["event_type"] = self.df["raw_event_type"]

        self.df["is_duplicate"] = self.df["duplicate_detected"] | self.df["event_hash"].duplicated(keep="first")
        self.df = self.df.sort_values(["timestamp", "event_id"]).reset_index(drop=True)

    def get_all_logs(self) -> pd.DataFrame:
        """Return the full normalized log dataframe."""

        return self.df.copy()

    def get_logs_sorted(self, logs_df: pd.DataFrame | None = None) -> pd.DataFrame:
        """Return a timestamp-sorted dataframe."""

        frame = self.df if logs_df is None else logs_df.copy()
        if "timestamp" not in frame.columns:
            return frame
        return frame.sort_values(["timestamp", "event_id"]).reset_index(drop=True)

    def get_logs_for_user(self, user_id: str) -> pd.DataFrame:
        """Return logs for a specific logical user."""

        return self.df[self.df["user_id"] == str(user_id)].copy()

    def get_logs_in_time_window(self, start_time: Any, end_time: Any) -> pd.DataFrame:
        """Return logs inside the provided event-time interval."""

        start = pd.to_datetime(start_time, errors="coerce")
        end = pd.to_datetime(end_time, errors="coerce")
        if pd.isna(start) or pd.isna(end):
            return self.df.iloc[0:0].copy()
        return self.df[(self.df["timestamp"] >= start) & (self.df["timestamp"] <= end)].copy()

    def summary(self) -> dict[str, int]:
        """Return a small summary of the loaded canonical event set."""

        total_logs = len(self.df)
        unique_users = int(self.df["user_id"].nunique()) if "user_id" in self.df.columns else 0
        duplicate_logs = int(self.df["is_duplicate"].sum()) if "is_duplicate" in self.df.columns else 0

        print(f"Total canonical logs loaded: {total_logs}")
        print(f"Unique users/entities      : {unique_users}")
        print(f"Duplicate records flagged  : {duplicate_logs}")

        return {
            "total_logs": total_logs,
            "unique_users": unique_users,
            "duplicate_logs": duplicate_logs,
        }
>>>>>>> 6bd384c36c960584426c4e6347a32d9f9c031e3e
