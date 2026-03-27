"""
backend/api/incidents_api.py
==============================
Incident management routes for the SOC platform.

Routes:
  GET   /incidents              — List incidents (paginated + filtered)
  GET   /incidents/{id}         — Get a single incident by ID
  PATCH /incidents/{id}/status  — Update incident status (TIER2+ only)

Role access:
  GET   → all authenticated roles
  PATCH → TIER2_ANALYST, TIER3_ANALYST, SOC_MANAGER

Business logic lives entirely in backend.services.incident_service.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional

from backend.core.security import get_current_user, require_roles
from backend.models.schemas import (
    APIResponse,
    Incident,
    IncidentStatus,
    SOCRole,
    TokenData,
    UpdateIncidentStatusRequest,
)
from backend.services import incident_service

router = APIRouter(prefix="/incidents", tags=["Incidents"])

# Roles permitted to mutate incident status
_PATCH_ROLES = [SOCRole.TIER2_ANALYST, SOCRole.TIER3_ANALYST, SOCRole.SOC_MANAGER]


# ─────────────────────────────────────────────────────────────────────────────
# GET /incidents
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=APIResponse,
    summary="List incidents with pagination and optional filters",
)
def list_incidents(
    limit: int = Query(default=20, ge=1, le=100, description="Page size"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    severity: Optional[str] = Query(default=None, description="Filter by severity: HIGH, MEDIUM, LOW"),
    status: Optional[str] = Query(default=None, description="Filter by status: Investigating, Resolved, Escalated, Closed"),
    _: TokenData = Depends(get_current_user),  # all authenticated roles
) -> APIResponse:
    """
    Return a paginated list of incidents.

    Supports optional filtering by `severity` and `status`.
    All authenticated SOC roles may access this endpoint.
    """
    try:
        result = incident_service.list_incidents(
            limit=limit,
            offset=offset,
            severity=severity,
            status=status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return APIResponse(
        success=True,
        data=result.model_dump(),
        message=f"Retrieved {len(result.incidents)} of {result.total} incidents",
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /incidents/{incident_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{incident_id}",
    response_model=APIResponse,
    summary="Get a single incident by ID",
)
def get_incident(
    incident_id: str,
    _: TokenData = Depends(get_current_user),  # all authenticated roles
) -> APIResponse:
    """
    Fetch a single incident by its ID (e.g. INC-0001).

    Returns HTTP 404 if the incident does not exist.
    """
    incident = incident_service.get_incident(incident_id)

    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )

    return APIResponse(
        success=True,
        data=incident.model_dump(),
        message="Incident retrieved successfully",
    )


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /incidents/{incident_id}/status
# ─────────────────────────────────────────────────────────────────────────────

@router.patch(
    "/{incident_id}/status",
    response_model=APIResponse,
    summary="Update incident status (TIER2, TIER3, SOC_MANAGER only)",
)
def update_incident_status(
    incident_id: str,
    body: UpdateIncidentStatusRequest,
    _: TokenData = Depends(require_roles(_PATCH_ROLES)),
) -> APIResponse:
    """
    Update the status of an incident.

    Allowed statuses: Investigating, Resolved, Escalated, Closed.
    Restricted to TIER2_ANALYST, TIER3_ANALYST, and SOC_MANAGER roles.

    Returns HTTP 404 if the incident does not exist.
    """
    updated = incident_service.update_incident_status(incident_id, body.status)

    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )

    return APIResponse(
        success=True,
        data=updated.model_dump(),
        message=f"Incident '{incident_id}' status updated to '{body.status.value}'",
    )
