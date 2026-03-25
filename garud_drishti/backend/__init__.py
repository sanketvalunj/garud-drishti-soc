"""
Garud-Drishti Backend Package

This package contains:
- FastAPI application entrypoint
- API route modules
- backend service utilities

Importing this package should NOT start the server automatically.
It only exposes the app and service interfaces.
"""

# Expose FastAPI app
from .main import app

# Optional: expose API routers for modular mounting/testing
try:
    from .api import ingest_api, detection_api, incident_api, playbook_api
except Exception:
    # Safe import in case APIs are not fully wired yet
    ingest_api = None
    detection_api = None
    incident_api = None
    playbook_api = None


__all__ = [
    "app",
    "ingest_api",
    "detection_api",
    "incident_api",
    "playbook_api",
]