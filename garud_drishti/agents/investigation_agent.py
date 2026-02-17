from garud_drishti.ai_engine.reasoning import (
    IncidentInterpreter,
    MitreMapper,
    RiskExplainer,
)


class InvestigationAgent:
    """
    Performs SOC investigation logic on incidents.
    """

    def __init__(self):
        self.interpreter = IncidentInterpreter()
        self.mitre = MitreMapper()
        self.risk = RiskExplainer()

    def run(self, incident: dict):
        """
        Enrich a single incident with reasoning output.
        """

        interpretation = self.interpreter.interpret(incident)
        mitre_matches = self.mitre.map(interpretation)
        explanation = self.risk.explain(
            incident,
            interpretation,
            mitre_matches,
        )

        return {
            "incident": incident,
            "interpretation": interpretation,
            "mitre": mitre_matches,
            "risk": explanation,
        }