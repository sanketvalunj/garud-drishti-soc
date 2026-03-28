"""
Governance-Calibrated Autonomous Response (GCAR): structured playbook object
from VotingEngineOutput + incident (deterministic skeleton for audit / SOAR).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any


def _canonical_json_sha256(obj: Any) -> str:
    payload = json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _shap_style_why(agent: str, vote: dict[str, Any], mem: dict[str, Any]) -> str:
    """Lightweight explainability string (offline SHAP substitute)."""
    if agent == "risk":
        return (
            f"Risk contribution driven by normalized risk score "
            f"({mem.get('risk_score', vote.get('domain_score_0_1'))}) and severity {mem.get('severity', 'unknown')}."
        )
    if agent == "compliance":
        v = mem.get("violations") or []
        return (
            "Compliance contribution driven by policy rule hits: "
            f"{'; '.join(v) if v else 'no mapped violations'}."
        )
    if agent == "impact":
        return (
            "Business impact contribution driven by asset class mapping: "
            f"{mem.get('business_impact', 'unknown')}."
        )
    return "Agent contribution summarized from vote record."


def build_playbook_object(
    voting_output: dict[str, Any],
    incident: dict[str, Any],
    agent_memory: dict[str, Any],
) -> dict[str, Any]:
    """
    Build PlaybookObject JSON from deliberation results and the unified incident.

    Machine-speed actions are only included when policy allows autonomous execution.
    """
    incident_id = str(incident.get("incident_id", "UNKNOWN"))
    votes = voting_output.get("agent_votes") or []
    execution_mode = str(voting_output.get("execution_mode", "MANUAL"))
    pg = voting_output.get("policy_guard_result") or {}
    autonomous_ok = bool(pg.get("autonomous_machine_actions_permitted"))
    src_ip = ""
    entity = incident.get("entity", {})
    if isinstance(entity, dict):
        src_ip = str(entity.get("src_ip", "") or "")

    agent_effects: list[dict[str, Any]] = []
    for v in votes:
        name = str(v.get("agent", ""))
        mem = agent_memory.get(name, {}) if isinstance(agent_memory, dict) else {}
        agent_effects.append(
            {
                "agent": name,
                "primary_signal": v.get("primary_signal", ""),
                "shap_style_why": _shap_style_why(name, v, mem),
                "weighted_contribution_0_1": v.get("weighted_contribution_0_1"),
            }
        )

    immediate_t60: list[dict[str, Any]] = []
    if autonomous_ok and execution_mode == "AUTONOMOUS":
        if src_ip:
            immediate_t60.append(
                {
                    "action": "block_source_ip_firewall",
                    "target": src_ip,
                    "why": "Policy Guard approved autonomous containment; Risk primary signal supports machine-speed network deny.",
                    "nist_csf": "RS.MI",
                }
            )
        immediate_t60.append(
            {
                "action": "revoke_active_sessions_tokens",
                "target": incident_id,
                "why": "Token revocation limits lateral movement when autonomous mode is permitted.",
                "nist_csf": "RS.AN",
            }
        )
    elif execution_mode == "ASSISTED":
        immediate_t60.append(
            {
                "action": "prepare_containment_recommendations",
                "target": src_ip or incident_id,
                "why": "Assisted mode: surface block/revoke as one-click analyst actions; no autonomous execution.",
                "nist_csf": "RS.MI",
            }
        )
    else:
        immediate_t60.append(
            {
                "action": "analyst_triage_only",
                "target": incident_id,
                "why": "Manual mode: no machine-speed enforcement until analyst validates.",
                "nist_csf": "RS.MA",
            }
        )

    containment = [
        {
            "phase": "contain",
            "step": "Isolate affected host from production VLAN; preserve disk for forensics.",
            "nist_csf": "RS.MI",
        },
        {
            "phase": "eradicate",
            "step": "Remove persistence (scheduled tasks, services, unknown binaries) per EDR baseline.",
            "nist_csf": "RS.MI",
        },
        {
            "phase": "eradicate",
            "step": "Reset compromised credentials and enforce step-up authentication for impacted users.",
            "nist_csf": "RS.MI",
        },
    ]

    recovery = [
        {
            "phase": "recover",
            "step": "Fail over critical services to healthy nodes per RTO/RPO; validate 99.9% SLA path.",
            "nist_csf": "RC.RP",
        },
        {
            "phase": "recover",
            "step": "Restore from verified snapshots only; run integrity checks before traffic shift-back.",
            "nist_csf": "RC.RP",
        },
        {
            "phase": "recover",
            "step": "Gradual traffic restoration with monitoring; confirm error budgets within SLA.",
            "nist_csf": "RC.CO",
        },
    ]

    compliance_block = {
        "dora": [
            "Assess ICT incident classification; if major, prepare regulator notification within applicable DORA timelines (often 24h initial, subject to jurisdictional procedure).",
            "Document continuous updates and root-cause analysis for supervisory follow-up.",
        ],
        "gdpr": [
            "If personal data breach: assess risk to individuals; document 72h supervisory notification assessment where applicable.",
            "Record legal basis for processing and breach facts for DPO review.",
        ],
        "internal": [
            "Attach VotingEngineOutput + reasoning_trace to the immutable audit ledger entry.",
        ],
    }

    deliberation_for_hash = {
        "final_confidence_score": voting_output.get("final_confidence_score"),
        "weighted_aggregate_score_0_1": voting_output.get("weighted_aggregate_score_0_1"),
        "execution_mode": execution_mode,
        "agent_votes": votes,
        "policy_guard_result": pg,
    }
    voting_snapshot_hash = _canonical_json_sha256(deliberation_for_hash)

    return {
        "playbook_id": f"GCAR-{incident_id}",
        "incident_id": incident_id,
        "execution_mode": execution_mode,
        "final_confidence_score": voting_output.get("final_confidence_score"),
        "agent_effects": agent_effects,
        "immediate_mitigation_t60s": immediate_t60,
        "containment_eradication": containment,
        "recovery_continuity": recovery,
        "compliance_mandates": compliance_block,
        "audit_trail": {
            "deliberation_hash_sha256": voting_snapshot_hash,
            "voting_engine_snapshot_hash_sha256": voting_snapshot_hash,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "immutable_ledger_note": "Hash covers agent_votes, confidence, execution_mode, and policy_guard_result.",
        },
    }
