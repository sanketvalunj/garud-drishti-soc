import pandas as pd
from tsfresh import extract_features
from tsfresh.utilities.dataframe_functions import impute


class TSFreshExtractor:
    """
    Extracts temporal behavioral features using tsfresh.
    Converts event sequences into statistical descriptors.
    """

    def transform(self, events: list) -> pd.DataFrame:
        """
        Convert events → tsfresh input format
        """

        rows = []

        for i, e in enumerate(events):
            ts = pd.to_datetime(e["timestamp"])

            rows.append({
                "id": 0,                     # single incident sequence
                "time": ts,
                "event_value": hash(e.get("event_type","")) % 1000,
                "asset_value": hash(e.get("asset","")) % 1000,
                "user_value": hash(e.get("user","")) % 1000,
            })

        df = pd.DataFrame(rows).sort_values("time")

        # tsfresh expects:
        # id column + time column + feature columns

        features = extract_features(
            df,
            column_id="id",
            column_sort="time",
            disable_progressbar=True
        )

        impute(features)

        return features.reset_index(drop=True)