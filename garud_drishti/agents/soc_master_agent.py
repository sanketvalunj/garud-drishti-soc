import json
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
import logging
import uuid
import time

logger = logging.getLogger("SOCMasterAgent")
logger.setLevel(logging.INFO)
# Use a null handler or file handler to keep stdout pure JSON if requested
# For this script we will add a console handler that goes to stderr, or just a file handler
fh = logging.FileHandler("soc_pipeline.log")
fh.setFormatter(logging.Formatter('%(asctime)s - [%(levelname)s] - %(message)s'))
if not logger.handlers:
    logger.addHandler(fh)

def validate(data: dict, schema: dict, module: str):
    """Enforces strict schema validation pipeline-wide."""
    if not data:
        raise ValueError(f"Empty data output from {module}")
    for key, expected_type in schema.items():
        if key not in data:
            raise KeyError(f"Missing required key '{key}' from {module}")
        if not isinstance(data[key], expected_type):
            raise TypeError(f"Invalid type for '{key}' in {module}. Expected {expected_type.__name__}, got {type(data[key]).__name__}")

class SOCMasterAgent:
    """
    Orchestrates the Final Phase-5 AI Engine SOC pipeline.
    """
    def __init__(self):
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

    def run(self):
        trace_id = str(uuid.uuid4())
        logger.info(f"[{trace_id}] - [PIPELINE_START] - Initializing SOC Pipeline")

        # 1. Build SOC intelligence context (Layer 1)
        context = build_soc_context()

        # Pipeline Safety Guard
        incidents = context.get("incidents", [])
        if not incidents:
            logger.info(f"[{trace_id}] - [PIPELINE_END] - No incidents detected")
            return {"status": "no_incidents", "data": None}
            
        incident = incidents[0]
        anomalies = context.get("anomalies", [])

        # 2. Threat Reasoner
        logger.info(f"[{trace_id}] - [THREAT_REASONER] - Starting analysis")
        threat_analysis = self.threat_reasoner.analyze(incident, anomalies)
        validate(threat_analysis, {
            "threat_type": str,
            "risk_score": int,
            "severity": str
        }, "ThreatReasoner")
        threat_type = threat_analysis["threat_type"]
        risk_score = threat_analysis["risk_score"]
        
        # 3. Attack Analyzer
        logger.info(f"[{trace_id}] - [ATTACK_ANALYZER] - Starting analysis")
        attack_analysis = self.attack_analyzer.analyze(incident)
        validate(attack_analysis, {
            "attack_chain": list,
            "attack_depth": int
        }, "AttackAnalyzer")
        attack_chain = attack_analysis["attack_chain"]

        # Extract context
        entity_context = {
            "user": incident.get("user", "unknown"),
            "asset": incident.get("asset", "unknown"),
            "source_ip": incident.get("source_ip", "unknown")
        }

        # 4. Agent Orchestrator (Layer 2 & 3 Voting Engine)
        logger.info(f"[{trace_id}] - [RISK_AGENT] - Engaging agent orchestrator")
        orchestration_result = self.orchestrator.run(incident)
        validate(orchestration_result, {
            "decision": dict,
            "agent_memory": dict
        }, "AgentOrchestrator")
        
        decision = orchestration_result["decision"]
        memory = orchestration_result["agent_memory"]

        # 5. Policy Guard (Governance)
        logger.info(f"[{trace_id}] - [POLICY_GUARD] - Validating decision")
        decision = self.policy_guard.validate(decision)
        validate(decision, {"decision": str}, "PolicyGuard")

        # 6. Decision Explainer (Dynamically generated, no hardcoding)
        incident_id = incident.get("incident_id", "INC-000")
        logger.info(f"[{trace_id}] - [DECISION_EXPLAINER] - Generating explanation")
        explanation = self.decision_explainer.explain(
            incident_id=incident_id,
            threat_type=threat_type,
            attack_chain=attack_chain,
            entity_context=entity_context,
            risk_score=risk_score
        )
        validate(explanation, {"incident": str, "summary_lines": list}, "DecisionExplainer")

        # 7. Confidence Calibrator
        logger.info(f"[{trace_id}] - [CONFIDENCE_CALIBRATOR] - Calibrating")
        risk = memory.get("risk", {})
        compliance = memory.get("compliance", {})
        impact = memory.get("impact", {})
        confidence = self.confidence_calibrator.calibrate(risk, compliance, impact)
        
        # 8. Playbook Generator
        logger.info(f"[{trace_id}] - [PLAYBOOK_GENERATOR] - Generating playbook")
        playbook_name = self.playbook_selector.select(threat_type)
        response = self.playbook_generator.generate(playbook_name)
        validate(response, {"playbook": str, "steps": list}, "PlaybookGenerator")

        # 9. Automation Engine
        logger.info(f"[{trace_id}] - [AUTOMATION_ENGINE] - Running simulation")
        automation = self.automation_engine.simulate(response)

        # 10. Decision Logger
        logger.info(f"[{trace_id}] - [DECISION_LOGGER] - Logging to database")
        log_entry = {
            "incident_id": incident_id,
            "threat_type": threat_type,
            "decision": decision,
            "confidence": confidence,
            "playbook": response.get("steps")
        }
        self.decision_logger.log(log_entry)

        logger.info(f"[{trace_id}] - [PIPELINE_COMPLETED] - Success")

        # Output payload MUST be pure JSON with preserved context
        return {
            "status": "success",
            "data": {
                "trace_id": trace_id,
                "threat_analysis": threat_analysis,
                "attack_analysis": attack_analysis,
                "entity_context": entity_context,
                "orchestration": orchestration_result,
                "explanation": explanation,
                "confidence": confidence,
                "response": response,
                "automation": automation
            }
        }