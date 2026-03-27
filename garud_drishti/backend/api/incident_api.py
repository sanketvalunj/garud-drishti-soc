from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from garud_drishti.backend.utils.json_helpers import load_json, save_json
from garud_drishti.ingestion.ingestion_api import IngestionService
from garud_drishti.detectiontemp import DetectionService
from garud_drishti.correlation_engine.correlation_service import CorrelationService
from garud_drishti.ai_engine.llm.model_loader import ModelLoader

router = APIRouter()

# --------------------------------------------------------------------------------------
# Correlated incidents (real correlation-engine output)
# Source of truth: garud_drishti/data/incidents/correlated_incidents.json
# --------------------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_CORRELATED_PATH = _PROJECT_ROOT / "garud_drishti" / "data" / "incidents" / "correlated_incidents.json"

_CORRELATED_CACHE: Dict[str, Any] = {
    "mtime": None,
    "incidents": [],
    "by_id": {},
}

_PLAYBOOKS_PATH = _PROJECT_ROOT / "garud_drishti" / "data" / "ai_engine" / "playbooks.json"
_PLAYBOOKS_CACHE: Dict[str, Any] = {
    "mtime": None,
    "by_incident_id": {},
}
_SOC_RESULTS_PATH = _PROJECT_ROOT / "garud_drishti" / "data" / "ai_engine" / "soc_results.json"
_SOC_RESULTS_CACHE: Dict[str, Any] = {
    "mtime": None,
    "by_incident_id": {},
}


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    v = value.strip()
    try:
        # Handle both "...Z" and "+00:00" styles.
        if v.endswith("Z"):
            v = v[:-1] + "+00:00"
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _ago_label(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    now = datetime.now(timezone.utc)
    delta_s = max(0, int((now - dt).total_seconds()))
    if delta_s < 60:
        return f"{delta_s}s ago"
    if delta_s < 3600:
        return f"{delta_s // 60} min ago"
    if delta_s < 86400:
        return f"{delta_s // 3600} hr ago"
    return f"{delta_s // 86400} day ago"


def _normalize_severity_from_risk_level(risk_level: Optional[str]) -> str:
    raw = (risk_level or "").strip().upper()
    if raw in {"CRITICAL", "HIGH"}:
        return "high"
    if raw in {"MEDIUM"}:
        return "medium"
    return "low"


def _pick_attack_type(incident: Dict[str, Any]) -> str:
    patterns = (incident.get("attack_summary") or {}).get("patterns_detected") or []
    if patterns:
        # Keep UI short: Title-case pattern name.
        p = str(patterns[0]).replace("_", " ").strip()
        return p.title() if p else "Suspicious Activity"
    tactics = (incident.get("mitre_attack") or {}).get("tactics") or []
    if tactics:
        return str(tactics[0]).replace("_", " ").strip().title()
    return "Suspicious Activity"


def _mitre_techniques_compact(incident: Dict[str, Any]) -> List[Dict[str, Any]]:
    techniques = (incident.get("mitre_attack") or {}).get("techniques") or []
    if not isinstance(techniques, list):
        techniques = []
    out: List[Dict[str, Any]] = []
    for t in techniques:
        if not isinstance(t, dict):
            continue
        tid = t.get("technique_id") or t.get("id")
        if not tid:
            continue
        out.append(
            {
                "id": str(tid),
                "name": str(t.get("technique_name") or t.get("name") or ""),
                "tactic": str(t.get("primary_tactic") or ""),
                "confidence": int(t.get("confidence_score") or 0) if str(t.get("confidence_score") or "").isdigit() else t.get("confidence") or "confirmed",
            }
        )
    # If no confirmed techniques, fall back to event-level candidates.
    if out:
        return out
    candidates = (incident.get("mitre_attack") or {}).get("event_level_candidates") or []
    if not isinstance(candidates, list):
        candidates = []
    for c in candidates[:5]:
        if not isinstance(c, dict):
            continue
        tid = c.get("technique_id")
        if not tid:
            continue
        out.append(
            {
                "id": str(tid),
                "name": str(c.get("technique_name") or ""),
                "tactic": str(c.get("primary_tactic") or ""),
                "confidence": str(c.get("confidence") or "candidate"),
            }
        )
    return out


def _fidelity_factors_from_components(incident: Dict[str, Any]) -> List[Dict[str, Any]]:
    comp = ((incident.get("risk_assessment") or {}).get("components") or {})
    if not isinstance(comp, dict) or not comp:
        return []
    # Take top 3 contributing components by absolute value (ignore penalty sign issues by abs).
    ranked: List[Tuple[str, float]] = []
    for k, v in comp.items():
        try:
            ranked.append((str(k), float(v)))
        except Exception:
            continue
    ranked.sort(key=lambda kv: abs(kv[1]), reverse=True)
    top = ranked[:3]
    # Normalize to 0..1-ish for UI bar usage (not a new score; only a visual breakdown).
    max_abs = max(1e-9, max(abs(v) for _, v in top)) if top else 1.0
    out: List[Dict[str, Any]] = []
    for k, v in top:
        label = k.replace("_", " ").title()
        out.append({"label": label, "score": min(1.0, abs(v) / max_abs), "raw": v})
    return out


def _load_correlated() -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    if not _CORRELATED_PATH.exists():
        return [], {}

    mtime = _CORRELATED_PATH.stat().st_mtime
    if _CORRELATED_CACHE["mtime"] == mtime and _CORRELATED_CACHE["incidents"]:
        return _CORRELATED_CACHE["incidents"], _CORRELATED_CACHE["by_id"]

    payload = load_json(str(_CORRELATED_PATH))
    incidents = payload if isinstance(payload, list) else []
    by_id: Dict[str, Dict[str, Any]] = {}
    for inc in incidents:
        if isinstance(inc, dict) and inc.get("incident_id"):
            by_id[str(inc["incident_id"])] = inc

    _CORRELATED_CACHE["mtime"] = mtime
    _CORRELATED_CACHE["incidents"] = incidents
    _CORRELATED_CACHE["by_id"] = by_id
    return incidents, by_id


def _load_playbooks_by_incident_id() -> Dict[str, Dict[str, Any]]:
    if not _PLAYBOOKS_PATH.exists():
        return {}

    mtime = _PLAYBOOKS_PATH.stat().st_mtime
    if _PLAYBOOKS_CACHE["mtime"] == mtime and _PLAYBOOKS_CACHE["by_incident_id"]:
        return _PLAYBOOKS_CACHE["by_incident_id"]

    payload = load_json(str(_PLAYBOOKS_PATH))
    rows = payload if isinstance(payload, list) else []
    by_id: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        inc_id = r.get("incident_id")
        if not inc_id:
            continue
        by_id[str(inc_id)] = r

    _PLAYBOOKS_CACHE["mtime"] = mtime
    _PLAYBOOKS_CACHE["by_incident_id"] = by_id
    return by_id


def _load_soc_results_by_incident_id() -> Dict[str, Dict[str, Any]]:
    if not _SOC_RESULTS_PATH.exists():
        return {}

    mtime = _SOC_RESULTS_PATH.stat().st_mtime
    if _SOC_RESULTS_CACHE["mtime"] == mtime and _SOC_RESULTS_CACHE["by_incident_id"]:
        return _SOC_RESULTS_CACHE["by_incident_id"]

    payload = load_json(str(_SOC_RESULTS_PATH))
    rows = payload.get("data") if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        rows = []

    by_id: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        inc_id = r.get("incident_id")
        if inc_id:
            by_id[str(inc_id)] = r

    _SOC_RESULTS_CACHE["mtime"] = mtime
    _SOC_RESULTS_CACHE["by_incident_id"] = by_id
    return by_id


def _stage_to_title(stage: str) -> str:
    return str(stage or "").replace("_", " ").strip().title()


def _stage_oneliner(stage: str) -> str:
    key = str(stage or "").strip().lower()
    one_liners = {
        "initial_access": "Attacker gains first foothold using suspicious login or exposed credentials.",
        "execution": "Malicious commands or scripts are executed on a compromised host.",
        "persistence": "Adversary establishes mechanisms to maintain continued access.",
        "privilege_escalation": "Permissions are elevated to access protected systems or actions.",
        "defense_evasion": "Security controls are bypassed to reduce detection visibility.",
        "credentialed_process_execution": "Legitimate credentials are abused to run high-risk operations.",
        "lateral_movement": "Activity expands from one system to other internal targets.",
        "command_and_control": "Compromised asset communicates with remote control infrastructure.",
        "collection": "Sensitive information is aggregated before possible exfiltration.",
        "exfiltration": "Data is transferred out of the environment toward external destinations.",
        "data_exfiltration": "Sensitive data movement indicates probable unauthorized extraction.",
        "impact": "Adversary actions disrupt, alter, or degrade business operations.",
    }
    return one_liners.get(
        key,
        "Suspicious progression observed in the attack sequence for this incident.",
    )


def _normalize_playbook_steps(raw_steps: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw_steps, list):
        return []
    out: List[Dict[str, Any]] = []
    for idx, step in enumerate(raw_steps, start=1):
        title = str(step).strip() if isinstance(step, str) else str((step or {}).get("title") or "").strip()
        if not title:
            continue
        out.append(
            {
                "id": idx,
                "title": title,
                "description": title,
                "priority": "immediate" if idx <= 2 else "urgent",
                "type": "manual",
                "owner": "SOC Team",
                "estimatedTime": "5-15 min",
                "status": "pending",
            }
        )
    return out


def _extract_first_json_object(text: str) -> str:
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```json\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\\s*", "", cleaned)
    cleaned = re.sub(r"```\\s*$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        return cleaned[start : end + 1]
    raise ValueError("No JSON object found in LLM output.")


def _build_playbook_prompt(incident: Dict[str, Any], soc_item: Dict[str, Any], attack_chain: List[Dict[str, Any]]) -> str:
    ent = incident.get("entity") or {}
    risk = incident.get("risk_assessment") or {}
    chain = [_stage_to_title(str((s or {}).get("stage") or "")) for s in (attack_chain or []) if isinstance(s, dict)]
    if not chain:
        chain = ["Suspicious Activity"]
    payload = {
        "incident_id": incident.get("incident_id"),
        "entity": {
            "user_id": ent.get("user_id"),
            "asset_id": ent.get("asset_id"),
            "device_id": ent.get("device_id"),
            "src_ip": ent.get("src_ip"),
        },
        "risk": {
            "risk_score": risk.get("risk_score"),
            "risk_level": risk.get("risk_level"),
        },
        "attack_chain": chain,
        "threat_analysis": soc_item.get("threat_analysis") if isinstance(soc_item, dict) else {},
    }
    return (
        "You are a SOC playbook generator. Return ONLY valid JSON with keys: "
        "`playbook_title` (string), `steps` (array of exactly 6 short imperative strings), "
        "`playbook_report` (concise multi-section SOC report, plain text), "
        "`automation_candidates` (array of strings).\n"
        "Do not include markdown fences.\n\n"
        f"INCIDENT_CONTEXT:\n{json.dumps(payload, indent=2)}"
    )


def _generate_playbook_with_mistral(
    incident: Dict[str, Any],
    soc_item: Dict[str, Any],
    attack_chain: List[Dict[str, Any]],
) -> Dict[str, Any]:
    loader = ModelLoader(model_name="mistral")
    prompt = _build_playbook_prompt(incident, soc_item, attack_chain)
    try:
        llm_raw = loader.generate(prompt)
        payload = json.loads(_extract_first_json_object(llm_raw))
        if not isinstance(payload, dict):
            raise ValueError("Invalid playbook payload from LLM.")
        payload.setdefault("playbook_title", f"SOC Incident Response Playbook: {incident.get('incident_id', 'INC')}")
        payload.setdefault("steps", [])
        payload.setdefault("playbook_report", "")
        payload.setdefault("automation_candidates", [])
        return payload
    except Exception:
        # Relaxed fallback: still generated by Mistral, but tolerant to non-JSON outputs.
        incident_id = str(incident.get("incident_id") or "INC")
        plain_prompt = (
            "Generate exactly 6 concise SOC response steps for this incident. "
            "Return plain text with one step per line and no numbering.\n\n"
            f"{json.dumps({'incident_id': incident_id, 'threat_analysis': soc_item.get('threat_analysis', {}), 'attack_chain': attack_chain}, indent=2)}"
        )
        plain_steps_raw = loader.generate(plain_prompt)
        raw_lines = [
            x.strip("- ").strip()
            for x in (plain_steps_raw or "").splitlines()
            if "llm unavailable" not in x.lower()
        ]
        steps = [x for x in raw_lines if x][:6]
        if len(steps) < 6:
            soc_steps = ((soc_item.get("response") if isinstance(soc_item, dict) else {}) or {}).get("steps") or []
            for s in soc_steps:
                if len(steps) >= 6:
                    break
                text = str(s).strip()
                if text and text not in steps:
                    steps.append(text)
        if len(steps) < 6:
            enrich_prompt = (
                "Expand these SOC playbook steps to exactly 6 distinct steps. "
                "Return one step per line only.\n"
                f"Current steps: {json.dumps(steps, ensure_ascii=True)}\n"
                f"Incident context: {json.dumps({'incident_id': incident_id, 'attack_chain': attack_chain}, ensure_ascii=True)}"
            )
            enriched_raw = loader.generate(enrich_prompt)
            enriched_lines = [
                x.strip("- ").strip()
                for x in (enriched_raw or "").splitlines()
                if "llm unavailable" not in x.lower()
            ]
            enriched = [x for x in enriched_lines if x]
            if len(enriched) >= len(steps):
                steps = enriched[:6]
        if len(steps) < 6:
            stage_titles = [
                _stage_to_title(str((s or {}).get("stage") or "Activity"))
                for s in (attack_chain or [])
                if isinstance(s, dict)
            ]
            for st in stage_titles:
                if len(steps) >= 6:
                    break
                text = f"Contain and validate controls for stage {st} in {incident_id}"
                if text not in steps:
                    steps.append(text)
        if len(steps) < 6:
            existing = list(steps)
            while len(steps) < 6 and existing:
                steps.append(existing[len(steps) % len(existing)])

        report_prompt = (
            "Write a concise SOC incident response report in plain text using these steps.\n"
            f"Incident: {incident_id}\n"
            f"Steps: {json.dumps(steps, ensure_ascii=True)}"
        )
        report_text = (loader.generate(report_prompt) or "").strip()
        return {
            "playbook_title": f"SOC Incident Response Playbook: {incident_id}",
            "steps": steps,
            "playbook_report": report_text,
            "automation_candidates": [],
        }


def _persist_playbook_record(incident_id: str, payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    rows = load_json(str(_PLAYBOOKS_PATH))
    rows = rows if isinstance(rows, list) else []
    record = {
        "incident_id": incident_id,
        "playbook_title": str(payload.get("playbook_title") or ""),
        "steps": payload.get("steps") if isinstance(payload.get("steps"), list) else [],
        "playbook_report": str(payload.get("playbook_report") or ""),
        "automation_candidates": payload.get("automation_candidates") if isinstance(payload.get("automation_candidates"), list) else [],
        "generated_by": "mistral",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    replaced = False
    for i, row in enumerate(rows):
        if isinstance(row, dict) and str(row.get("incident_id") or "") == incident_id:
            rows[i] = record
            replaced = True
            break
    if not replaced:
        rows.append(record)

    save_json(str(_PLAYBOOKS_PATH), rows)
    _PLAYBOOKS_CACHE["mtime"] = None
    return _load_playbooks_by_incident_id()


def _short_narrative_fallback(incident: Dict[str, Any]) -> str:
    # Keep it “short format” for the UI — 1–2 sentences.
    story = str((incident.get("attack_graph") or {}).get("attack_story") or "").strip()
    if story:
        return story if len(story) <= 260 else story[:257].rstrip() + "..."
    # If missing, construct a minimal narrative.
    ent = incident.get("entity") or {}
    user = ent.get("user_id") or ent.get("entity_key") or "unknown"
    src_ip = ent.get("src_ip") or ""
    score = ((incident.get("risk_assessment") or {}).get("risk_score") or "")
    return f"Correlated activity for {user}{(' from ' + src_ip) if src_ip else ''}. Risk score {score}."


def _build_incident_list_item(
    incident: Dict[str, Any],
    playbooks_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
    soc_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    inc_id = str(incident.get("incident_id") or "")
    gen_at = _parse_dt(str(incident.get("generated_at") or "")) or _parse_dt(
        str((incident.get("correlation_window") or {}).get("end") or "")
    )
    ent = incident.get("entity") or {}
    risk = incident.get("risk_assessment") or {}
    risk_score = int(risk.get("risk_score") or 0)
    fidelity = max(0.0, min(1.0, risk_score / 100.0))

    mitre = _mitre_techniques_compact(incident)
    primary_mitre_id = mitre[0]["id"] if mitre else ""
    primary_tactic = mitre[0].get("tactic") if mitre else ""

    pb_row = (playbooks_by_id or {}).get(inc_id) or {}
    soc_row = (soc_by_id or {}).get(inc_id) or {}
    pb_steps = _normalize_playbook_steps(pb_row.get("steps"))
    if not pb_steps:
        pb_steps = _normalize_playbook_steps(((soc_row.get("response") if isinstance(soc_row, dict) else {}) or {}).get("steps"))
    playbook_brief = [str(s.get("title") or "").strip() for s in pb_steps[:6] if str(s.get("title") or "").strip()]

    return {
        "id": inc_id,
        "type": _pick_attack_type(incident),
        "entity": str(ent.get("user_id") or ent.get("asset_id") or ent.get("device_id") or ent.get("entity_key") or "unknown"),
        "sourceIp": str(ent.get("src_ip") or ""),
        "fidelityScore": float(fidelity),
        "severity": _normalize_severity_from_risk_level(str(risk.get("risk_level") or "")),
        "status": "investigating",
        "mitreTactic": str(primary_tactic or ""),
        "mitreId": str(primary_mitre_id or ""),
        "detectedAt": _ago_label(gen_at),
        "detectedAtTs": gen_at.isoformat() if gen_at else "",
        "summary": _short_narrative_fallback(incident),
        "killChainStage": min(6, max(1, int((risk.get("components") or {}).get("path_length") or 1))),
        "entities": [
            x
            for x in [
                ent.get("user_id"),
                ent.get("asset_id"),
                ent.get("device_id"),
                ent.get("src_ip"),
            ]
            if x
        ],
        "playbookGenerated": True,
        "playbookBrief": playbook_brief,
        "fidelityFactors": _fidelity_factors_from_components(incident),
    }


@router.get("/correlated-incidents")
def get_correlated_incidents(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    recent_only: bool = Query(False),
):
    incidents, _ = _load_correlated()
    playbooks_by_id = _load_playbooks_by_incident_id()
    soc_by_id = _load_soc_results_by_incident_id()

    # Sort newest first by generated_at/correlation end.
    def _sort_key(inc: Dict[str, Any]) -> float:
        dt = _parse_dt(str(inc.get("generated_at") or "")) or _parse_dt(
            str((inc.get("correlation_window") or {}).get("end") or "")
        )
        return dt.timestamp() if dt else 0.0

    incidents_sorted = sorted([i for i in incidents if isinstance(i, dict)], key=_sort_key, reverse=True)
    if recent_only:
        incidents_sorted = incidents_sorted[:5]

    page = incidents_sorted[offset : offset + limit]
    shaped = [_build_incident_list_item(i, playbooks_by_id=playbooks_by_id, soc_by_id=soc_by_id) for i in page]
    return {"total": len(incidents_sorted), "incidents": shaped}


@router.get("/correlated-incidents/{incident_id}")
def get_correlated_incident_detail(incident_id: str):
    _, by_id = _load_correlated()
    inc = by_id.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    ent = inc.get("entity") or {}
    risk = inc.get("risk_assessment") or {}
    risk_score = int(risk.get("risk_score") or 0)
    fidelity = max(0.0, min(1.0, risk_score / 100.0))

    soc_by_id = _load_soc_results_by_incident_id()
    soc_item = soc_by_id.get(incident_id) or {}
    soc_attack = soc_item.get("attack_analysis") if isinstance(soc_item, dict) else {}
    attack_chain = soc_attack.get("attack_chain") if isinstance(soc_attack, dict) else []
    timeline: List[Dict[str, Any]] = []

    if isinstance(attack_chain, list) and attack_chain:
        for idx, stage_item in enumerate(attack_chain, start=1):
            stage_key = str((stage_item or {}).get("stage") or "stage")
            stage_name = _stage_to_title(stage_key)
            timeline.append(
                {
                    "id": f"s{idx}",
                    "timestamp": f"Stage {idx}",
                    "eventType": stage_name,
                    "description": _stage_oneliner(stage_key),
                    "entity": str(ent.get("asset_id") or ent.get("device_id") or ent.get("user_id") or "entity"),
                    "severity": _normalize_severity_from_risk_level(str((soc_item.get("threat_analysis") or {}).get("severity") or risk.get("risk_level") or "")),
                }
            )
    else:
        events = (inc.get("attack_graph") or {}).get("events") or []
        if not isinstance(events, list):
            events = []

        def _ev_key(ev: Dict[str, Any]) -> str:
            return str(ev.get("timestamp") or "")

        events_sorted = sorted([e for e in events if isinstance(e, dict)], key=_ev_key)
        for idx, ev in enumerate(events_sorted[:80], start=1):
            ts = str(ev.get("timestamp") or "")
            dt = _parse_dt(ts)
            timeline.append(
                {
                    "id": f"t{idx}",
                    "timestamp": dt.strftime("%H:%M:%S") if dt else ts[-8:] if len(ts) >= 8 else ts,
                    "eventType": str(ev.get("raw_event_type") or ev.get("event_code") or "event"),
                    "description": str(ev.get("event_code") or ev.get("raw_event_type") or "event"),
                    "entity": str(ent.get("asset_id") or ent.get("device_id") or ent.get("user_id") or "entity"),
                    "severity": _normalize_severity_from_risk_level(str(ev.get("severity") or "")),
                }
            )

    mitre_techniques = _mitre_techniques_compact(inc)
    gen_at = _parse_dt(str(inc.get("generated_at") or "")) or _parse_dt(str((inc.get("correlation_window") or {}).get("end") or ""))

    graph_nodes = []
    graph_edges = []
    node_id = 0
    def _add_node(label: str, ntype: str, compromised: bool) -> str:
        nonlocal node_id
        node_id += 1
        nid = f"n{node_id}"
        graph_nodes.append(
            {
                "id": nid,
                "type": ntype,
                "label": label,
                "compromised": compromised,
                "suspected": (not compromised) and (fidelity >= 0.6),
                "position": {"x": 280, "y": (node_id - 1) * 120},
            }
        )
        return nid

    src_ip = str(ent.get("src_ip") or "")
    user = str(ent.get("user_id") or "")
    asset = str(ent.get("asset_id") or ent.get("device_id") or "")

    # Build attack graph from the same stage timeline used in chronology.
    stage_nodes = [t for t in timeline if str(t.get("id", "")).startswith("s")]
    if stage_nodes:
        graph_nodes = []
        graph_edges = []

        # Entry/context entities.
        entry_node_id = ""
        if src_ip:
            entry_node_id = _add_node(src_ip, "ip", compromised=True)
        if user:
            n_user = _add_node(user, "user", compromised=True)
            if entry_node_id:
                graph_edges.append({"id": f"e{len(graph_edges)+1}", "source": entry_node_id, "target": n_user, "label": "identity"})
            entry_node_id = n_user

        # Stage chain.
        prev = entry_node_id
        for idx, stage_item in enumerate(stage_nodes, start=1):
            label = str(stage_item.get("eventType") or f"Stage {idx}")
            stage_node_id = _add_node(label, "server", compromised=True)
            if prev:
                graph_edges.append(
                    {
                        "id": f"e{len(graph_edges)+1}",
                        "source": prev,
                        "target": stage_node_id,
                        "label": "progression",
                    }
                )
            prev = stage_node_id

        if asset:
            n_asset = _add_node(asset, "server", compromised=(fidelity >= 0.75))
            if prev:
                graph_edges.append({"id": f"e{len(graph_edges)+1}", "source": prev, "target": n_asset, "label": "target"})
    else:
        # Fallback when no stage sequence is available.
        n_ip = _add_node(src_ip or "source", "ip", compromised=True)
        n_user = _add_node(user or "user", "user", compromised=True)
        graph_edges.append({"id": "e1", "source": n_ip, "target": n_user, "label": "auth"})
        if asset:
            n_asset = _add_node(asset, "server", compromised=(fidelity >= 0.75))
            graph_edges.append({"id": "e2", "source": n_user, "target": n_asset, "label": "activity"})

    playbooks_by_id = _load_playbooks_by_incident_id()
    pb = playbooks_by_id.get(incident_id) or {}
    pb_steps_check = _normalize_playbook_steps(pb.get("steps"))
    needs_regen = (
        (not pb)
        or (not pb_steps_check)
        or (len(pb_steps_check) < 6)
        or any("llm unavailable" in str(s.get("title") or "").lower() for s in pb_steps_check)
        or (not str(pb.get("playbook_report") or "").strip())
    )
    if needs_regen:
        try:
            generated = _generate_playbook_with_mistral(inc, soc_item if isinstance(soc_item, dict) else {}, attack_chain if isinstance(attack_chain, list) else [])
            playbooks_by_id = _persist_playbook_record(incident_id, generated)
            pb = playbooks_by_id.get(incident_id) or generated
        except Exception:
            # Keep dynamic fallback from SOC response if LLM generation fails.
            pb = pb or {}
    soc_response = soc_item.get("response") if isinstance(soc_item, dict) else {}

    pb_title = str(
        pb.get("playbook_title")
        or _stage_to_title(str((soc_response or {}).get("playbook") or ""))
        or "SOC Incident Response Playbook"
    )
    pb_steps = _normalize_playbook_steps(pb.get("steps"))
    if not pb_steps:
        pb_steps = _normalize_playbook_steps((soc_response or {}).get("steps"))
    pb_report = str(pb.get("playbook_report") or "")
    kill_chain_stages = (
        [_stage_to_title(str((s or {}).get("stage") or "")) for s in attack_chain if isinstance(s, dict) and (s.get("stage") or "")]
        if isinstance(attack_chain, list) and attack_chain
        else [
            "Initial Access",
            "Execution",
            "Persistence",
            "Privilege Escalation",
            "Lateral Movement",
            "Exfiltration",
        ]
    )
    kill_chain_stage_index = min(
        len(kill_chain_stages),
        max(1, len(timeline) if timeline else int((risk.get("components") or {}).get("path_length") or 1)),
    )

    return {
        "id": str(inc.get("incident_id") or ""),
        "type": _pick_attack_type(inc),
        "severity": _normalize_severity_from_risk_level(str(risk.get("risk_level") or "")),
        "status": "investigating",
        "detectedAt": gen_at.isoformat() if gen_at else "",
        "detectedAgo": _ago_label(gen_at),
        "fidelityScore": float(fidelity),
        "narrative": _short_narrative_fallback(inc),
        "killChainStage": kill_chain_stage_index,
        "killChainStages": kill_chain_stages,
        "timeline": timeline,
        "entities": {
            "users": [user] if user else [],
            "servers": [asset] if asset else [],
            "ips": [src_ip] if src_ip else [],
        },
        "fidelityFactors": _fidelity_factors_from_components(inc),
        "mitreTechniques": mitre_techniques,
        "agentScores": {
            "risk": float(min(1.0, max(0.0, (risk_score / 100.0)))),
            "compliance": float(min(1.0, max(0.0, ((risk.get("components") or {}).get("tactic_severity") or 0.0) / 20.0))),
            "businessImpact": float(min(1.0, max(0.0, ((risk.get("components") or {}).get("entity_context") or 0.0) / 20.0))),
            "finalDecision": str(risk.get("risk_level") or "MEDIUM"),
        },
        "playbook": {
            "title": pb_title,
            "generatedAt": gen_at.strftime("%H:%M:%S") if gen_at else "",
            "steps": pb_steps,
            "report": pb_report,
        },
        "graphNodes": graph_nodes,
        "graphEdges": graph_edges,
    }


@router.get("/correlated-incidents/{incident_id}/narrative")
def get_correlated_incident_narrative(incident_id: str):
    _, by_id = _load_correlated()
    inc = by_id.get(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # LLM prompt should be stable, but content must be dynamic from files.
    ent = inc.get("entity") or {}
    risk = inc.get("risk_assessment") or {}
    mitre = _mitre_techniques_compact(inc)
    events = (inc.get("attack_graph") or {}).get("events") or []
    if not isinstance(events, list):
        events = []
    events_sorted = sorted([e for e in events if isinstance(e, dict)], key=lambda e: str(e.get("timestamp") or ""))
    last_events = events_sorted[-8:]

    prompt = f"""
You are a SOC incident narrator. Write a SHORT incident narrative (2-3 sentences, max 320 characters).
Use ONLY the provided incident facts. No speculation, no extra details.

INCIDENT_ID: {inc.get("incident_id")}
ENTITY: user_id={ent.get("user_id")} asset_id={ent.get("asset_id")} device_id={ent.get("device_id")} src_ip={ent.get("src_ip")}
RISK: score={risk.get("risk_score")} level={risk.get("risk_level")}
MITRE_TECHNIQUES: {", ".join([t.get("id","") for t in mitre if t.get("id")])}
CHRONOLOGY_EVENTS (last {len(last_events)}):
{json.dumps([{"ts": e.get("timestamp"), "code": e.get("event_code"), "src": e.get("source_system"), "sev": e.get("severity"), "anom": e.get("anomaly_score")} for e in last_events], ensure_ascii=False)}

Return ONLY the narrative text.
""".strip()

    loader = ModelLoader(model_name="mistral")
    text = (loader.generate(prompt) or "").strip()
    if not text or text.lower().startswith("llm unavailable"):
        text = _short_narrative_fallback(inc)
    return {"incident_id": incident_id, "model": "mistral", "narrative": text}


@router.get("/attack-category-breakdown")
def attack_category_breakdown():
    incidents, _ = _load_correlated()
    counts: Dict[str, int] = {}
    for inc in incidents:
        if not isinstance(inc, dict):
            continue
        category = _pick_attack_type(inc)
        if not category:
            category = "Unknown"
        counts[category] = counts.get(category, 0) + 1
    # Return sorted for stable UI.
    items = [{"category": k, "count": v} for k, v in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)]
    total = sum(counts.values())
    return {"total": total, "breakdown": items}


@router.get("/incidents")
def get_incidents():
    data = load_json("data/incident_records/incidents.json") or []
    return {"total": len(data), "incidents": data}


@router.post("/build-incidents")
def build_incidents():
    """
    Runs full detection + correlation.
    """

    raw = load_json("data/raw_logs/fake_logs.json") or []

    ingestion = IngestionService()
    normalized = ingestion.ingest(raw)

    detector = DetectionService()
    detected = detector.run(normalized)

    correlation = CorrelationService()
    incidents = correlation.build_incidents(detected)

    save_json("data/incident_records/incidents.json", incidents)

    return {"incidents": len(incidents)}