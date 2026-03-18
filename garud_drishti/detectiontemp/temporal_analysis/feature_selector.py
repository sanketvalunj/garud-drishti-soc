import pandas as pd
from sklearn.feature_selection import VarianceThreshold
from sklearn.preprocessing import StandardScaler


class FeatureSelector:
    """
    Reduces dimensionality of tsfresh features.

    Steps:
    1. Remove constant / near-constant features
    2. Remove highly correlated features
    3. Scale remaining features
    """

    def __init__(
        self,
        variance_threshold=0.01,
        correlation_threshold=0.95,
        scale=True
    ):
        self.variance_threshold = variance_threshold
        self.correlation_threshold = correlation_threshold
        self.scale = scale

        self.var_filter = VarianceThreshold(threshold=variance_threshold)
        self.scaler = StandardScaler()

    # -------------------------------
    # Remove constant features
    # -------------------------------
    def _remove_low_variance(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df

        filtered = self.var_filter.fit_transform(df)
        cols = df.columns[self.var_filter.get_support()]

        return pd.DataFrame(filtered, columns=cols)

    # -------------------------------
    # Remove highly correlated features
    # -------------------------------
    def _remove_correlated(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.shape[1] <= 1:
            return df

        corr = df.corr().abs()
        upper = corr.where(
            ~pd.np.tril(pd.np.ones(corr.shape)).astype(bool)
        )

        to_drop = [
            column for column in upper.columns
            if any(upper[column] > self.correlation_threshold)
        ]

        return df.drop(columns=to_drop)

    # -------------------------------
    # Scaling
    # -------------------------------
    def _scale(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.scale or df.empty:
            return df

        scaled = self.scaler.fit_transform(df)
        return pd.DataFrame(scaled, columns=df.columns)

    # -------------------------------
    # MAIN PIPELINE
    # -------------------------------
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        df = self._remove_low_variance(df)
        df = self._remove_correlated(df)
        df = self._scale(df)
        return df.fillna(0)