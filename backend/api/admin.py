"""
backend/api/admin.py
=====================
Admin-only routes — restricted to SOC_MANAGER role.

Routes:
  POST /admin/users — Create a new SOC analyst account.

The `require_roles` dependency at the router level means FastAPI will reject
any request that doesn't carry a valid SOC_MANAGER JWT before the handler
function body is even reached.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from backend.core.security import TokenData, require_roles
from backend.models.schemas import APIResponse, CreateUserRequest, SOCRole
from backend.services import auth_service

# ── Router setup ──────────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    # All routes under /admin require SOC_MANAGER role.
    # Applying the dependency at the router level is cleaner than repeating it
    # on every individual endpoint.
    dependencies=[Depends(require_roles([SOCRole.SOC_MANAGER]))],
)


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/users
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/users",
    response_model=APIResponse,
    summary="Create a new SOC user account (SOC_MANAGER only)",
    status_code=status.HTTP_201_CREATED,
)
def create_user(body: CreateUserRequest) -> APIResponse:
    """
    Create a new SOC analyst account.

    Only callable by authenticated users with the SOC_MANAGER role.
    The `dependencies` on the router enforce this before this function runs.

    Password is hashed server-side — plaintext is never stored or logged.

    Request body:
        username (str):  3-64 chars
        password (str):  8-128 chars — will be bcrypt-hashed
        role     (SOCRole): one of TIER1/2/3_ANALYST or SOC_MANAGER

    Returns:
        APIResponse with the new UserPublic as `data` (no password hash).
        HTTP 409 if the username is already taken.
    """
    success, message, user_public = auth_service.create_user(body)

    if not success:
        # Username already exists
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        )

    return APIResponse(
        success=True,
        data=user_public.model_dump(),
        message=message,
    )
