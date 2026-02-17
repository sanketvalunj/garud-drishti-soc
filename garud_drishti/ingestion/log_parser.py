import json


class LogParser:
    """
    Converts raw logs into structured Python dicts.
    Supports:
    - JSON logs
    - dict logs
    - simple text logs (fallback)
    """

    def parse(self, raw_log):
        # Already dict
        if isinstance(raw_log, dict):
            return raw_log

        # JSON string
        if isinstance(raw_log, str):
            try:
                return json.loads(raw_log)
            except Exception:
                return {
                    "timestamp": None,
                    "source": "unknown",
                    "event_type": "raw_text",
                    "details": raw_log
                }

        return None