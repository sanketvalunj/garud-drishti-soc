class ResponseSelector:
    """
    Maps LLM suggested automation candidates
    to actual SOC automation modules.
    """

    AVAILABLE_ACTIONS = {
        "lock_account": "automation.account_lock.lock_account",
        "isolate_endpoint": "automation.endpoint_isolation.isolate_device",
        "block_ip": "automation.ip_blocker.block_ip"
    }

    def __init__(self):
        pass

    def select_actions(self, playbook: dict):
        """
        Extract valid automation steps from playbook JSON.
        """

        actions = []

        candidates = playbook.get("automation_candidates", [])

        for candidate in candidates:
            if candidate in self.AVAILABLE_ACTIONS:
                actions.append({
                    "action": candidate,
                    "handler": self.AVAILABLE_ACTIONS[candidate]
                })

        return actions