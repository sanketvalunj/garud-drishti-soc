from garud_drishti.ai_engine.playbook import (
    PlaybookGenerator,
    WorkflowBuilder,
    ResponseSelector,
)


class ResponseAgent:
    """
    Converts investigated incident into response plan.
    """

    def __init__(self):
        self.generator = PlaybookGenerator()
        self.workflow = WorkflowBuilder()
        self.selector = ResponseSelector()

    def run(self, investigation_output: dict):
        """
        Produce playbook, workflow, and automation plan.
        """

        incident = investigation_output["incident"]
        risk = investigation_output["risk"]

        # Generate LLM playbook
        playbook = self.generator.generate(incident, risk)

        # Convert to structured workflow
        workflow = self.workflow.build(playbook)

        # Choose automation steps
        actions = self.selector.select_actions(playbook)

        return {
            "playbook": playbook,
            "workflow": workflow,
            "automation_plan": actions,
        }