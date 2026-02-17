import os
import json
from typing import Dict, Any

from garud_drishti.ai_engine.llm.ollama_client import run_local_llm


# ---------------------------------------------------
# Template path
# ---------------------------------------------------
TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "llm",
    "prompt_templates",
    "playbook_template.txt"
)


# ---------------------------------------------------
# Template loader
# ---------------------------------------------------
def load_template() -> str:
    with open(TEMPLATE_PATH, "r") as f:
        return f.read()


# ---------------------------------------------------
# Prompt builder
# ---------------------------------------------------
def build_prompt(incident: Dict[str, Any], risk: Dict[str, Any]) -> str:
    """
    Build prompt using incident + reasoning output.
    """

    template = load_template()

    analysis_json = {
        "incident_id": incident.get("incident_id"),
        "summary": incident.get("summary", ""),
        "severity": risk.get("severity", "Medium"),
        "fidelity_score": incident.get("fidelity_score", 0),
        "anomaly_score": incident.get("anomaly_score", 0),
        "affected_assets": risk.get("reasoning", {}).get("affected_assets", []),
        "mitre": risk.get("reasoning", {}).get("mitre_techniques", []),
        "timeline_events": risk.get("reasoning", {}).get("timeline_events", 0),
    }

    return template.format(
        analysis_json=json.dumps(analysis_json, indent=2)
    )


# ---------------------------------------------------
# LLM JSON parser (safe)
# ---------------------------------------------------
def try_parse_json(text: str):
    """
    Try extracting JSON from LLM response safely.
    """

    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        return json.loads(text[start:end])
    except Exception:
        return None


# ---------------------------------------------------
# Fallback rule-based playbook
# ---------------------------------------------------
def fallback_playbook(incident: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safe fallback if LLM fails or returns invalid output.
    """

    return {
        "incident_type": incident.get("summary", "Unknown incident"),
        "risk_level": "Medium",
        "playbook_steps": [
            {
                "step": 1,
                "action": "Review authentication logs for suspicious access",
                "purpose": "Validate whether the alert is a true compromise"
            },
            {
                "step": 2,
                "action": "Inspect affected endpoint processes",
                "purpose": "Check for malicious execution or persistence"
            },
            {
                "step": 3,
                "action": "Isolate the affected system if compromise suspected",
                "purpose": "Prevent lateral movement"
            },
            {
                "step": 4,
                "action": "Block suspicious IP or account activity",
                "purpose": "Contain attacker access"
            },
            {
                "step": 5,
                "action": "Escalate incident to SOC lead",
                "purpose": "Ensure senior review and response coordination"
            }
        ],
        "automation_candidates": [
            "lock_account",
            "isolate_endpoint",
            "block_ip"
        ]
    }


# ---------------------------------------------------
# MAIN GENERATOR CLASS
# ---------------------------------------------------
class PlaybookGenerator:
    """
    Central playbook generation engine.

    Flow:
    incident + reasoning -> prompt -> LLM -> parse JSON -> fallback if needed
    """

    def __init__(self):
        pass

    def generate(self, incident: Dict[str, Any], risk: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate playbook using local LLM with safe fallback.
        """

        prompt = build_prompt(incident, risk)

        try:
            response = run_local_llm(prompt)
        except Exception:
            return fallback_playbook(incident)

        parsed = try_parse_json(response)

        if not parsed:
            return fallback_playbook(incident)

        # Ensure required fields exist
        parsed.setdefault("incident_type", incident.get("summary", "Unknown"))
        parsed.setdefault("risk_level", risk.get("severity", "Medium"))
        parsed.setdefault("playbook_steps", [])
        parsed.setdefault("automation_candidates", [])

        return parsed