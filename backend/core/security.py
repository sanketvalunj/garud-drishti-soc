"""
backend/core/security.py
========================
Low-level cryptographic helpers used by the auth service layer.

Responsibilities:
  • Bcrypt password hashing / verification
  • JWT creation and verification
  • FastAPI dependency that decodes the Bearer token from any request
  • Role-gating dependency factory (require_roles)

Nothing in this file should know about HTTP routes or database models —
it only deals with cryptographic primitives and FastAPI dependency injection.
"""

from datetime import datetime, timedelta, timezone
from typing import List

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt

from backend.core.config import settings
from backend.models.schemas import SOCRole, TokenData

# ── Bearer token extractor ────────────────────────────────────────────────────
# HTTPBearer reads the "Authorization: Bearer <token>" header automatically.
# auto_error=True means FastAPI returns 403 when the header is absent.
_bearer_scheme = HTTPBearer(auto_error=True)


# ─────────────────────────────────────────────────────────────────────────────
# PASSWORD UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(plaintext: str) -> str:
    """
    Hash a plaintext password with bcrypt.

    bcrypt internally generates a cryptographically random salt and embeds it
    in the resulting hash string, so no salt management is needed here.

    Args:
        plaintext: The raw password string.

    Returns:
        A bcrypt hash string (60 chars) safe to store in the DB.
    """
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    return bcrypt.hashpw(plaintext.encode("utf-8"), salt).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    """
    Constant-time comparison of plaintext against the stored bcrypt hash.

    bcrypt.checkpw is inherently constant-time via the underlying C extension,
    which prevents timing-based side-channel attacks.

    Args:
        plaintext: Password provided by the user at login.
        hashed:    The stored bcrypt hash from the user record.

    Returns:
        True if the password matches; False otherwise.
    """
    try:
        return bcrypt.checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        # Any exception (e.g. malformed hash) is treated as a mismatch —
        # never leak cryptographic implementation details to callers.
        return False


# ─────────────────────────────────────────────────────────────────────────────
# JWT UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(username: str, role: SOCRole) -> tuple[str, int]:
    """
    Mint a signed JWT access token for the given user.

    Claims embedded in the token:
      • sub  — username (RFC 7519 Subject claim)
      • role — SOC tier (custom claim)
      • iat  — issued-at timestamp
      • exp  — expiry timestamp

    Args:
        username: Authenticated user's username.
        role:     SOCRole assigned to the user.

    Returns:
        A tuple of (encoded_jwt_string, expires_in_seconds).
    """
    expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expire_minutes)

    payload = {
        "sub": username,
        "role": role.value,         # Stored as plain string in the JWT
        "iat": now,
        "exp": expire,
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expire_minutes * 60   # Return expiry in seconds


def decode_access_token(token: str) -> TokenData:
    """
    Decode and validate a JWT, returning the embedded TokenData.

    Raises:
        HTTPException 401 — if the token is expired, malformed, or has
                            unexpected claims (e.g. unknown role).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except ExpiredSignatureError:
        # Surface a more helpful message for expired tokens
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired — please log in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise credentials_exception

    # Extract and validate required claims
    username: str = payload.get("sub")
    role_str: str = payload.get("role")

    if not username or not role_str:
        raise credentials_exception

    try:
        role = SOCRole(role_str)
    except ValueError:
        # Role in token doesn't match any known SOCRole
        raise credentials_exception

    return TokenData(sub=username, role=role, exp=payload.get("exp"))


# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> TokenData:
    """
    FastAPI dependency: reads the Bearer token from the Authorization header,
    decodes it, and returns the embedded TokenData.

    Inject this into any route that requires authentication:

        @router.get("/protected")
        def protected(user: TokenData = Depends(get_current_user)):
            ...
    """
    return decode_access_token(credentials.credentials)


def require_roles(allowed_roles: List[SOCRole]):
    """
    Dependency factory: returns a FastAPI dependency that enforces role-based
    access control.  Only users whose role is in `allowed_roles` are admitted.

    Usage:
        @router.post(
            "/admin/users",
            dependencies=[Depends(require_roles([SOCRole.SOC_MANAGER]))]
        )

    Args:
        allowed_roles: List of SOCRole values that may access the endpoint.

    Returns:
        A FastAPI-compatible dependency callable.
    """
    def _check(token_data: TokenData = Depends(get_current_user)) -> TokenData:
        if token_data.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): "
                    f"{[r.value for r in allowed_roles]}. "
                    f"Your role: {token_data.role.value}"
                ),
            )
        return token_data

    return _check
