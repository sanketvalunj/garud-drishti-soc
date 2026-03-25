"""
Backend service layer for Garud-Drishti SOC.
Provides orchestration wrappers used by API endpoints.
"""

from .ingestion_service import run_ingestion
from .detection_service import run_detection
from .correlation_service import run_correlation
from .response_service import run_response

__all__ = [
    "run_ingestion",
    "run_detection",
    "run_correlation",
    "run_response",
]