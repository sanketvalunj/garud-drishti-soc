"""
Garud-Drishti SOC — Attack Simulation API
===========================================
FastAPI router for triggering real-time attack simulations.

Endpoint:
  POST /simulate_attack  — Trigger an attack chain and inject events
  GET  /simulate_attack/types — List available attack types
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

router = APIRouter(tags=["Attack Simulation"])

# Global references — set by main.py
_attack_engine = None   # AttackScenarioGenerator
_indexer = None          # EventIndexer
_schema_mapper = None    # SchemaMapper (optional)
_enterprise = None       # EnterpriseEnvironment


def set_dependencies(attack_engine, indexer, schema_mapper):
    """Set shared dependencies."""
    global _attack_engine, _indexer, _schema_mapper, _enterprise
    _attack_engine = attack_engine
    _indexer = indexer
    _schema_mapper = schema_mapper

    # Get the enterprise singleton
    try:
        from simulator.enterprise_simulator import get_enterprise_env
        _enterprise = get_enterprise_env()
    except Exception:
        _enterprise = None


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────

class AttackRequest(BaseModel):
    type: str  # brute_force, insider_data_theft, data_exfiltration, etc.
    target_user: Optional[str] = None  # Optional target user (e.g., emp_101)


class AttackResponse(BaseModel):
    attack_type: str
    events_generated: int
    events_indexed: int
    chain: List[Dict[str, Any]]


# ─────────────────────────────────────────────
# POST /simulate_attack
# ─────────────────────────────────────────────

@router.post("/simulate_attack", response_model=AttackResponse)
def simulate_attack(request: AttackRequest):
    """
    Trigger an attack simulation.

    Supported attack types:
    - brute_force
    - privilege_escalation
    - insider_data_theft
    - data_exfiltration
    - lateral_movement
    - suspicious_night_login
    - malware_infection

    The attack chain events are generated, enriched with MITRE + context,
    and immediately indexed.
    """
    if _attack_engine is None or _indexer is None or _enterprise is None:
        raise HTTPException(
            status_code=503,
            detail="Attack simulation engine not initialized"
        )

    # Generate attack chain via the new AttackScenarioGenerator
    try:
        chain_events = _attack_engine.generate_attack(
            env=_enterprise,
            attack_type=request.type,
            target_user=request.target_user,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Index the events (already enriched by the attack generator)
    result = _indexer.index_events(chain_events)
    indexed_count = result.get("indexed", 0)

    return AttackResponse(
        attack_type=request.type,
        events_generated=len(chain_events),
        events_indexed=indexed_count,
        chain=chain_events,
    )


# ─────────────────────────────────────────────
# GET /simulate_attack/types — List available attacks
# ─────────────────────────────────────────────

@router.get("/simulate_attack/types")
def list_attack_types():
    """List all available attack simulation types."""
    if _attack_engine is None:
        raise HTTPException(
            status_code=503,
            detail="Attack simulation engine not initialized"
        )

    return {
        "available_attacks": _attack_engine.available_attack_types(),
        "description": {
            "brute_force": "Multiple failed logins followed by account lock and eventual success",
            "privilege_escalation": "Login → PowerShell script → token manipulation → SYSTEM",
            "insider_data_theft": "After-hours login → mass DB query → data export to USB",
            "data_exfiltration": "File access → 7z compression → port scan → HTTPS exfil",
            "lateral_movement": "External login → hop servers via SMB/RDP/WinRM → priv esc",
            "suspicious_night_login": "3am login from high-risk geo → multi-server access → file download",
            "malware_infection": "Malicious attachment → Emotet detection → C2 beacon → UAC bypass",
        }
    }
