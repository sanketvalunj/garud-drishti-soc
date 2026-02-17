from .correlation_agent import CorrelationAgent
from .investigation_agent import InvestigationAgent
from .response_agent import ResponseAgent


class SOCMasterAgent:
    """
    Orchestrates the full SOC pipeline:
    events -> incidents -> investigation -> response
    """

    def __init__(self):
        self.correlation = CorrelationAgent()
        self.investigation = InvestigationAgent()
        self.response = ResponseAgent()

    def run(self, events: list):
        """
        Execute full SOC workflow.
        """

        final_results = []

        # 1️⃣ Correlate events into incidents
        incidents = self.correlation.run(events)

        # 2️⃣ Investigate each incident
        for incident in incidents:
            investigation_output = self.investigation.run(incident)

            # 3️⃣ Generate response plan
            response_output = self.response.run(investigation_output)

            final_results.append({
                "incident": incident,
                "investigation": investigation_output,
                "response": response_output,
            })

        return final_results