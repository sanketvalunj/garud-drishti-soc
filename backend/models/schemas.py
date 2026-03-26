"""
backend/models/schemas.py
=========================
Pydantic v2 request/response schemas used across the auth & admin APIs.

Keeping all contracts in one file makes it easy to audit the public surface
area and prevents circular imports.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ─────────────────────────────────────────────────────────────────────────────
# ROLE ENUM
# ─────────────────────────────────────────────────────────────────────────────

class SOCRole(str, Enum):
    """
    Allowed SOC analyst tiers.  Stored verbatim in the JWT 'role' claim.
    Using str-Enum means the value is already a plain string — no extra
    serialisation step needed.
    """
    TIER1_ANALYST = "TIER1_ANALYST"
    TIER2_ANALYST = "TIER2_ANALYST"
    TIER3_ANALYST = "TIER3_ANALYST"
    SOC_MANAGER   = "SOC_MANAGER"


# ─────────────────────────────────────────────────────────────────────────────
# GENERIC API ENVELOPE
# ─────────────────────────────────────────────────────────────────────────────

class APIResponse(BaseModel):
    """
    Standard JSON envelope returned by every endpoint.

        {
          "success": true,
          "data": <payload>,
          "message": "Human-readable status"
        }
    """
    success: bool
    data: Optional[Any] = None
    message: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# AUTH — request / response bodies
# ─────────────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Body for POST /auth/login."""
    username: str = Field(..., min_length=3, max_length=64,
                          description="SOC analyst username")
    password: str = Field(..., min_length=8, max_length=128,
                          description="Plaintext password (sent over TLS)")


class TokenData(BaseModel):
    """
    Payload embedded inside the JWT.
    Decoded and validated by the security dependency on every protected route.
    """
    sub: str            # subject — username
    role: SOCRole       # SOC role embedded in the token
    exp: Optional[int] = None   # UNIX epoch expiry (set by jwt library)


class TokenResponse(BaseModel):
    """Successful login response data."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int         # seconds until expiry
    role: SOCRole


# ─────────────────────────────────────────────────────────────────────────────
# USER — internal representation & public view
# ─────────────────────────────────────────────────────────────────────────────

class UserInDB(BaseModel):
    """
    Full user record as stored in the in-memory store.
    The 'hashed_password' field is NEVER returned to clients.
    """
    username: str
    hashed_password: str
    role: SOCRole
    created_at: datetime
    is_active: bool = True


class UserPublic(BaseModel):
    """Safe projection of UserInDB — no password hash exposed."""
    username: str
    role: SOCRole
    created_at: datetime
    is_active: bool


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — user creation
# ─────────────────────────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    """Body for POST /admin/users (SOC_MANAGER only)."""
    username: str = Field(..., min_length=3, max_length=64,
                          description="New analyst's username")
    password: str = Field(..., min_length=8, max_length=128,
                          description="Initial password — analyst should rotate on first login")
    role: SOCRole = Field(..., description="SOC tier assigned to the new user")


# ─────────────────────────────────────────────────────────────────────────────
# INCIDENT — enums, models, request bodies
# ─────────────────────────────────────────────────────────────────────────────

class IncidentSeverity(str, Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"


class IncidentStatus(str, Enum):
    INVESTIGATING = "Investigating"
    RESOLVED      = "Resolved"
    ESCALATED     = "Escalated"
    CLOSED        = "Closed"


class Incident(BaseModel):
    """Full incident record returned to SOC analysts."""
    incident_id:     str
    entity_id:       str
    event_type:      str
    attack_type:     str
    severity:        IncidentSeverity
    risk_score:      float
    fidelity_score:  float
    status:          IncidentStatus = IncidentStatus.INVESTIGATING
    timestamp:       str


class UpdateIncidentStatusRequest(BaseModel):
    """Body for PATCH /incidents/{id}/status."""
    status: IncidentStatus = Field(..., description="New status for the incident")


class PaginatedIncidentsResponse(BaseModel):
    """Paginated list of incidents."""
    total:     int
    limit:     int
    offset:    int
    incidents: list[Incident]
