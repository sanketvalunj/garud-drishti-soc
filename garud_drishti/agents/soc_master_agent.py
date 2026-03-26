import json
import uuid
import time
import logging

from garud_drishti.ai_engine.reasoning.signal_context import build_soc_context
from garud_drishti.ai_engine.reasoning.threat_reasoner import ThreatReasoner
from garud_drishti.ai_engine.reasoning.attack_analyzer import AttackAnalyzer
from garud_drishti.ai_engine.orchestration.agent_orchestrator import AgentOrchestrator
from garud_drishti.ai_engine.orchestration.policy_guard import PolicyGuard
from garud_drishti.ai_engine.reasoning.decision_explainer import DecisionExplainer
from garud_drishti.ai_engine.reasoning.confidence_calibrator import ConfidenceCalibrator
from garud_drishti.ai_engine.playbook.playbook_generator import PlaybookGenerator
from garud_drishti.ai_engine.playbook.playbook_selector import PlaybookSelector
from garud_drishti.ai_engine.orchestration.automation_engine import AutomationEngine
from garud_drishti.ai_engine.orchestration.decision_logger import DecisionLogger

logger = logging.getLogger("SOCMasterAgent")
logger.setLevel(logging.INFO)

if not logger.handlers:
    fh = logging.FileHandler("soc_pipeline.log")
    fh.setFormatter(logging.Formatter("%(asctime)s - [%(levelname)s] - %(message)s"))
    logger.addHandler(fh)


# ---------------------------------------------------------------------------
# Schema validation helper
# ---------------------------------------------------------------------------

def validate(data: dict, schema: dict, module: str) -> None:
    """
    Enforces strict schema validation pipeline-wide.

    Args:
        data: Output dict from a pipeline stage.
        schema: Mapping of required keys to their expected types.
        module: Human-readable stage name used in error messages.

    Raises:
        ValueError: If data is empty.
        KeyError: If a required key is missing.
        TypeError: If a value has the wrong type.
    """
    if not data:
        raise ValueError(f"Empty data output from {module}")
    for key, expected_type in schema.items():
        if key not in data:
            raise KeyError(f"Missing required key '{key}' from {module}")
        if not isinstance(data[key], expected_type):
            raise TypeError(
                f"Invalid type for '{key}' in {module}. "
                f"Expected {expected_type.__name__}, got {type(data[key]).__name__}"
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
        self.playbook_selector = PlaybookSelector()
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

        if not incidents:
            logger.info(f"[{trace_id}] [PIPELINE_END] No incidents detected")
            return {"status": "no_incidents", "data": None}

        results = []
        for incident in incidents:
            result = self._process_single_incident(incident, anomalies, trace_id)
            results.append(result)

        pipeline_latency = round(time.time() - pipeline_start, 4)
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
        self, incident: dict, anomalies: list, trace_id: str
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
            threat_analysis = self.threat_reasoner.analyze(incident, anomalies)
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
            playbook_name = self.playbook_selector.select(threat_type)
            response = self.playbook_generator.generate(playbook_name)
            validate(response, {"playbook": str, "steps": list}, "PlaybookGenerator")
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
