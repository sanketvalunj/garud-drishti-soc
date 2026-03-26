"""
backend/services/auth_service.py
=================================
Business logic layer for authentication operations.

Routes call these functions — there is NO FastAPI / HTTP code here.
This separation makes the service independently unit-testable.

In-memory user store:
  A plain Python dict keyed by lowercase username.  Swap this for a real
  database (SQLAlchemy, Motor, etc.) by replacing the CRUD helpers below
  without touching any route code.
"""

from datetime import datetime, timezone
from typing import Optional

from backend.core.security import create_access_token, hash_password, verify_password
from backend.models.schemas import (
    CreateUserRequest,
    SOCRole,
    TokenResponse,
    UserInDB,
    UserPublic,
)

# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY USER STORE
# ─────────────────────────────────────────────────────────────────────────────

# Dict[str, UserInDB] — keys are lowercase usernames for case-insensitive lookup.
# Pre-seeded with one SOC_MANAGER so there is always an admin to bootstrap the
# system without requiring a separate DB migration or seed script.
_USER_STORE: dict[str, UserInDB] = {
    "admin": UserInDB(
        username="admin",
        # bcrypt hash of "Admin@1234" — change this before deploying!
        hashed_password=hash_password("Admin@1234"),
        role=SOCRole.SOC_MANAGER,
        created_at=datetime.now(timezone.utc),
        is_active=True,
    ),
}


# ─────────────────────────────────────────────────────────────────────────────
# INTERNAL CRUD HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_user(username: str) -> Optional[UserInDB]:
    """
    Look up a user by username (case-insensitive).

    Returns None if the user does not exist — callers are responsible for
    raising the appropriate HTTP error.
    """
    return _USER_STORE.get(username.lower())


def _user_exists(username: str) -> bool:
    """Return True if a user with the given username already exists."""
    return username.lower() in _USER_STORE


def _save_user(user: UserInDB) -> None:
    """Persist a UserInDB record into the in-memory store."""
    _USER_STORE[user.username.lower()] = user


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE — PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def authenticate_user(username: str, password: str) -> Optional[TokenResponse]:
    """
    Authenticate a user with username + password.

    Steps:
      1. Look up the user record by username.
      2. Verify the provided password against the stored bcrypt hash.
      3. If valid, mint a JWT and return a TokenResponse.
      4. Return None on any credential failure (caller surfaces 401).

    Returning None instead of raising keeps the service layer HTTP-agnostic.

    Args:
        username: Login username.
        password: Plaintext password from the login form.

    Returns:
        A TokenResponse on success, or None on failure.
    """
    user = _get_user(username)

    # Use a constant-time compare even when the user doesn't exist to avoid
    # username-enumeration via timing differences.
    dummy_hash = "$2b$12$invalidhashtopreventtimingattack000000000000000000000000."
    stored_hash = user.hashed_password if user else dummy_hash

    password_ok = verify_password(password, stored_hash)

    # Reject if user not found, inactive, or wrong password
    if not user or not user.is_active or not password_ok:
        return None

    token, expires_in = create_access_token(user.username, user.role)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        role=user.role,
    )


def get_user_profile(username: str) -> Optional[UserPublic]:
    """
    Fetch the public profile of a user by their username.

    Args:
        username: Username decoded from the JWT Subject claim.

    Returns:
        UserPublic (no hashed_password) or None if the user no longer exists.
    """
    user = _get_user(username)
    if not user:
        return None

    return UserPublic(
        username=user.username,
        role=user.role,
        created_at=user.created_at,
        is_active=user.is_active,
    )


def create_user(request: CreateUserRequest) -> tuple[bool, str, Optional[UserPublic]]:
    """
    Create a new SOC user account.

    Called exclusively from the admin route — the route layer is responsible
    for enforcing that only SOC_MANAGERs can reach this function.

    Args:
        request: Validated CreateUserRequest payload.

    Returns:
        A 3-tuple: (success: bool, message: str, user_public: Optional[UserPublic])
          • success=False and a descriptive message if the username is taken.
          • success=True and the new UserPublic on creation.
    """
    if _user_exists(request.username):
        return False, f"Username '{request.username}' is already taken.", None

    new_user = UserInDB(
        username=request.username.lower(),
        hashed_password=hash_password(request.password),
        role=request.role,
        created_at=datetime.now(timezone.utc),
        is_active=True,
    )
    _save_user(new_user)

    public = UserPublic(
        username=new_user.username,
        role=new_user.role,
        created_at=new_user.created_at,
        is_active=new_user.is_active,
    )
    return True, f"User '{new_user.username}' created successfully.", public
