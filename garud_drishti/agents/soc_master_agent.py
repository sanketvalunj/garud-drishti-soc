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
        # 1. Build SOC intelligence context (Layer 1)
        context = build_soc_context()
        print("\n[SOC PIPELINE STARTED]")

        incidents = context.get("incidents", [])
        if not incidents:
            print("No incidents detected")
            return "No incidents detected"
            
        incident = incidents[0]
        anomalies = context.get("anomalies", [])

        # 2. Threat Reasoner
        threat_analysis = self.threat_reasoner.analyze(incident, anomalies)
        
        # 3. Attack Analyzer
        attack_analysis = self.attack_analyzer.analyze(incident)

        # 4. Agent Orchestrator (Layer 2 & 3 Voting Engine)
        orchestration_result = self.orchestrator.run(incident)
        decision = orchestration_result["decision"]
        memory = orchestration_result["agent_memory"]

        # 5. Policy Guard (Governance)
        decision = self.policy_guard.validate(decision)

        # 6. Decision Explainer
        explanation = self.decision_explainer.explain(incident, decision, memory)

        # 7. Confidence Calibrator
        risk = memory.get("risk", {})
        compliance = memory.get("compliance", {})
        impact = memory.get("impact", {})
        confidence = self.confidence_calibrator.calibrate(risk, compliance, impact)
        
        # 8. Playbook Generator
        threat_type = threat_analysis.get('threat_type', '')
        playbook_name = self.playbook_selector.select(threat_type)
        response = self.playbook_generator.generate(playbook_name)

        # 9. Automation Engine
        automation = self.automation_engine.simulate(response)

        # 10. Decision Logger
        log_entry = {
            "incident_id": incident.get("incident_id"),
            "threat_type": threat_analysis.get('threat_type', 'privilege_escalation'),
            "decision": decision,
            "confidence": confidence,
            "playbook": response.get("steps")
        }
        self.decision_logger.log(log_entry)

        # Output formatting
        threat_type = threat_analysis.get('threat_type', 'privilege_escalation')
        if threat_type == 'privilege_attack':
            threat_type = 'privilege_escalation'

        print("\nThreat Type: {}".format(threat_type))
        
        print("\nRisk Score: {}".format(risk.get('risk_score', 8)))
        print("Compliance Score: {}".format(compliance.get('compliance_score', 7)))
        print("Business Impact: {}".format(impact.get('business_impact', 'critical')))
        
        print("\nFinal Decision: {}".format(decision.get('decision', 'CRITICAL').upper()))
        print("Confidence: {}".format(confidence))

        print("\nExplanation:")
        for line in explanation.get("summary_lines", []):
            print(line)

        print("\nPlaybook:")
        for step in response.get('steps', []):
            print(step)

        print("\nAutomation:")
        for act in automation.get('actions', []):
            print("{} \u2192 {}".format(act.get('action'), act.get('status')))

        print("\n[SOC PIPELINE COMPLETED]")

        return {
            "threat_analysis": threat_analysis,
            "attack_analysis": attack_analysis,
            "orchestration": orchestration_result,
            "explanation": explanation,
            "confidence": confidence,
            "response": response,
            "automation": automation
        }