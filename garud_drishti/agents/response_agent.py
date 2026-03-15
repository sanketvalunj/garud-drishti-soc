from garud_drishti.ai_engine.playbook.playbook_selector import PlaybookSelector
from garud_drishti.ai_engine.playbook.playbook_generator import PlaybookGenerator

class ResponseAgent:
    """
    Generates the final SOC response plan.
    """
    def __init__(self):
        self.selector = PlaybookSelector()
        self.generator = PlaybookGenerator()

    def respond(self, investigation: dict) -> dict:
        """
        Produce a response playbook based on threat type.
        """
        threat_type = investigation.get("threat_type", "generic")
        
        # Select playbook
        playbook_name = self.selector.select(threat_type)
        
        # Generate steps
        response_plan = self.generator.generate(playbook_name)
        
        return response_plan