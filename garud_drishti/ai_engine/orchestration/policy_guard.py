from __future__ import annotations

from typing import Any


class PolicyGuard:
    """
    Enforces SOC governance policies before response execution.
    Merges with AADI ``policy_guard_result`` (autonomous vs human gate).
    """

    def __init__(self) -> None:
        pass

    def validate(self, decision: dict[str, Any], incident: dict[str, Any] | None = None) -> dict[str, Any]:
        level = str(decision.get("decision", "")).lower()

        if level == "critical":
            decision["requires_approval"] = True
        else:
            decision["requires_approval"] = False

        pg = decision.get("policy_guard_result")
        if not isinstance(pg, dict):
            pg = {}
            decision["policy_guard_result"] = pg

        if decision["requires_approval"]:
            pg["autonomous_machine_actions_permitted"] = False
            pg["human_approval_gate_required"] = True
            if str(decision.get("execution_mode", "")).upper() == "AUTONOMOUS":
                decision["execution_mode"] = "ASSISTED"
                notes = pg.setdefault("governance_notes", [])
                if isinstance(notes, list):
                    notes.append("Critical severity: execution_mode capped at ASSISTED pending approval.")

        if incident and str(incident.get("manual_only", "")).lower() in {"1", "true", "yes"}:
            decision["execution_mode"] = "MANUAL"
            pg["autonomous_machine_actions_permitted"] = False
            pg["human_approval_gate_required"] = True

        return decision
