from garud_drishti.correlation_engine.correlation_service import CorrelationService


class CorrelationAgent:
    """
    Builds incidents from normalized security events.
    """

    def __init__(self):
        self.engine = CorrelationService()

    def run(self, events: list):
        """
        Generate incidents from events.
        """
        incidents = self.engine.build_incidents(events)
        return incidents