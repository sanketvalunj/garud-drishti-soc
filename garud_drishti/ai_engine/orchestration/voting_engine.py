from __future__ import annotations

from typing import Any

# Institutional weights: technical risk slightly dominant in banking SOC triage.
_AGENT_WEIGHTS = {"risk": 0.4, "compliance": 0.3, "impact": 0.3}

# Governance thresholds on 0–1 final_confidence_score (after fidelity modulation).
_THRESHOLD_ASSISTED = 0.45
_THRESHOLD_AUTONOMOUS = 0.82


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _score_to_01(raw: Any, max_val: float = 10.0) -> float:
    try:
        return _clamp01(float(raw) / max_val)
    except (TypeError, ValueError):
        return 0.0


def _fidelity_from_incident(incident: dict[str, Any] | None) -> float:
    if not incident:
        return 1.0
    for key in ("fidelity_score", "fidelity", "ueba_fidelity"):
        v = incident.get(key)
        if v is not None:
            try:
                return _clamp01(float(v))
            except (TypeError, ValueError):
                return 1.0
    return 1.0


def _core_or_critical_asset(incident: dict[str, Any] | None) -> bool:
    if not incident:
        return False
    blob = json_safe_lower_blob(incident)
    if "core-banking" in blob or "core_banking" in blob:
        return True
    crit = str(incident.get("asset_criticality", "")).upper()
    if crit == "CRITICAL":
        return True
    ent = incident.get("entity", {})
    if isinstance(ent, dict):
        aid = str(ent.get("asset_id", "") + ent.get("asset", "")).lower()
        if "core" in aid and "bank" in aid:
            return True
    return False


def json_safe_lower_blob(incident: dict[str, Any]) -> str:
    """Cheap string sweep for policy keywords (offline)."""
    try:
        import json

        return json.dumps(incident, default=str).lower()
    except Exception:
        return str(incident).lower()


class VotingEngine:
    """
    Weighted multi-agent voting (AADI) → final confidence, execution mode, audit trace.

    Legacy fields ``final_score`` (0–10 int) and ``decision`` (critical/high/medium)
    are preserved for downstream PolicyGuard and automation hooks.
    """

    def __init__(self) -> None:
        pass

    def decide(
        self,
        risk: dict[str, Any],
        compliance: dict[str, Any],
        impact: dict[str, Any],
        incident: dict[str, Any] | None = None,
        agent_memory: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        r_01 = _score_to_01(risk.get("risk_score", 0))
        c_01 = _score_to_01(compliance.get("compliance_score", 0))
        i_01 = _score_to_01(impact.get("impact_score", 0))

        w_r, w_c, w_i = _AGENT_WEIGHTS["risk"], _AGENT_WEIGHTS["compliance"], _AGENT_WEIGHTS["impact"]
        weighted = w_r * r_01 + w_c * c_01 + w_i * i_01

        fidelity = _fidelity_from_incident(incident or {})
        final_confidence = round(_clamp01(weighted * fidelity), 4)

        risk_sig = str(risk.get("primary_signal", "")).strip() or (
            f"ITMM-style severity={risk.get('severity', 'unknown')}, risk_score={risk.get('risk_score', 0)}/10"
        )
        comp_sig = str(compliance.get("primary_signal", "")).strip() or (
            "DORA/GDPR mapping: " + (
                "; ".join(compliance.get("violations", []) or ["no mapped violations"])
            )
        )
        impact_sig = str(impact.get("primary_signal", "")).strip() or (
            f"Asset criticality path → business_impact={impact.get('business_impact', 'unknown')}"
        )

        agent_votes = [
            {
                "agent": "risk",
                "domain_score_0_1": round(r_01, 4),
                "weight": w_r,
                "weighted_contribution_0_1": round(w_r * r_01, 4),
                "primary_signal": risk_sig,
            },
            {
                "agent": "compliance",
                "domain_score_0_1": round(c_01, 4),
                "weight": w_c,
                "weighted_contribution_0_1": round(w_c * c_01, 4),
                "primary_signal": comp_sig,
            },
            {
                "agent": "impact",
                "domain_score_0_1": round(i_01, 4),
                "weight": w_i,
                "weighted_contribution_0_1": round(w_i * i_01, 4),
                "primary_signal": impact_sig,
            },
        ]

        core_critical = _core_or_critical_asset(incident if isinstance(incident, dict) else None)
        reasoning_trace: list[dict[str, Any]] = [
            {
                "step": "normalize_agent_scores",
                "detail": "Mapped risk/compliance/impact scores to 0–1 for weighted voting.",
            },
            {
                "step": "weighted_aggregate",
                "detail": f"weighted={round(weighted, 4)} using weights risk={w_r}, compliance={w_c}, impact={w_i}.",
            },
            {
                "step": "fidelity_modulation",
                "detail": f"fidelity_score_effective={fidelity}; final_confidence={final_confidence}.",
            },
            {
                "step": "asset_governance_gate",
                "detail": f"core_or_critical_asset={core_critical} (blocks autonomous machine actions on core banking).",
            },
        ]

        # Execution mode from governance thresholds
        if final_confidence >= _THRESHOLD_AUTONOMOUS and not core_critical:
            execution_mode = "AUTONOMOUS"
            autonomous_machine = True
            human_gate = False
        elif final_confidence >= _THRESHOLD_ASSISTED:
            execution_mode = "ASSISTED"
            autonomous_machine = False
            human_gate = True
        else:
            execution_mode = "MANUAL"
            autonomous_machine = False
            human_gate = True

        if core_critical:
            autonomous_machine = False
            if execution_mode == "AUTONOMOUS":
                execution_mode = "ASSISTED"
                reasoning_trace.append(
                    {
                        "step": "downgrade_execution_mode",
                        "detail": "Core/critical asset: AUTONOMOUS downgraded to ASSISTED (human approval gate).",
                    }
                )

        # Legacy aggregate 0–10 score and severity label
        legacy_avg = (float(risk.get("risk_score", 0)) + float(compliance.get("compliance_score", 0)) + float(impact.get("impact_score", 0))) / 3.0
        final_score = int(round(legacy_avg))
        final_score = max(0, min(10, final_score))

        if final_score >= 8:
            decision = "critical"
        elif final_score >= 6:
            decision = "high"
        else:
            decision = "medium"

        reasoning_trace.append(
            {
                "step": "legacy_severity_mapping",
                "detail": f"final_score={final_score}/10 → decision={decision}.",
            }
        )

        policy_guard_result = {
            "autonomous_machine_actions_permitted": autonomous_machine,
            "human_approval_gate_required": human_gate,
            "governance_notes": [
                f"Thresholds: ASSISTED≥{_THRESHOLD_ASSISTED}, AUTONOMOUS≥{_THRESHOLD_AUTONOMOUS} (subject to asset policy).",
            ],
        }

        shared_agent_memory = agent_memory if isinstance(agent_memory, dict) else {}

        return {
            "final_score": final_score,
            "decision": decision,
            "weighted_aggregate_score_0_1": round(weighted, 4),
            "final_confidence_score": final_confidence,
            "execution_mode": execution_mode,
            "agent_votes": agent_votes,
            "reasoning_trace": reasoning_trace,
            "shared_agent_memory": shared_agent_memory,
            "policy_guard_result": policy_guard_result,
        }
