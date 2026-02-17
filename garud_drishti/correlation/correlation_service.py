from .timeline_generator import TimelineGenerator
from .graph_constructor import GraphConstructor
from .fidelity_scoring import FidelityScorer
from .incident_builder import IncidentBuilder


class CorrelationService:
    """
    Main correlation pipeline:
    events -> clusters -> graph -> score -> incidents
    """

    def __init__(self):
        self.timeline = TimelineGenerator()
        self.graph = GraphConstructor()
        self.scorer = FidelityScorer()
        self.builder = IncidentBuilder()

    def build_incidents(self, events: list):
        """
        Full correlation flow.
        """

        clusters = self.timeline.build(events)

        incidents = []

        for cluster in clusters:
            graph = self.graph.build(cluster)
            fidelity = self.scorer.score(cluster)
            incident = self.builder.build(cluster, graph, fidelity)
            incidents.append(incident)

        return incidents