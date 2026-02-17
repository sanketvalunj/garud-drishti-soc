from typing import List, Dict, Any

from garud_drishti.automation import (
    lock_account,
    isolate_endpoint,
    block_ip,
)

# Optional config support (safe if not present yet)
try:
    from garud_drishti.backend.utils.config_loader import Config
    CONFIG_AVAILABLE = True
except Exception:
    CONFIG_AVAILABLE = False


class AutomationExecutor:
    """
    Executes SOC automation actions selected by ResponseSelector.

    Supports:
    - dry-run mode for safe demo execution
    - validation of allowed actions
    - structured execution reporting
    """

    ACTION_MAP = {
        "lock_account": lock_account,
        "isolate_endpoint": isolate_endpoint,
        "block_ip": block_ip,
    }

    def __init__(self, dry_run: bool = True):
        # If config exists, override dry_run from config
        if CONFIG_AVAILABLE:
            try:
                dry_run = Config.response.get("automation", {}).get("dry_run", dry_run)
            except Exception:
                pass

        self.dry_run = dry_run

    # ---------------------------------------------------
    # Validate allowed actions
    # ---------------------------------------------------
    def _is_allowed(self, action_name: str) -> bool:
        if not CONFIG_AVAILABLE:
            return True

        try:
            allowed = Config.response.get("automation", {}).get("allowed_actions", [])
            return action_name in allowed or not allowed
        except Exception:
            return True

    # ---------------------------------------------------
    # Execute single action
    # ---------------------------------------------------
    def _execute_action(self, action: Dict[str, Any], incident: Dict[str, Any]):
        name = action.get("action")

        if name not in self.ACTION_MAP:
            return {
                "action": name,
                "status": "skipped",
                "reason": "unknown_action"
            }

        if not self._is_allowed(name):
            return {
                "action": name,
                "status": "blocked",
                "reason": "not_allowed_by_policy"
            }

        func = self.ACTION_MAP[name]

        # Resolve target safely
        target = (
            incident.get("user")
            or incident.get("asset")
            or incident.get("ip_address")
            or "unknown"
        )

        try:
            result = func(target, dry_run=self.dry_run)
            return result
        except Exception as e:
            return {
                "action": name,
                "status": "failed",
                "reason": str(e)
            }

    # ---------------------------------------------------
    # Execute full automation plan
    # ---------------------------------------------------
    def execute(self, automation_plan: List[Dict[str, Any]], incident: Dict[str, Any]):
        """
        Runs all automation steps safely.
        Returns execution report.
        """

        results = []

        for action in automation_plan:
            result = self._execute_action(action, incident)
            results.append(result)

        return {
            "incident_id": incident.get("incident_id"),
            "dry_run": self.dry_run,
            "actions_executed": results
        }