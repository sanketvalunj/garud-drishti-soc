import json
from datetime import datetime
from pathlib import Path

def _get_project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent.parent

class DecisionLogger:
    def __init__(self):
        self.log_file = _get_project_root() / "data" / "ai_decisions" / "decision_log.json"
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

    def log(self, decision_object):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "decision": decision_object
        }

        if self.log_file.exists() and self.log_file.stat().st_size > 0:
            try:
                data = json.loads(self.log_file.read_text())
            except json.JSONDecodeError:
                data = []
        else:
            data = []

        data.append(entry)
        self.log_file.write_text(json.dumps(data, indent=2))
