import pandas as pd
from pyod.models.iforest import IForest


class PyODModel:
    """
    Wrapper around PyOD IsolationForest.
    """

    def __init__(self, contamination=0.05):
        self.model = IForest(contamination=contamination)

    def fit(self, df: pd.DataFrame):
        self.model.fit(df)

    def predict(self, df: pd.DataFrame):
        labels = self.model.predict(df)  # 1 = anomaly
        scores = self.model.decision_function(df)

        return labels, scores