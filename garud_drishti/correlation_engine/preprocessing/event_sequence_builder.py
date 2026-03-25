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

import pandas as pd


class EventSequenceBuilder:

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