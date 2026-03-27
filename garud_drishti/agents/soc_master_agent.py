import json
import uuid
import time
import logging
from pathlib import Path

from garud_drishti.ai_engine.reasoning.signal_context import build_soc_context
from garud_drishti.ai_engine.reasoning.threat_reasoner import ThreatReasoner
from garud_drishti.ai_engine.reasoning.attack_analyzer import AttackAnalyzer
from garud_drishti.ai_engine.orchestration.agent_orchestrator import AgentOrchestrator
from garud_drishti.ai_engine.orchestration.policy_guard import PolicyGuard
from garud_drishti.ai_engine.reasoning.decision_explainer import DecisionExplainer
from garud_drishti.ai_engine.reasoning.confidence_calibrator import ConfidenceCalibrator
from garud_drishti.ai_engine.playbook.playbook_generator import PlaybookGenerator
from garud_drishti.ai_engine.orchestration.automation_engine import AutomationEngine
from garud_drishti.ai_engine.orchestration.decision_logger import DecisionLogger
logger = logging.getLogger(__name__)
if not logger.handlers:
    fh = logging.FileHandler("soc_pipeline.log")
    fh.setFormatter(logging.Formatter("%(asctime)s - [%(levelname)s] - %(message)s"))
    logger.addHandler(fh)
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# Schema validation helper
# ---------------------------------------------------------------------------
def validate(data: dict, schema: dict, module: str) -> None:
    """
    Validates a pipeline stage output has required keys and expected types.
    """
    if not data or not isinstance(data, dict):
        raise ValueError(f"Empty data output from {module}")

    for key, expected_type in schema.items():
        if key not in data:
            raise KeyError(f"Missing required key '{key}' from {module}")

        value = data[key]
        if expected_type is int and isinstance(value, float):
            # Allow float values that are effectively integers.
            if value.is_integer():
                continue

        if not isinstance(value, expected_type):
            raise TypeError(
                f"Invalid type for '{key}' in {module}. "
                f"Expected {expected_type.__name__}, got {type(value).__name__}"
            )


# ---------------------------------------------------------------------------
# Priority classifier
# ---------------------------------------------------------------------------

def _classify_priority(risk_score: int) -> str:
    """Return P1 / P2 / P3 based on numeric risk score."""
    if risk_score > 80:
        return "P1"
    if risk_score > 50:
        return "P2"
    return "P3"


# ---------------------------------------------------------------------------
# SOCMasterAgent
# ---------------------------------------------------------------------------

class SOCMasterAgent:
    """
    Orchestrates the full multi-stage SOC AI pipeline.

    Pipeline stages
    ---------------
    1.  ThreatReasoner       – classify threat type, risk score, severity
    2.  AttackAnalyzer       – build attack chain and depth
    3.  AgentOrchestrator    – multi-agent voting engine (risk / compliance / impact)
    4.  PolicyGuard          – governance / policy validation
    5.  DecisionExplainer    – human-readable explanation
    6.  ConfidenceCalibrator – calibrate confidence score
    7.  PlaybookSelector     – choose the right playbook
    8.  PlaybookGenerator    – generate step-by-step response
    9.  AutomationEngine     – conditional simulation (block / isolate / critical only)
    10. DecisionLogger       – persist decision with feedback loop
    """

    def __init__(self) -> None:
        self.threat_reasoner = ThreatReasoner()
        self.attack_analyzer = AttackAnalyzer()
        self.orchestrator = AgentOrchestrator()
        self.policy_guard = PolicyGuard()
        self.decision_explainer = DecisionExplainer()
        self.confidence_calibrator = ConfidenceCalibrator()
        self.playbook_generator = PlaybookGenerator()
        self.automation_engine = AutomationEngine()
        self.decision_logger = DecisionLogger()

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def run(self) -> dict:
        """
        Build SOC context and process every detected incident.

        Returns:
            dict: ``{"status": "success"|"no_incidents"|"error", "data": [...]}``
        """
        trace_id = str(uuid.uuid4())
        pipeline_start = time.time()
        logger.info(f"[{trace_id}] [PIPELINE_START] Initializing SOC Pipeline")

        context = build_soc_context()
        incidents = context.get("incidents", [])
        anomalies = context.get("anomalies", [])
        events = context.get("events", [])

        if not incidents:
            logger.info(f"[{trace_id}] [PIPELINE_END] No incidents detected")
            return {"status": "no_incidents", "data": None}

        results = []
        total_incidents = len(incidents)
        # Index events/anomalies by source IP for fast, per-incident slicing.
        anomalies_by_src_ip: dict[str, list] = {}
        for a in anomalies:
            src_ip = a.get("src_ip")
            if not src_ip:
                continue
            anomalies_by_src_ip.setdefault(str(src_ip), []).append(a)

        events_by_src_ip: dict[str, list] = {}
        for e in events:
            src_ip = e.get("src_ip")
            if not src_ip:
                continue
            events_by_src_ip.setdefault(str(src_ip), []).append(e)

        for i, incident in enumerate(incidents, start=1):
            incident_id = incident.get("incident_id", "INC-000")
            print(f"[SOC AI] ({i}/{total_incidents}) Processing incident_id={incident_id}", flush=True)
            entity = incident.get("entity", {}) if isinstance(incident.get("entity", {}), dict) else {}
            src_ip = entity.get("src_ip") or incident.get("src_ip") or ""
            src_ip = str(src_ip) if src_ip else ""
            anomalies_for_incident = anomalies_by_src_ip.get(src_ip, [])
            events_for_incident = events_by_src_ip.get(src_ip, [])
            result = self._process_single_incident(
                incident=incident,
                anomalies_for_src_ip=anomalies_for_incident,
                events_for_src_ip=events_for_incident,
                trace_id=trace_id,
            )
            results.append(result)

        pipeline_latency = round(time.time() - pipeline_start, 4)

        # Write a small summary for downstream AI/UI consumers.
        try:
            output_path = (
                Path(__file__).resolve().parent.parent
                / "data"
                / "ai_engine"
                / "ai_outputs.json"
            )
            output_path.parent.mkdir(parents=True, exist_ok=True)
            ai_outputs = [
                {
                    "incident_id": r.get("incident_id"),
                    "threat_type": (r.get("threat_analysis") or {}).get("threat_type"),
                    "risk_score": (r.get("threat_analysis") or {}).get("risk_score"),
                    "severity": (r.get("threat_analysis") or {}).get("severity"),
                }
                for r in results
                if r.get("status") == "success"
            ]
            output_path.write_text(json.dumps(ai_outputs, indent=2), encoding="utf-8")
        except Exception:
            # Best-effort output; do not fail the pipeline.
            pass

        # Also persist playbook reports generated via offline LLM.
        try:
            playbooks_path = (
                Path(__file__).resolve().parent.parent
                / "data"
                / "ai_engine"
                / "playbooks.json"
            )
            playbooks_path.parent.mkdir(parents=True, exist_ok=True)
            playbooks = []
            for r in results:
                if r.get("status") != "success":
                    continue
                response = r.get("response", {}) if isinstance(r.get("response", {}), dict) else {}
                if not response:
                    continue
                playbooks.append(
                    {
                        "incident_id": r.get("incident_id"),
                        "playbook_title": response.get("playbook_title"),
                        "severity_label": response.get("severity_label"),
                        "reason": response.get("reason"),
                        "key_indicators": response.get("key_indicators", []),
                        "automation_candidates": response.get("automation_candidates", []),
                        "steps": response.get("steps", []),
                        "playbook_report": response.get("playbook_report"),
                    }
                )
            playbooks_path.write_text(json.dumps(playbooks, indent=2), encoding="utf-8")
        except Exception:
            pass

        logger.info(
            f"[{trace_id}] [PIPELINE_COMPLETED] "
            f"{len(incidents)} incident(s) processed in {pipeline_latency}s"
        )

        return {
            "status": "success",
            "trace_id": trace_id,
            "pipeline_latency_seconds": pipeline_latency,
            "incidents_processed": len(incidents),
            "data": results,
        }

    # ------------------------------------------------------------------
    # Per-incident processing
    # ------------------------------------------------------------------

    def _process_single_incident(
        self,
        incident: dict,
        anomalies_for_src_ip: list,
        events_for_src_ip: list,
        trace_id: str,
    ) -> dict:
        """
        Run the full 10-stage pipeline for a single incident.

        Args:
            incident: Normalised incident dict from the SOC context.
            anomalies: List of anomaly dicts from the SOC context.
            trace_id: Shared trace identifier for the parent run.

        Returns:
            dict: Per-incident result payload including latency and priority,
                  or a structured error dict if a stage fails.
        """
        incident_id = incident.get("incident_id", "INC-000")
        stage_start = time.time()
        logger.info(f"[{trace_id}] [{incident_id}] Processing incident")

        # ── Stage 1: Threat Reasoner ──────────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [THREAT_REASONER] Starting")
            threat_analysis = self.threat_reasoner.analyze(incident, anomalies_for_src_ip)
            validate(
                threat_analysis,
                {"threat_type": str, "risk_score": int, "severity": str},
                "ThreatReasoner",
            )
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] ThreatReasoner failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "threat_reasoner", "detail": str(e)}

        threat_type = threat_analysis["threat_type"]
        risk_score = threat_analysis["risk_score"]
        severity = threat_analysis.get("severity", "low")

        # ── Stage 2: Attack Analyzer ──────────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [ATTACK_ANALYZER] Starting")
            attack_analysis = self.attack_analyzer.analyze(incident)
            validate(
                attack_analysis,
                {"attack_chain": list, "attack_depth": int},
                "AttackAnalyzer",
            )
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] AttackAnalyzer failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "attack_analyzer", "detail": str(e)}

        attack_chain = attack_analysis["attack_chain"]
        entity_context = {
            "user": incident.get("user", "unknown"),
            "asset": incident.get("asset", "unknown"),
            "source_ip": incident.get("source_ip", "unknown"),
        }

        # ── Stage 3: Agent Orchestrator ───────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [AGENT_ORCHESTRATOR] Starting")
            orchestration_result = self.orchestrator.run({
                "incident": incident,
                "threat_analysis": threat_analysis,
                "attack_analysis": attack_analysis,
            })
            validate(
                orchestration_result,
                {"decision": dict, "agent_memory": dict},
                "AgentOrchestrator",
            )
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] AgentOrchestrator failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "agent_orchestrator", "detail": str(e)}

        decision = orchestration_result["decision"]
        memory = orchestration_result["agent_memory"]

        # ── Stage 4: Policy Guard ─────────────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [POLICY_GUARD] Validating")
            decision = self.policy_guard.validate(decision)
            validate(decision, {"decision": str}, "PolicyGuard")
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] PolicyGuard failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "policy_guard", "detail": str(e)}

        # ── Stage 5: Decision Explainer ───────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [DECISION_EXPLAINER] Generating")
            explanation = self.decision_explainer.explain(
                incident_id=incident_id,
                threat_type=threat_type,
                attack_chain=attack_chain,
                entity_context=entity_context,
                risk_score=risk_score,
            )
            validate(explanation, {"incident": str, "summary_lines": list}, "DecisionExplainer")
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] DecisionExplainer failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "decision_explainer", "detail": str(e)}

        # ── Stage 6: Confidence Calibrator ────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [CONFIDENCE_CALIBRATOR] Calibrating")
            confidence = self.confidence_calibrator.calibrate(
                memory.get("risk", {}),
                memory.get("compliance", {}),
                memory.get("impact", {}),
            )
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] ConfidenceCalibrator failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "confidence_calibrator", "detail": str(e)}

        # ── Stage 7 + 8: Playbook Selector + Generator ────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [PLAYBOOK] Selecting and generating")
            response = self.playbook_generator.generate_for_incident(
                incident=incident,
                threat_analysis=threat_analysis,
                anomalies_for_src_ip=anomalies_for_src_ip,
                events_for_src_ip=events_for_src_ip,
            )
            validate(
                response,
                {
                    "playbook_title": str,
                    "severity_label": str,
                    "reason": str,
                    "key_indicators": list,
                    "automation_candidates": list,
                    "steps": list,
                    "playbook_report": str,
                },
                "PlaybookGenerator",
            )
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] Playbook stage failed: {e}")
            return {"status": "error", "incident_id": incident_id, "stage": "playbook", "detail": str(e)}

        # ── Stage 9: Automation Engine (guarded) ──────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [AUTOMATION_ENGINE] Evaluating")
            if decision.get("decision") in {"block", "isolate", "critical"}:
                logger.info(
                    f"[{trace_id}] [{incident_id}] [AUTOMATION_ENGINE] "
                    f"Triggering simulation for decision='{decision.get('decision')}'"
                )
                automation = self.automation_engine.simulate(response)
            else:
                logger.info(
                    f"[{trace_id}] [{incident_id}] [AUTOMATION_ENGINE] "
                    f"Skipped (decision='{decision.get('decision')}')"
                )
                automation = {"status": "skipped"}
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] AutomationEngine failed: {e}")
            automation = {"status": "error", "detail": str(e)}

        # ── Stage 10: Decision Logger ─────────────────────────────────
        try:
            logger.info(f"[{trace_id}] [{incident_id}] [DECISION_LOGGER] Logging")
            self.decision_logger.log({
                "trace_id": trace_id,
                "incident_id": incident_id,
                "threat_type": threat_type,
                "risk_score": risk_score,
                "severity": severity,
                "decision": decision,
                "confidence": confidence,
                "playbook": response.get("steps"),
                "automation_status": automation.get("status"),
                "feedback": "pending",
            })
        except Exception as e:
            logger.error(f"[{trace_id}] [{incident_id}] DecisionLogger failed: {e}")

        # ── Metrics + Priority ────────────────────────────────────────
        latency = round(time.time() - stage_start, 4)
        priority = _classify_priority(risk_score)

        logger.info(
            f"[{trace_id}] [{incident_id}] Completed | "
            f"priority={priority} risk={risk_score} latency={latency}s"
        )

        return {
            "status": "success",
            "incident_id": incident_id,
            "priority": priority,
            "latency_seconds": latency,
            "threat_analysis": threat_analysis,
            "attack_analysis": attack_analysis,
            "entity_context": entity_context,
            "orchestration": orchestration_result,
            "explanation": explanation,
            "confidence": confidence,
            "response": response,
            "automation": automation,
        }
