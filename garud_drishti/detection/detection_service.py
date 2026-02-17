from garud_drishti.detection.anomaly_models import ModelLoader
from .feature_engineering import FeatureEngineer
from .behavior_profiles import BehaviorProfiler


class DetectionService:
    """
    Full anomaly detection pipeline.
    """

    def __init__(self):
        self.engineer = FeatureEngineer()
        self.profiler = BehaviorProfiler()
        self.model = ModelLoader().load()

    def run(self, events: list):
        """
        events -> features -> anomaly detection -> enriched events
        """

        if not events:
            return []

        df = self.engineer.transform(events)

        # Build baseline profiles
        profiles = self.profiler.build(df.assign(
            user=[e.get("user","unknown") for e in events],
            asset=[e.get("asset","unknown") for e in events]
        ))

        # Fit + predict
        self.model.fit(df)
        labels, scores = self.model.predict(df)

        enriched = []

        for e, label, score in zip(events, labels, scores):
            new_e = dict(e)
            new_e["is_anomaly"] = bool(label)
            new_e["anomaly_score"] = float(score)
            enriched.append(new_e)

        return enriched