"""
backend/core/config.py
======================
Centralised application configuration loaded from environment variables.
Uses python-dotenv so you can override any setting via a .env file at the
project root without touching source code.

Usage:
    from backend.core.config import settings
"""

import os
from dotenv import load_dotenv

# Load .env from the project root (if present)
load_dotenv()


class Settings:
    """
    Application-wide configuration.

    All security-sensitive defaults are intentionally weak/dev-only values.
    Override via environment variables or a .env file before deploying.
    """

    # ── JWT ──────────────────────────────────────────────────────────────────
    # Secret used to sign/verify JWT tokens.  MUST be changed in production.
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        "garud-drishti-super-secret-key-change-me-in-production",
    )
    # Algorithm for JWT signing (HS256 is HMAC-SHA256 — fast, symmetric)
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    # Token validity in minutes (default: 60 minutes)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )

    # ── Bcrypt ───────────────────────────────────────────────────────────────
    # Work factor for bcrypt hashing.  12 is a solid production baseline.
    BCRYPT_ROUNDS: int = int(os.getenv("BCRYPT_ROUNDS", "12"))

    # ── App meta ─────────────────────────────────────────────────────────────
    APP_NAME: str = "Garud-Drishti SOC Auth"
    APP_VERSION: str = "1.0.0"


# Module-level singleton — import this everywhere
settings = Settings()
