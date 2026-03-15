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

    def run(self, incident: dict) -> dict:
        risk = self.risk.analyze(incident)
        self.memory.store("risk", risk)

        compliance = self.compliance.analyze(incident)
        self.memory.store("compliance", compliance)

        impact = self.impact.assess(incident)
        self.memory.store("impact", impact)

        decision = self.voting.decide(
            risk,
            compliance,
            impact
        )

        return {
            "decision": decision,
            "agent_memory": self.memory.dump()
        }
