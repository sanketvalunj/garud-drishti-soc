"""
Garud-Drishti Detection Engine

This package handles:
- Feature engineering (static + tsfresh)
- Behavioral profiling (UEBA-style signals)
- Anomaly detection using PyOD models

The DetectionService is the main entry point.
"""

# Main detection pipeline
from .detection_service import DetectionService
from .behavior_profiles import BehaviorProfiler
from .feature_engineering import FeatureEngineer

# Anomaly model interface
from .anomaly_models import ModelLoader, PyODModel

__all__ = [
    # main service
    "DetectionService",

    # feature + behavior utilities
    "FeatureEngineer",
    "BehaviorProfiler",

    # model layer
    "ModelLoader",
    "PyODModel",
]

