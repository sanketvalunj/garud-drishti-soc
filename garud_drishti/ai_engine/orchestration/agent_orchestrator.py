from garud_drishti.ai_engine.agents.risk_agent import RiskAgent
from garud_drishti.ai_engine.agents.compliance_agent import ComplianceAgent
from garud_drishti.ai_engine.agents.business_impact_agent import BusinessImpactAgent
from garud_drishti.ai_engine.orchestration.voting_engine import VotingEngine
from garud_drishti.ai_engine.orchestration.agent_memory import AgentMemory

class AgentOrchestrator:
    """
    Orchestrates the Layer 2 (Multi-Agent Reasoning) and Layer 3 (Decision) pipeline.
    """
    def __init__(self):
        self.risk = RiskAgent()
        self.compliance = ComplianceAgent()
        self.impact = BusinessImpactAgent()
        
        self.voting = VotingEngine()
        self.memory = AgentMemory()

    def run(self, context: dict) -> dict:
        """
        Accept either a plain incident dict or the enriched context wrapper
        from SOCMasterAgent: {incident, threat_analysis, attack_analysis}.
        Sub-agents always receive the raw incident so their .get() calls work correctly.
        """
        # Unpack enriched context if present, otherwise treat the whole dict as the incident
        incident = context.get("incident", context)
        threat_analysis = context.get("threat_analysis", {})
        attack_analysis = context.get("attack_analysis", {})

        risk = self.risk.analyze(
            incident,
            attack_chain=attack_analysis.get("attack_chain"),
            risk_factors=threat_analysis,
        )
        self.memory.store("risk", risk)

        compliance = self.compliance.analyze(incident)
        self.memory.store("compliance", compliance)

        impact = self.impact.assess(incident)
        self.memory.store("impact", impact)

        decision = self.voting.decide(risk, compliance, impact)

        return {
            "decision": decision,
            "agent_memory": self.memory.dump()
        }
