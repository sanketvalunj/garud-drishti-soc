import pandas as pd
from .temporal_analysis.tsfresh_features import TSFreshExtractor
from .temporal_analysis.feature_selector import FeatureSelector

class FeatureEngineer:

    def __init__(self):
        self.tsfresh = TSFreshExtractor()
        self.selector = FeatureSelector()

    def transform(self, events: list) -> pd.DataFrame:
        rows = []

        for e in events:
            ts = pd.to_datetime(e["timestamp"])
            rows.append({
                "hour": ts.hour,
                "day": ts.dayofweek,
                "asset_hash": hash(e.get("asset","")) % 1000,
                "event_hash": hash(e.get("event_type","")) % 1000,
                "user_hash": hash(e.get("user","")) % 1000
            })

        base_df = pd.DataFrame(rows)

        tsfresh_df = self.tsfresh.transform(events)

        full_df = pd.concat([base_df, tsfresh_df], axis=1).fillna(0)

        # 🔥 NEW STEP
        reduced_df = self.selector.transform(full_df)

        return reduced_df