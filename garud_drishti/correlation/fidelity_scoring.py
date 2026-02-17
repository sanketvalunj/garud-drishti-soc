class FidelityScorer:
    """
    Assigns fidelity score to incident cluster.
    """

    def score(self, events: list):
        anomaly = sum(e.get("anomaly_score", 0) for e in events) / max(len(events),1)
        asset_spread = len(set(e.get("asset") for e in events))

        # simple scoring logic (can be improved later)
        score = (
            anomaly * 60 +
            min(asset_spread * 10, 40)
        )

        return round(score, 2)