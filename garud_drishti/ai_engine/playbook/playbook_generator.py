from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from garud_drishti.ai_engine.llm.model_loader import ModelLoader
from garud_drishti.ai_engine.playbook.generate_playbook_pdf import generate_playbook_pdf

logger = logging.getLogger(__name__)

_PACKAGE_DIR = Path(__file__).resolve().parent
_DEFAULT_TEMPLATE = _PACKAGE_DIR.parent / "llm" / "prompt_templates" / "playbook_template.txt"
_GARUD_ROOT = _PACKAGE_DIR.parents[1]
_REPORTS_DIR = _GARUD_ROOT / "reports"

_VALID_PHASES = frozenset(
    {"INVESTIGATION_STEPS", "CONTAINMENT_ACTIONS", "ERADICATION_ACTIONS", "RECOVERY_STEPS"}
)
_VALID_ACTIONS = frozenset({"lock_account", "isolate_endpoint", "block_ip"})


@dataclass
class PlaybookSlices:
    anomalies: list[dict[str, Any]]
    events: list[dict[str, Any]]


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return None


def _extract_first_json_object(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start : end + 1]
    raise ValueError("No JSON object found in model output.")


def _safe_pdf_filename(incident_id: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", str(incident_id or "INC"), flags=re.ASCII)


def _telemetry_summary(incident: dict[str, Any]) -> dict[str, Any]:
    ag = incident.get("attack_graph") if isinstance(incident.get("attack_graph"), dict) else {}
    evs = ag.get("events") if isinstance(ag.get("events"), list) else []
    codes: list[str] = []
    systems: set[str] = set()
    for e in evs[:80]:
        if not isinstance(e, dict):
            continue
        c = e.get("event_code") or e.get("raw_event_type")
        if c:
            codes.append(str(c))
        s = e.get("source_system")
        if s:
            systems.add(str(s))
    return {
        "events_in_graph": len(evs),
        "distinct_event_codes_sample": list(dict.fromkeys(codes))[:20],
        "source_systems_observed": sorted(systems),
    }


def _mitre_compact(incident: dict[str, Any]) -> list[dict[str, Any]]:
    ma = incident.get("mitre_attack") if isinstance(incident.get("mitre_attack"), dict) else {}
    techniques = ma.get("techniques") if isinstance(ma.get("techniques"), list) else []
    out: list[dict[str, Any]] = []
    for t in techniques[:12]:
        if not isinstance(t, dict):
            continue
        tid = t.get("technique_id") or t.get("id")
        if tid:
            out.append(
                {
                    "id": str(tid),
                    "name": str(t.get("technique_name") or t.get("name") or ""),
                    "tactic": str(t.get("primary_tactic") or ""),
                }
            )
    if out:
        return out
    cands = ma.get("event_level_candidates") if isinstance(ma.get("event_level_candidates"), list) else []
    for c in cands[:8]:
        if not isinstance(c, dict):
            continue
        tid = c.get("technique_id")
        if tid:
            out.append(
                {
                    "id": str(tid),
                    "name": str(c.get("technique_name") or ""),
                    "tactic": str(c.get("primary_tactic") or ""),
                }
            )
    return out


def _step_dict_to_line(s: dict[str, Any]) -> str:
    purpose = str(s.get("purpose") or "").strip()
    action = str(s.get("action") or "").strip()
    phase = str(s.get("phase") or "").strip()
    parts = [p for p in (phase, action, purpose) if p]
    return " — ".join(parts) if parts else ""


def _coerce_action(raw: Any) -> str:
    a = str(raw or "").strip().lower()
    if a in _VALID_ACTIONS:
        return a
    if "lock" in a or "account" in a or "credential" in a or "revoke" in a:
        return "lock_account"
    if "isolat" in a or "endpoint" in a or "host" in a:
        return "isolate_endpoint"
    return "block_ip"


def _coerce_phase(raw: Any) -> Optional[str]:
    p = str(raw or "").strip().upper()
    if p in _VALID_PHASES:
        return p
    # common variants
    if "INVESTIGATION" in p:
        return "INVESTIGATION_STEPS"
    if "CONTAINMENT" in p:
        return "CONTAINMENT_ACTIONS"
    if "ERADICATION" in p:
        return "ERADICATION_ACTIONS"
    if "RECOVERY" in p:
        return "RECOVERY_STEPS"
    return None


def _normalize_llm_step(item: Any) -> Optional[dict[str, Any]]:
    if isinstance(item, str):
        t = item.strip()
        if not t:
            return None
        return {
            "phase": "INVESTIGATION_STEPS",
            "action": "block_ip",
            "purpose": t[:2000],
        }
    if not isinstance(item, dict):
        return None
    phase = _coerce_phase(item.get("phase"))
    if not phase:
        return None
    action = _coerce_action(item.get("action"))
    purpose = str(item.get("purpose") or item.get("description") or "").strip()
    if not purpose:
        return None
    return {"phase": phase, "action": action, "purpose": purpose[:2000]}


def _dynamic_key_indicators(
    incident: dict[str, Any],
    slices: PlaybookSlices,
    threat_analysis: dict[str, Any],
) -> list[str]:
    ent = incident.get("entity") if isinstance(incident.get("entity"), dict) else {}
    risk = incident.get("risk_assessment") if isinstance(incident.get("risk_assessment"), dict) else {}
    lines: list[str] = []
    iid = incident.get("incident_id")
    if iid:
        lines.append(f"Correlated incident: {iid}")
    if ent.get("src_ip"):
        lines.append(f"Source IP observed: {ent.get('src_ip')}")
    if ent.get("user_id"):
        lines.append(f"User / principal: {ent.get('user_id')}")
    if ent.get("session_id"):
        lines.append(f"Session: {ent.get('session_id')}")
    if ent.get("asset_id") or ent.get("device_id"):
        lines.append(f"Asset / device: {ent.get('asset_id') or ent.get('device_id')}")
    w = incident.get("correlation_window") if isinstance(incident.get("correlation_window"), dict) else {}
    if w.get("start") and w.get("end"):
        lines.append(f"Correlation window: {w.get('start')} → {w.get('end')} ({w.get('event_count', '?')} events)")
    if risk.get("risk_score") is not None:
        lines.append(f"Risk score: {risk.get('risk_score')} ({risk.get('risk_level', '')})")
    for t in _mitre_compact(incident)[:4]:
        lines.append(f"MITRE {t.get('id')}: {t.get('name') or ''} ({t.get('tactic') or ''})".strip())
    for a in slices.anomalies[:4]:
        if not isinstance(a, dict):
            continue
        et = a.get("event_type")
        sev = a.get("severity")
        an = str(a.get("analysis") or "").strip()
        chunk = " | ".join(x for x in [et, sev, an[:120] if an else ""] if x)
        if chunk:
            lines.append(f"Anomaly signal: {chunk}")
    seen = set()
    out: list[str] = []
    for L in lines:
        k = L[:120]
        if k not in seen:
            seen.add(k)
            out.append(L)
    return out[:12]


def _dynamic_steps_for_phase(
    phase: str,
    incident: dict[str, Any],
    slices: PlaybookSlices,
) -> list[dict[str, Any]]:
    ent = incident.get("entity") if isinstance(incident.get("entity"), dict) else {}
    w = incident.get("correlation_window") if isinstance(incident.get("correlation_window"), dict) else {}
    ws = str(w.get("start") or "")
    we = str(w.get("end") or "")
    uid = str(ent.get("user_id") or "")
    sip = str(ent.get("src_ip") or "")
    dev = str(ent.get("device_id") or ent.get("asset_id") or "")
    event_types = list(
        dict.fromkeys(
            str(e.get("event_type") or "")
            for e in slices.events
            if isinstance(e, dict) and e.get("event_type")
        )
    )[:6]

    out: list[dict[str, Any]] = []
    if phase == "INVESTIGATION_STEPS":
        if ws and we:
            out.append(
                {
                    "phase": phase,
                    "action": "block_ip",
                    "purpose": f"Collect and review all telemetry for the entity across {ws}–{we} (correlated window).",
                }
            )
        for et in event_types[:3]:
            out.append(
                {
                    "phase": phase,
                    "action": "isolate_endpoint",
                    "purpose": f"Trace and validate all '{et}' events in the sample set against identity and asset records.",
                }
            )
        if uid:
            out.append(
                {
                    "phase": phase,
                    "action": "lock_account",
                    "purpose": f"Audit authentication, MFA, and privilege changes involving {uid} during the window.",
                }
            )
        if sip:
            out.append(
                {
                    "phase": phase,
                    "action": "block_ip",
                    "purpose": f"Correlate {sip} with firewall, proxy, DNS, and VPN logs for lateral movement indicators.",
                }
            )
    elif phase == "CONTAINMENT_ACTIONS":
        if sip:
            out.append(
                {
                    "phase": phase,
                    "action": "block_ip",
                    "purpose": f"Apply temporary network controls to limit outbound/inbound use of {sip} until scope is confirmed.",
                }
            )
        if uid:
            out.append(
                {
                    "phase": phase,
                    "action": "lock_account",
                    "purpose": f"Suspend interactive sessions and token refresh for {uid} pending investigation outcome.",
                }
            )
        if dev:
            out.append(
                {
                    "phase": phase,
                    "action": "isolate_endpoint",
                    "purpose": f"Isolate {dev} from sensitive segments if execution or data-access anomalies persist.",
                }
            )
    elif phase == "ERADICATION_ACTIONS":
        if uid:
            out.append(
                {
                    "phase": phase,
                    "action": "lock_account",
                    "purpose": f"Rotate credentials and invalidate refresh tokens tied to {uid} after root cause identification.",
                }
            )
        if dev:
            out.append(
                {
                    "phase": phase,
                    "action": "isolate_endpoint",
                    "purpose": f"Remove unapproved persistence mechanisms from {dev} per EDR findings.",
                }
            )
        out.append(
            {
                "phase": phase,
                "action": "block_ip",
                "purpose": "Close firewall or WAF exceptions that may have allowed the observed behavior.",
            }
        )
    elif phase == "RECOVERY_STEPS":
        out.append(
            {
                "phase": phase,
                "action": "isolate_endpoint",
                "purpose": "Validate configuration and integrity of affected hosts before returning to production VLANs.",
            }
        )
        if uid:
            out.append(
                {
                    "phase": phase,
                    "action": "lock_account",
                    "purpose": f"Restore {uid} access only after fraud/risk sign-off and MFA re-enrollment.",
                }
            )
        out.append(
            {
                "phase": phase,
                "action": "block_ip",
                "purpose": "Document IOCs and update detection content to prevent recurrence.",
            }
        )
    return out


def _count_phase(steps: list[dict[str, Any]], phase: str) -> int:
    return sum(1 for s in steps if s.get("phase") == phase)


def _ensure_min_phased_steps(
    steps: list[dict[str, Any]],
    incident: dict[str, Any],
    slices: PlaybookSlices,
) -> list[dict[str, Any]]:
    merged = list(steps)
    minimums = [
        ("INVESTIGATION_STEPS", 3),
        ("CONTAINMENT_ACTIONS", 2),
        ("ERADICATION_ACTIONS", 2),
        ("RECOVERY_STEPS", 2),
    ]
    for phase, need in minimums:
        have = _count_phase(merged, phase)
        if have >= need:
            continue
        dyn = _dynamic_steps_for_phase(phase, incident, slices)
        for d in dyn:
            if have >= need:
                break
            merged.append(d)
            have += 1
        while have < need:
            extra = _dynamic_steps_for_phase(phase, incident, slices)
            if not extra:
                break
            merged.append(extra[have % len(extra)])
            have += 1
    return merged


def _extract_analyst_notes_from_report(report: str) -> str:
    if not report or "ANALYST NOTES" not in report:
        return ""
    part = report.split("ANALYST NOTES", 1)[-1].strip()
    for stop in ("\n\nRISK", "\n\nKEY ", "\n\nINVESTIGATION", "\n\nCONTAINMENT"):
        if stop in part:
            part = part.split(stop, 1)[0].strip()
    return part.strip()[:4000]


def _synthesize_playbook_report_text(
    title: str,
    overview: str,
    severity: str,
    reason: str,
    key_indicators: list[str],
    steps: list[dict[str, Any]],
    automation_candidates: list[str],
    analyst_notes: str,
) -> str:
    """Full multi-section report for persistence and jsPDF when the LLM omits playbook_report."""

    def _by_phase(ph: str) -> list[str]:
        out: list[str] = []
        for s in steps:
            if str(s.get("phase") or "") != ph:
                continue
            p = str(s.get("purpose") or "").strip()
            a = str(s.get("action") or "").strip()
            if p and a:
                out.append(f"{p} (action: {a})")
            elif p:
                out.append(p)
            elif a:
                out.append(a)
        return out

    inv = _by_phase("INVESTIGATION_STEPS")
    con = _by_phase("CONTAINMENT_ACTIONS")
    era = _by_phase("ERADICATION_ACTIONS")
    rec = _by_phase("RECOVERY_STEPS")

    lines: list[str] = [
        f"SOC Incident Response Playbook: {title}",
        "",
        "INCIDENT OVERVIEW",
        overview or "(No overview text.)",
        "",
        "RISK ASSESSMENT",
        f"Severity: {severity or 'unknown'}",
        f"Reason: {reason or 'unknown'}",
        "",
        "KEY INDICATORS",
    ]
    if key_indicators:
        for k in key_indicators:
            lines.append(f"- {k}")
    else:
        lines.append("- (None listed)")
    lines.extend(["", "INVESTIGATION STEPS"])
    if inv:
        for i, s in enumerate(inv, 1):
            lines.append(f"{i}. {s}")
    else:
        lines.append("1. (No investigation steps.)")
    lines.extend(["", "CONTAINMENT ACTIONS"])
    for s in con or ["(No containment actions.)"]:
        lines.append(f"- {s}")
    lines.extend(["", "ERADICATION ACTIONS"])
    for s in era or ["(No eradication actions.)"]:
        lines.append(f"- {s}")
    lines.extend(["", "RECOVERY STEPS"])
    for s in rec or ["(No recovery steps.)"]:
        lines.append(f"- {s}")
    lines.extend(["", "AUTOMATION OPPORTUNITIES"])
    if automation_candidates:
        for a in automation_candidates:
            lines.append(f"- {a}")
    else:
        lines.append("- (None listed)")
    lines.extend(["", "ANALYST NOTES", analyst_notes or "(None)"])
    return "\n".join(lines)


def _build_incident_overview(incident: dict[str, Any], reason: str, slices: PlaybookSlices) -> str:
    iid = str(incident.get("incident_id") or "INC")
    story = str(incident.get("attack_story") or "").strip()
    ag = incident.get("attack_graph") if isinstance(incident.get("attack_graph"), dict) else {}
    story = story or str(ag.get("attack_story") or "").strip()
    r = str(reason or "").strip()
    if len(r) > 400:
        r = r[:397].rstrip() + "..."
    if story:
        base = story
        if len(base) > 700:
            base = base[:697].rstrip() + "..."
        return f"Detection context for {iid}: {base}"
    if r:
        return f"Detection of {r} for incident {iid}."
    parts = [
        f"Incident {iid}",
        f"with {len(slices.events)} sampled normalized events",
        f"and {len(slices.anomalies)} anomaly records in scope",
    ]
    return " ".join(parts) + "."


class PlaybookGenerator:
    """
    LLM-driven playbook for one correlated incident per call.
    Writes a ReportLab PDF under garud_drishti/reports/ and returns structured + flat steps.
    """

    def __init__(
        self,
        model_name: str = "mistral",
        temperature: float = 0.2,
        max_anomalies: int = 8,
        max_events: int = 10,
        prompt_template_path: str | Path | None = None,
        reports_dir: Path | None = None,
    ) -> None:
        self.max_anomalies = int(max_anomalies)
        self.max_events = int(max_events)
        self.temperature = float(temperature)
        tpl = Path(prompt_template_path) if prompt_template_path else _DEFAULT_TEMPLATE
        self.prompt_template_path = tpl
        self.prompt_template = tpl.read_text(encoding="utf-8")
        self.model_loader = ModelLoader(model_name=model_name)
        self.reports_dir = Path(reports_dir) if reports_dir else _REPORTS_DIR

    def _select_slices(
        self,
        incident: dict[str, Any],
        anomalies_for_src_ip: list[dict[str, Any]],
        events_for_src_ip: list[dict[str, Any]],
    ) -> PlaybookSlices:
        window = incident.get("correlation_window", {}) if isinstance(incident.get("correlation_window", {}), dict) else {}
        start_ts = _parse_ts(window.get("start"))
        end_ts = _parse_ts(window.get("end"))

        def _within(ts: Optional[datetime]) -> bool:
            if ts is None:
                return False
            if start_ts and ts < start_ts:
                return False
            if end_ts and ts > end_ts:
                return False
            return True

        anomalies_in_window = [
            a
            for a in anomalies_for_src_ip
            if _within(_parse_ts(a.get("timestamp") or a.get("time") or a.get("ts")))
        ]
        events_in_window = [
            e
            for e in events_for_src_ip
            if _within(_parse_ts(e.get("timestamp") or e.get("time") or e.get("ts")))
        ]

        if len(anomalies_in_window) < 2:
            anomalies_in_window = anomalies_for_src_ip
        if len(events_in_window) < 2:
            events_in_window = events_for_src_ip

        anomalies_in_window = sorted(
            anomalies_in_window,
            key=lambda x: (_parse_ts(x.get("timestamp")) or datetime.min),
            reverse=True,
        )[: self.max_anomalies]

        events_in_window = sorted(
            events_in_window,
            key=lambda x: (_parse_ts(x.get("timestamp")) or datetime.min),
            reverse=True,
        )[: self.max_events]

        return PlaybookSlices(anomalies=anomalies_in_window, events=events_in_window)

    def _build_prompt(
        self,
        incident: dict[str, Any],
        threat_analysis: dict[str, Any],
        slices: PlaybookSlices,
    ) -> str:
        entity = incident.get("entity", {}) if isinstance(incident.get("entity", {}), dict) else {}
        risk_assessment = incident.get("risk_assessment", {}) if isinstance(incident.get("risk_assessment", {}), dict) else {}
        ag = incident.get("attack_graph") if isinstance(incident.get("attack_graph"), dict) else {}

        incident_json: dict[str, Any] = {
            "incident_id": incident.get("incident_id"),
            "generated_at": incident.get("generated_at"),
            "entity": {
                "entity_type": entity.get("entity_type"),
                "entity_key": entity.get("entity_key"),
                "user_id": entity.get("user_id"),
                "session_id": entity.get("session_id"),
                "src_ip": entity.get("src_ip"),
                "asset_id": entity.get("asset_id"),
                "device_id": entity.get("device_id"),
            },
            "correlation_window": incident.get("correlation_window", {}),
            "risk_assessment": risk_assessment,
            "attack_story": incident.get("attack_story") or ag.get("attack_story"),
            "attack_summary": incident.get("attack_summary", {}),
            "mitre_attack": incident.get("mitre_attack", {}),
            "mitre_compact": _mitre_compact(incident),
            "telemetry_summary": _telemetry_summary(incident),
            "attack_graph_edge_stats": {
                "nodes": len(ag.get("nodes", [])) if isinstance(ag.get("nodes"), list) else 0,
                "edges": len(ag.get("edges", [])) if isinstance(ag.get("edges"), list) else 0,
            },
        }

        anomalies_json = [
            {
                "timestamp": a.get("timestamp"),
                "event_type": a.get("event_type"),
                "event_category": a.get("event_category"),
                "severity": a.get("severity"),
                "risk_score": a.get("risk_score"),
                "analysis": a.get("analysis"),
                "src_ip": a.get("src_ip"),
            }
            for a in slices.anomalies
        ]

        events_json = [
            {
                "timestamp": e.get("timestamp"),
                "event_type": e.get("event_type"),
                "event_category": e.get("event_category"),
                "severity": e.get("severity"),
                "session_id": e.get("session_id"),
                "user": e.get("user"),
                "src_ip": e.get("src_ip"),
                "details": e.get("details", {}),
            }
            for e in slices.events
        ]

        prompt = self.prompt_template
        prompt = prompt.replace("{incident_json}", json.dumps(incident_json, indent=2, default=str))
        prompt = prompt.replace("{threat_analysis_json}", json.dumps(threat_analysis or {}, indent=2, default=str))
        prompt = prompt.replace("{anomalies_json}", json.dumps(anomalies_json, indent=2, default=str))
        prompt = prompt.replace("{events_json}", json.dumps(events_json, indent=2, default=str))
        return prompt

    def _finalize_payload(
        self,
        raw: dict[str, Any],
        incident: dict[str, Any],
        threat_analysis: dict[str, Any],
        slices: PlaybookSlices,
        from_llm: bool,
        write_pdf: bool = True,
    ) -> dict[str, Any]:
        iid = str(incident.get("incident_id") or "INC")

        reason = str(raw.get("reason") or "").strip()
        if not reason:
            risk = incident.get("risk_assessment") if isinstance(incident.get("risk_assessment"), dict) else {}
            reason = (
                f"Correlated activity in window {risk.get('risk_level', '')} risk "
                f"(score {risk.get('risk_score', '')}); see telemetry samples."
            ).strip()

        severity = str(raw.get("severity_label") or "").strip() or str(
            (incident.get("risk_assessment") or {}).get("risk_level") or ""
        )

        title = str(raw.get("playbook_title") or "").strip() or f"Response plan for {iid}"

        kiw = raw.get("key_indicators")
        if not isinstance(kiw, list) or not kiw:
            key_indicators = _dynamic_key_indicators(incident, slices, threat_analysis)
        else:
            key_indicators = [str(x).strip() for x in kiw if str(x).strip()]

        auto = raw.get("automation_candidates")
        if not isinstance(auto, list):
            auto = []
        automation_candidates = [str(x).strip() for x in auto if str(x).strip()]

        steps_in: list[Any] = raw.get("steps") if isinstance(raw.get("steps"), list) else []
        norm_steps: list[dict[str, Any]] = []
        for item in steps_in:
            s = _normalize_llm_step(item)
            if s:
                norm_steps.append(s)
        steps_filled = _ensure_min_phased_steps(norm_steps, incident, slices)

        report = str(raw.get("playbook_report") or "").strip()
        analyst = str(raw.get("analyst_notes") or "").strip()
        overview = _build_incident_overview(incident, reason, slices)

        if not analyst:
            analyst = _extract_analyst_notes_from_report(report)
        if not analyst:
            analyst = (
                f"Track MTTC for {iid}; preserve chain-of-custody for sampled events and anomaly scores; "
                f"escalate per internal tiering if risk exceeds current classification ({severity})."
            )

        if not report:
            report = _synthesize_playbook_report_text(
                title,
                overview,
                severity,
                reason,
                key_indicators,
                steps_filled,
                automation_candidates,
                analyst,
            )

        payload = {
            "incident_id": iid,
            "playbook_title": title,
            "severity_label": severity,
            "reason": reason,
            "key_indicators": key_indicators,
            "automation_candidates": automation_candidates,
            "steps": steps_filled,
            "playbook_report": report,
            "analyst_notes": analyst,
            "incident_overview": overview,
        }

        pdf_path_str = ""
        if write_pdf:
            self.reports_dir.mkdir(parents=True, exist_ok=True)
            pdf_path = self.reports_dir / f"playbook_{_safe_pdf_filename(iid)}.pdf"
            generate_playbook_pdf(payload, str(pdf_path))
            pdf_path_str = str(pdf_path)

        steps_flat = [_step_dict_to_line(s) for s in steps_filled if _step_dict_to_line(s)]

        out = {
            **payload,
            "pdf_path": pdf_path_str,
            "steps_flat": steps_flat,
        }
        return out

    def _fallback_payload(
        self,
        incident: dict[str, Any],
        threat_analysis: dict[str, Any],
        slices: PlaybookSlices,
        write_pdf: bool = True,
    ) -> dict[str, Any]:
        risk = incident.get("risk_assessment", {}) if isinstance(incident.get("risk_assessment", {}), dict) else {}
        risk_level = risk.get("risk_level") or threat_analysis.get("severity") or "LOW"
        reason = (
            "Insufficient telemetry slices for LLM context; generated structured outline from correlation record only."
        )
        raw = {
            "playbook_title": f"SOC Incident Response Playbook: {incident.get('incident_id', 'INC')}",
            "severity_label": str(risk_level),
            "reason": reason,
            "key_indicators": _dynamic_key_indicators(incident, slices, threat_analysis),
            "automation_candidates": [],
            "steps": [],
            "playbook_report": "",
            "analyst_notes": "",
        }
        return self._finalize_payload(raw, incident, threat_analysis, slices, from_llm=False, write_pdf=write_pdf)

    def generate_for_incident(
        self,
        incident: dict[str, Any],
        threat_analysis: dict[str, Any],
        anomalies_for_src_ip: list[dict[str, Any]],
        events_for_src_ip: list[dict[str, Any]],
        *,
        write_pdf: bool = True,
    ) -> dict[str, Any]:
        slices = self._select_slices(incident, anomalies_for_src_ip, events_for_src_ip)

        if not slices.anomalies and not slices.events:
            return self._fallback_payload(incident, threat_analysis, slices, write_pdf=write_pdf)

        prompt = self._build_prompt(incident, threat_analysis, slices)

        try:
            llm_raw = self.model_loader.generate(prompt)
            json_payload_str = _extract_first_json_object(llm_raw)
            payload = json.loads(json_payload_str)
            if not isinstance(payload, dict):
                raise ValueError("LLM JSON payload is not an object.")
            payload.setdefault("automation_candidates", [])
            payload.setdefault("steps", [])
            payload.setdefault("playbook_report", "")
            payload.setdefault("analyst_notes", "")
            return self._finalize_payload(
                payload, incident, threat_analysis, slices, from_llm=True, write_pdf=write_pdf
            )
        except Exception as exc:
            iid_log = str(incident.get("incident_id") or "")
            detail = f"{type(exc).__name__}: {str(exc)[:500]}"
            logger.warning("Playbook LLM failed for %s — %s", iid_log or "unknown", detail)
            risk = incident.get("risk_assessment", {}) if isinstance(incident.get("risk_assessment", {}), dict) else {}
            raw = {
                "playbook_title": f"SOC Incident Response Playbook: {incident.get('incident_id', 'INC')}",
                "severity_label": str(risk.get("risk_level") or "MEDIUM"),
                "reason": (
                    "LLM output was not valid JSON or the model call failed; filled from live incident context. "
                    f"Detail: {detail}"
                ),
                "key_indicators": [],
                "automation_candidates": [],
                "steps": [],
                "playbook_report": "",
                "analyst_notes": "",
            }
            return self._finalize_payload(
                raw, incident, threat_analysis, slices, from_llm=False, write_pdf=write_pdf
            )

    def generate(self, playbook_name: str) -> dict[str, Any]:
        prompt = (
            "Generate a SOC response playbook in JSON with keys "
            "`playbook_title`, `steps` (array of short imperative strings), and "
            "`playbook_report` for this playbook type: "
            f"{playbook_name}"
        )
        try:
            llm_raw = self.model_loader.generate(prompt)
            json_payload_str = _extract_first_json_object(llm_raw)
            payload = json.loads(json_payload_str)
            if not isinstance(payload, dict):
                raise ValueError("LLM JSON payload is not an object.")
            payload.setdefault("playbook", playbook_name)
            payload.setdefault("steps", [])
            payload.setdefault("playbook_report", "")
            return payload
        except Exception:
            return {
                "playbook": playbook_name,
                "steps": [],
                "playbook_report": "",
            }
