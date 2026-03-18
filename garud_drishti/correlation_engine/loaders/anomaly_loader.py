"""
anomaly_loader.py

Loads anomaly results produced by the UEBA engine (Shreya).
This module helps the correlation engine identify suspicious users.

Input file:
data/incident_records/anomaly_results.csv
"""

import pandas as pd
from pathlib import Path


class AnomalyLoader:

    def __init__(self, file_path=r"D:\garud-drishti-soc\data\incident_records\anomaly_results.csv"):
        """
        Initialize loader and read anomaly CSV file.
        """

        self.file_path = Path(file_path)

        if not self.file_path.exists():
            raise FileNotFoundError(
                f"Anomaly results file not found: {self.file_path}"
            )

        # Load CSV into pandas dataframe
        self.df = pd.read_csv(self.file_path)

        # Basic validation
        required_columns = {"user_id", "anomaly_score", "is_anomaly"}

        if not required_columns.issubset(self.df.columns):
            raise ValueError(
                f"Missing required columns in anomaly file: {required_columns}"
            )

    def get_all_records(self):
        """
        Return full anomaly dataset.
        Useful for debugging or analysis.
        """

        return self.df

    def get_anomalous_users(self):
        """
        Return list of users flagged as anomalies by ML model.
        """

        anomalies = self.df[self.df["is_anomaly"] == 1]

        return anomalies["user_id"].tolist()

    def get_anomaly_score(self, user_id):
        """
        Get anomaly score for a specific user.
        Used later in risk scoring.
        """

        user_row = self.df[self.df["user_id"] == user_id]

        if user_row.empty:
            return None

        return float(user_row["anomaly_score"].values[0])

    def get_anomaly_records(self):
        """
        Return dataframe containing only anomalous users.
        """

        return self.df[self.df["is_anomaly"] == 1]

    def summary(self):
        """
        Print summary statistics for debugging.
        """

        total_users = len(self.df)
        anomaly_users = len(self.df[self.df["is_anomaly"] == 1])

        print("Total users analyzed:", total_users)
        print("Anomalous users detected:", anomaly_users)

        return {
            "total_users": total_users,
            "anomalous_users": anomaly_users
        }