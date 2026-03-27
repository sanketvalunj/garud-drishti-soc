class AutomationEngine:
    """
    Converts playbook mitigation steps into executable SOC actions.
    """
    def __init__(self):
        pass

    def simulate(self, playbook_data: dict) -> dict:
        """
        Simulate actions for the playbook steps.
        """
        steps = playbook_data.get("steps", []) if isinstance(playbook_data.get("steps", []), list) else []
        actions: list[dict] = []

        def _infer_action_name(step_text: str) -> str | None:
            text = (step_text or "").lower()
            if "account" in text:
                return "lock_account"
            if "isolate" in text or "endpoint" in text:
                return "isolate_endpoint"
            if "block" in text and "ip" in text:
                return "block_ip"
            if "block" in text and ("source" in text or "ip" in text):
                return "block_ip"
            return None

        for step in steps:
            action_name: str | None = None

            if isinstance(step, dict):
                action_name = step.get("action")  # Provided by LLM as structured action.
                if not action_name:
                    action_name = _infer_action_name(str(step.get("purpose", "")))
            else:
                action_name = _infer_action_name(str(step))

            if not action_name:
                continue
            actions.append(
                {
                    "action": action_name,
                    "status": "simulated",
                    "source_step": step,
                }
            )

        return {
            "actions": actions
        }
