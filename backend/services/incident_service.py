"""
backend/services/incident_service.py
======================================
Business logic for the Incident Service.

Responsibilities:
  - Load anomaly events from the processed data file on first access (lazy load)
  - Transform raw anomaly events into structured Incident objects
  - Auto-generate sequential incident IDs (INC-0001, INC-0002, ...)
  - Derive severity from risk_score
  - Support pagination and filtering by severity / status
  - Support status updates (PATCH)

No FastAPI / HTTP code lives here — this layer is HTTP-agnostic and
independently testable.
"""

import logging
from typing import Optional

from backend.models.schemas import (
    Incident,
    IncidentSeverity,
    IncidentStatus,
    PaginatedIncidentsResponse,
)
from backend.utils.file_loader import load_json_file

logger = logging.getLogger("garud_drishti.incident_service")

# Path to the anomaly events file, relative to the project root
_ANOMALY_EVENTS_PATH = "garud_drishti/data/ai_engine/anomaly_events.json"

# In-memory store: incident_id → Incident
# Populated once on first request (lazy initialisation).
_incidents: dict[str, Incident] = {}
_loaded = False


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _derive_severity(risk_score: float) -> IncidentSeverity:
    """Map a numeric risk_score to a severity tier."""
    if risk_score >= 0.8:
        return IncidentSeverity.HIGH
    if risk_score >= 0.5:
        return IncidentSeverity.MEDIUM
    return IncidentSeverity.LOW


def _build_incident(index: int, raw: dict) -> Incident:
    """
    Transform a single raw anomaly event dict into an Incident.

    Args:
        index: 1-based position used to generate the incident ID.
        raw:   Raw anomaly event dict from the JSON file.

    Returns:
        A fully populated Incident with default status "Investigating".
    """
    analysis = raw.get("analysis", {})
    risk_score = float(analysis.get("risk_score", 0.0))

    return Incident(
        incident_id=f"INC-{index:04d}",
        entity_id=raw.get("entity_id", "UNKNOWN"),
        event_type=raw.get("event_type", "unknown"),
        attack_type=analysis.get("attack_type", "Unknown"),
        severity=_derive_severity(risk_score),
        risk_score=risk_score,
        fidelity_score=float(analysis.get("fidelity_score", risk_score)),
        status=IncidentStatus.INVESTIGATING,
        timestamp=raw.get("timestamp", ""),
    )


def _ensure_loaded() -> None:
    """
    Lazy-load and transform anomaly events into the in-memory incident store.
    Idempotent — subsequent calls are no-ops once loaded.
    """
    global _loaded, _incidents

    if _loaded:
        return

    raw_events: list = load_json_file(_ANOMALY_EVENTS_PATH)
    _incidents = {
        f"INC-{i:04d}": _build_incident(i, event)
        for i, event in enumerate(raw_events, start=1)
    }
    _loaded = True
    logger.info(f"Loaded {len(_incidents)} incidents from anomaly events.")


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC SERVICE API
# ─────────────────────────────────────────────────────────────────────────────

def list_incidents(
    limit: int = 20,
    offset: int = 0,
    severity: Optional[str] = None,
    status: Optional[str] = None,
) -> PaginatedIncidentsResponse:
    """
    Return a paginated, optionally filtered list of incidents.

    Args:
        limit:    Max number of incidents to return (page size).
        offset:   Number of incidents to skip (for pagination).
        severity: Optional filter — "HIGH", "MEDIUM", or "LOW".
        status:   Optional filter — e.g. "Investigating", "Resolved".

    Returns:
        PaginatedIncidentsResponse with total count and the requested slice.

    Raises:
        ValueError: If severity or status filter values are invalid.
    """
    _ensure_loaded()

    # Validate filter values early so the route can surface a clean 400
    severity_filter: Optional[IncidentSeverity] = None
    if severity:
        try:
            severity_filter = IncidentSeverity(severity.upper())
        except ValueError:
            valid = [s.value for s in IncidentSeverity]
            raise ValueError(f"Invalid severity '{severity}'. Valid values: {valid}")

    status_filter: Optional[IncidentStatus] = None
    if status:
        try:
            status_filter = IncidentStatus(status)
        except ValueError:
            valid = [s.value for s in IncidentStatus]
            raise ValueError(f"Invalid status '{status}'. Valid values: {valid}")

    all_incidents = list(_incidents.values())

    # Apply filters
    if severity_filter:
        all_incidents = [i for i in all_incidents if i.severity == severity_filter]
    if status_filter:
        all_incidents = [i for i in all_incidents if i.status == status_filter]

    total = len(all_incidents)
    page = all_incidents[offset: offset + limit]

    return PaginatedIncidentsResponse(
        total=total,
        limit=limit,
        offset=offset,
        incidents=page,
    )


def get_incident(incident_id: str) -> Optional[Incident]:
    """
    Fetch a single incident by its ID.

    Args:
        incident_id: e.g. "INC-0001"

    Returns:
        The Incident if found, None otherwise.
    """
    _ensure_loaded()
    return _incidents.get(incident_id.upper())


def update_incident_status(incident_id: str, new_status: IncidentStatus) -> Optional[Incident]:
    """
    Update the status of an existing incident.

    Args:
        incident_id: e.g. "INC-0001"
        new_status:  One of the IncidentStatus enum values.

    Returns:
        The updated Incident if found, None if the incident does not exist.
    """
    _ensure_loaded()

    incident = _incidents.get(incident_id.upper())
    if incident is None:
        return None

    # Pydantic v2: model_copy(update=...) returns a new instance with patched fields
    updated = incident.model_copy(update={"status": new_status})
    _incidents[incident_id.upper()] = updated
    logger.info(f"Incident {incident_id} status updated to '{new_status.value}'")
    return updated
