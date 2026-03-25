"""
Storage layer for Garud-Drishti SOC.
Provides JSON + optional Elasticsearch persistence.
"""

from .log_repository import LogRepository
from .incident_repository import IncidentRepository

__all__ = [
    "LogRepository",
    "IncidentRepository",
]