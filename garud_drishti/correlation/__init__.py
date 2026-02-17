"""
Correlation Engine Package

Responsible for:
- Building event timelines
- Constructing attack graphs
- Scoring fidelity of incidents
- Building incident records
"""

from .correlation_service import CorrelationService
from .timeline_generator import TimelineGenerator
from .graph_constructor import GraphConstructor
from .fidelity_scoring import FidelityScorer
from .incident_builder import IncidentBuilder

__all__ = [
    "CorrelationService",
    "TimelineGenerator",
    "GraphConstructor",
    "FidelityScorer",
    "IncidentBuilder",
]