from datetime import datetime


class SchemaMapper:
    """
    Maps parsed logs into normalized SOC event schema.
    """

    def map(self, log: dict):

        # timestamp normalization
        ts = log.get("timestamp")

        if ts:
            try:
                ts = datetime.fromisoformat(ts).isoformat()
            except Exception:
                ts = datetime.utcnow().isoformat()
        else:
            ts = datetime.utcnow().isoformat()

        event = {
            "timestamp": ts,
            "source": log.get("source", "unknown"),
            "event_type": log.get("event_type", "unknown"),
            "asset": log.get("asset", log.get("host", "unknown")),
            "user": log.get("user", "unknown"),
            "ip_address": log.get("ip_address", log.get("ip", None)),
            "details": log.get("details", log)
        }

        return event