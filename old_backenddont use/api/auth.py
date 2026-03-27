"""
backend/api/auth.py
===================
Authentication routes — public-facing endpoints.

Routes:
  POST /auth/login  — Exchange credentials for a JWT access token.
  GET  /auth/me     — Return the currently-authenticated user's profile.

Business logic lives in backend.services.auth_service, keeping routes thin.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from backend.core.security import get_current_user
from backend.models.schemas import APIResponse, LoginRequest, TokenData
from backend.services import auth_service

# ── Router setup ──────────────────────────────────────────────────────────────
# prefix="/auth" is applied in main.py when the router is included.
router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ─────────────────────────────────────────────────────────────────────────────
# POST /auth/login
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=APIResponse,
    summary="Obtain a JWT access token",
    status_code=status.HTTP_200_OK,
)
def login(body: LoginRequest) -> APIResponse:
    """
    Authenticate a SOC analyst with username + password.

    On success, returns a signed JWT that must be included in subsequent
    requests as:   Authorization: Bearer <token>

    The token embeds the user's role so every protected endpoint can perform
    role checks without an extra DB round-trip.

    Returns:
        APIResponse with TokenResponse as `data` on success.
        HTTP 401 if credentials are invalid or the account is inactive.
    """
    token_response = auth_service.authenticate_user(body.username, body.password)

    if token_response is None:
        # Do NOT reveal whether the username exists — generic message only
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return APIResponse(
        success=True,
        data=token_response.model_dump(),
        message="Login successful",
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /auth/me
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=APIResponse,
    summary="Get current user profile",
    status_code=status.HTTP_200_OK,
)
def me(current_user: TokenData = Depends(get_current_user)) -> APIResponse:
    """
    Return the profile of the analyst whose Bearer token is in the request.

    The `get_current_user` dependency decodes and validates the JWT; if the
    token is missing, expired, or tampered with, FastAPI returns 401 before
    this function is ever called.

    Returns:
        APIResponse with UserPublic as `data`.
        HTTP 404 if the account was deleted after the token was issued.
    """
    profile = auth_service.get_user_profile(current_user.sub)

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found — it may have been removed",
        )

    return APIResponse(
        success=True,
        data=profile.model_dump(),
        message="Profile retrieved successfully",
    )
