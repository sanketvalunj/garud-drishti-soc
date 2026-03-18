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