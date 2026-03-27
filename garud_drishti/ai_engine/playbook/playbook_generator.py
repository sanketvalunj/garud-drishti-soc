from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from garud_drishti.ai_engine.llm.model_loader import ModelLoader


def _parse_ts(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    # Anomaly timestamps sometimes look like: "2026-03-20 09:18:02"
    # Normalized timestamps look like: "2026-03-20T01:08:27"
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return None


def _extract_first_json_object(text: str) -> str:
    """
    Extract the first {...} block from a string.
    Helps when an offline LLM returns extra text or code fences.
    """
    # Strip common markdown fences.
    text = text.strip()
    text = re.sub(r"^```json\\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\\s*", "", text)
    text = re.sub(r"```\\s*$", "", text)

    # Try to find the first JSON object.
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start : end + 1]
    raise ValueError("No JSON object found in model output.")


@dataclass
class PlaybookSlices:
    anomalies: list[dict[str, Any]]
    events: list[dict[str, Any]]


class PlaybookGenerator:
    """
    Offline LLM-driven playbook generator.

    Produces:
      - playbook_report: full SOC report text (dynamic via offline LLM)
      - steps: structured automation steps (for AutomationEngine)
      - automation_candidates: subset of actions
    """

    def __init__(
        self,
        model_name: str = "mistral",
        temperature: float = 0.2,
        max_anomalies: int = 8,
        max_events: int = 10,
        prompt_template_path: str | Path = "garud_drishti/ai_engine/llm/prompt_templates/playbook_template.txt",
    ) -> None:
        self.max_anomalies = int(max_anomalies)
        self.max_events = int(max_events)
        self.temperature = float(temperature)

        self.prompt_template_path = Path(prompt_template_path)
        self.prompt_template = self.prompt_template_path.read_text(encoding="utf-8")

        # ModelLoader loads Ollama only if `ollama` is installed.
        self.model_loader = ModelLoader(model_name=model_name)

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

        # If the window filters too aggressively, fall back to latest samples.
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

        incident_json = {
            "incident_id": incident.get("incident_id"),
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
            "attack_story": incident.get("attack_story"),
            "attack_summary": incident.get("attack_summary", {}),
            "mitre_attack": incident.get("mitre_attack", {}),
        }

        # Reduce noise; keep only relevant per-slice fields.
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
        prompt = prompt.replace("{incident_json}", json.dumps(incident_json, indent=2))
        prompt = prompt.replace("{threat_analysis_json}", json.dumps(threat_analysis or {}, indent=2))
        prompt = prompt.replace("{anomalies_json}", json.dumps(anomalies_json, indent=2))
        prompt = prompt.replace("{events_json}", json.dumps(events_json, indent=2))
        return prompt

    def _fallback_report(
        self,
        incident: dict[str, Any],
        threat_analysis: dict[str, Any],
    ) -> dict[str, Any]:
        entity = incident.get("entity", {}) if isinstance(incident.get("entity", {}), dict) else {}
        risk = incident.get("risk_assessment", {}) if isinstance(incident.get("risk_assessment", {}), dict) else {}
        risk_level = risk.get("risk_level") or threat_analysis.get("severity") or "LOW"

        return {
            "playbook_title": f"SOC Incident Response Playbook: {incident.get('incident_id', 'INC')}",
            "severity_label": str(risk_level),
            "reason": "LLM unavailable; generated a conservative playbook outline using incident risk context.",
            "key_indicators": [
                f"Source IP: {entity.get('src_ip', 'unknown')}",
                f"Account/Entity: {entity.get('user_id') or entity.get('entity_key') or 'unknown'}",
                f"Risk score: {risk.get('risk_score', threat_analysis.get('risk_score', 0))}",
            ],
            "automation_candidates": [],
            "steps": [],
            "playbook_report": (
                f"SOC Incident Response Playbook: {incident.get('incident_id', 'INC')}\n\n"
                f"Detection of suspicious activity for incident {incident.get('incident_id', 'INC')}.\n\n"
                f"RISK ASSESSMENT\nSeverity: {risk_level}\nReason: Conservative outline due to offline LLM unavailability.\n\n"
                "KEY INDICATORS\n- unknown\n\n"
                "INVESTIGATION STEPS\n1. Review relevant logs for the correlated window.\n\n"
                "CONTAINMENT ACTIONS\n- Apply defensive controls based on the incident scope.\n\n"
                "ERADICATION ACTIONS\n- Remove/mitigate suspected persistence vectors.\n\n"
                "RECOVERY STEPS\n- Validate integrity and restore normal operations.\n\n"
                "AUTOMATION OPPORTUNITIES\n- Consider SOAR automation for defensive steps.\n\n"
                "ANALYST NOTES\nTime-to-Contain (MTTC) should be tracked."
            ),
        }

    def generate_for_incident(
        self,
        incident: dict[str, Any],
        threat_analysis: dict[str, Any],
        anomalies_for_src_ip: list[dict[str, Any]],
        events_for_src_ip: list[dict[str, Any]],
    ) -> dict[str, Any]:
        slices = self._select_slices(incident, anomalies_for_src_ip, events_for_src_ip)

        incident_has_any_context = bool(slices.anomalies) or bool(slices.events)
        if not incident_has_any_context:
            return self._fallback_report(incident, threat_analysis)

        prompt = self._build_prompt(incident, threat_analysis, slices)

        try:
            llm_raw = self.model_loader.generate(prompt)
            json_payload_str = _extract_first_json_object(llm_raw)
            payload = json.loads(json_payload_str)
            if not isinstance(payload, dict):
                raise ValueError("LLM JSON payload is not an object.")
            # Normalize expected keys if LLM returns slightly different shapes.
            payload.setdefault("automation_candidates", [])
            payload.setdefault("steps", [])
            payload.setdefault("playbook_report", "")
            return payload
        except Exception:
            return self._fallback_report(incident, threat_analysis)

    # Backwards-compatible alias used by older code paths.
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
