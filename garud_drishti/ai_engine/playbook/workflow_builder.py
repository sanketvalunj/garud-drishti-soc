class WorkflowBuilder:
    """
    Builds a structured SOC workflow from playbook JSON.
    """

    def __init__(self):
        pass

    def build(self, playbook: dict):
        """
        Convert LLM playbook into internal workflow format.
        """

        steps = playbook.get("playbook_steps", [])
        risk = playbook.get("risk_level", "Unknown")

        workflow = {
            "risk_level": risk,
            "phases": {
                "containment": [],
                "investigation": [],
                "recovery": []
            }
        }

        for step in steps:
            action_text = step.get("action", "").lower()

            # SOC logic classification
            if any(word in action_text for word in ["isolate", "block", "disable", "lock"]):
                workflow["phases"]["containment"].append(step)

            elif any(word in action_text for word in ["analyze", "review", "check", "inspect"]):
                workflow["phases"]["investigation"].append(step)

            else:
                workflow["phases"]["recovery"].append(step)

        return workflow