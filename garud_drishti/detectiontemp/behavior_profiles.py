import pandas as pd


class BehaviorProfiler:
    """
    Builds simple behavioral baselines.
    """

    def build(self, df: pd.DataFrame):
        profiles = {}

        for user, group in df.groupby("user"):
            profiles[user] = {
                "avg_hour": group["hour"].mean(),
                "event_count": len(group),
                "unique_assets": group["asset"].nunique()
            }

        return profiles