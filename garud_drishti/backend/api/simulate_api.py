"""
Garud-Drishti — AI SOC Platform
Attack Simulation API

Endpoints:
  POST /simulate_attack          — trigger a named attack chain
  GET  /simulate_attack/types    — list available attack scenarios
  POST /simulate_attack/bulk     — trigger multiple simultaneous attacks
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

from simulator.attack_scenarios        import AttackScenarios
from backend.ingestion.normalize_logs  import normalise_batch
from backend.services.index_events     import bulk_index, ensure_index

logger = logging.getLogger(__name__)
router = APIRouter()

# Singleton scenarios instance
_scenarios = AttackScenarios()

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class SimulateAttackRequest(BaseModel):
    type: str = Field(
        ...,
        description="Attack scenario type",
        examples=["brute_force", "data_exfiltration", "insider_data_theft",
                  "suspicious_night_login", "malware_infection"],
    )
    target_user: Optional[str] = Field(
        None,
        description="Optional employee ID to target (e.g. emp_101). Random if omitted.",
    )
    async_index: bool = Field(
        True,
        description="Index events asynchronously (non-blocking). Default: True",
    )


class BulkSimulateRequest(BaseModel):
    attacks: List[SimulateAttackRequest] = Field(
        ...,
        description="List of attack scenarios to trigger simultaneously.",
        min_items=1,
        max_items=10,
    )


# ---------------------------------------------------------------------------
# Background indexing task
# ---------------------------------------------------------------------------

def _index_attack_events(events: List[Dict[str, Any]]):
    """Background task: normalise + index attack chain events."""
    ensure_index()
    normalised = normalise_batch(events)
    result     = bulk_index(normalised)
    logger.info(
        "Attack chain indexed: %d events (%d errors)",
        result["indexed"], result["errors"],
    )


# ---------------------------------------------------------------------------
# POST /simulate_attack
# ---------------------------------------------------------------------------

@router.post("/simulate_attack", summary="Trigger an attack simulation")
async def simulate_attack(
    request: SimulateAttackRequest,
    background_tasks: BackgroundTasks,
):
    available = list(AttackScenarios.SCENARIO_MAP.keys())

    if request.type not in available:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown attack type '{request.type}'. "
                f"Available: {available}"
            ),
        )

    # Generate raw attack chain logs
    try:
        raw_events = _scenarios.run(
            scenario_type=request.type,
            target_user=request.target_user,
        )
    except Exception as exc:
        logger.error("Attack simulation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation error: {exc}")

    # Normalise for immediate preview
    normalised = normalise_batch(raw_events)

    # Index (async by default)
    if request.async_index:
        background_tasks.add_task(_index_attack_events, raw_events)
        indexed_status = "indexing_in_background"
    else:
        ensure_index()
        result = bulk_index(normalised)
        indexed_status = f"indexed_{result['indexed']}_events"

    return {
        "status":        "attack_simulated",
        "attack_type":   request.type,
        "target_user":   normalised[0].get("user") if normalised else None,
        "events_count":  len(normalised),
        "index_status":  indexed_status,
        "events_preview": normalised[:3],   # first 3 events as preview
        "all_events":    normalised,
    }


# ---------------------------------------------------------------------------
# GET /simulate_attack/types
# ---------------------------------------------------------------------------

@router.get("/simulate_attack/types", summary="List available attack scenarios")
async def list_attack_types():
    descriptions = {
        "brute_force":            "Credential stuffing: multiple failed logins → account lock → successful breach",
        "insider_data_theft":     "Privileged insider: login → priv escalation → DB access → bulk export",
        "suspicious_night_login": "Off-hours access from new geo-location + lateral movement across assets",
        "data_exfiltration":      "File access → compression → port scan → external transfer to C2",
        "malware_infection":      "Phishing download → malware execution → C2 beacon → privilege escalation",
    }
    return {
        "available_attack_types": [
            {"type": k, "description": v}
            for k, v in descriptions.items()
        ]
    }


# ---------------------------------------------------------------------------
# POST /simulate_attack/bulk
# ---------------------------------------------------------------------------

@router.post("/simulate_attack/bulk", summary="Trigger multiple attacks simultaneously")
async def simulate_bulk(
    request: BulkSimulateRequest,
    background_tasks: BackgroundTasks,
):
    results = []
    for atk in request.attacks:
        available = list(AttackScenarios.SCENARIO_MAP.keys())
        if atk.type not in available:
            results.append({"type": atk.type, "status": "error", "detail": "unknown attack type"})
            continue

        raw_events = _scenarios.run(atk.type, target_user=atk.target_user)
        background_tasks.add_task(_index_attack_events, raw_events)
        results.append({
            "type":         atk.type,
            "target_user":  atk.target_user,
            "events_count": len(raw_events),
            "status":       "queued",
        })

    return {
        "status":  "bulk_simulation_triggered",
        "results": results,
    }