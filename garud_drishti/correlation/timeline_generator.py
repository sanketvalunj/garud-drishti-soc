from datetime import datetime, timedelta


class TimelineGenerator:
    """
    Groups normalized events into time windows.
    """

    def __init__(self, gap_minutes=30):
        self.gap = timedelta(minutes=gap_minutes)

    def build(self, events: list):
        """
        Returns list of event clusters.
        """

        if not events:
            return []

        # sort by timestamp
        events = sorted(events, key=lambda x: x["timestamp"])

        clusters = []
        current_cluster = [events[0]]

        for prev, curr in zip(events, events[1:]):
            t1 = datetime.fromisoformat(prev["timestamp"])
            t2 = datetime.fromisoformat(curr["timestamp"])

            if t2 - t1 <= self.gap:
                current_cluster.append(curr)
            else:
                clusters.append(current_cluster)
                current_cluster = [curr]

        clusters.append(current_cluster)
        return clusters