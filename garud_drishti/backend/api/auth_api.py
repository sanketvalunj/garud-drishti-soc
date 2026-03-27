import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel

from garud_drishti.backend.utils.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str
    role: str


def _build_permissions(role: str) -> dict:
    base = {
        "canActivateResponse": role in {"tier2", "tier3", "manager"},
        "canIsolateUser": role in {"tier2", "tier3", "manager"},
        "canRunPipeline": role in {"tier3", "manager"},
        "canViewReasoning": role in {"tier2", "tier3", "manager"},
        "canViewPlaybooks": role in {"tier2", "tier3", "manager"},
        "canAccessAdmin": True,
        "canManageUsers": role == "manager",
        "canViewAuditTrail": role == "manager",
        "canRunPipelinePage": role in {"tier3", "manager"},
    }
    return base


def _build_nav_items(role: str) -> list[str]:
    nav = ["dashboard", "alerts", "incidents"]
    if role in {"tier2", "tier3", "manager"}:
        nav.extend(["playbooks", "llmreasoning"])
    if role in {"tier3", "manager"}:
        nav.append("pipeline")
    nav.append("activity")
    return nav


@router.post("/login")
def login(body: LoginBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, password_hash, display_name, avatar, role, department, is_active
                FROM users
                WHERE username = %s
                """,
                (body.username,),
            )
            user = cur.fetchone()

            if not user:
                raise HTTPException(status_code=401, detail="Invalid username or password")
            if not user["is_active"]:
                raise HTTPException(status_code=403, detail="User is inactive")
            if user["role"] != body.role:
                raise HTTPException(status_code=403, detail="Role mismatch")

            if not bcrypt.checkpw(body.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
                raise HTTPException(status_code=401, detail="Invalid username or password")

            expiry_hours = int(str(os.getenv("JWT_EXPIRY", "24h")).replace("h", ""))
            exp = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)
            payload = {
                "sub": str(user["id"]),
                "username": user["username"],
                "role": user["role"],
                "exp": exp,
            }
            token = jwt.encode(payload, os.getenv("JWT_SECRET", "your-secret-key"), algorithm="HS256")

            role_label_map = {
                "tier1": "Tier 1 Analyst",
                "tier2": "Incident Responder",
                "tier3": "Threat Hunter",
                "manager": "SOC Manager",
            }
            user_payload = {
                "id": str(user["id"]),
                "name": user["display_name"],
                "username": user["username"],
                "role": user["role"],
                "roleLabel": role_label_map.get(user["role"], user["role"]),
                "avatar": user["avatar"] or user["display_name"][:2].upper(),
                "department": user["department"],
                "permissions": _build_permissions(user["role"]),
                "navItems": _build_nav_items(user["role"]),
            }

            cur.execute(
                "UPDATE users SET last_login = NOW(), is_online = TRUE WHERE id = %s",
                (user["id"],),
            )
            conn.commit()

            return {"user": user_payload, "token": token}


@router.post("/logout")
def logout():
    return {"success": True}
