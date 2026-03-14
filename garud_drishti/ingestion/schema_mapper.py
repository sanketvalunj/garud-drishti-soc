from datetime import datetime
import ipaddress


class SchemaMapper:
    """
    Production-grade SOC event schema mapper.
    Converts heterogeneous parsed logs into a strict normalized schema.
    """

    EVENT_ALIASES = {
        "login_failed": ["failed_login", "login_fail", "auth_failure"],
        "login_success": ["auth_success"],
        "privilege_escalation": ["sudo", "admin_access"],
        "file_access": ["file_read", "open_file"],
        "network_connection": ["connect", "connection"]
    }

    def _normalize_event_type(self, event_type):

        if not event_type:
            return "unknown"

        event_type = event_type.lower()

        for canonical, aliases in self.EVENT_ALIASES.items():
            if event_type == canonical or event_type in aliases:
                return canonical

        return event_type


    def _normalize_timestamp(self, ts):

        if not ts:
            return datetime.utcnow().isoformat()

        try:
            return datetime.fromisoformat(ts).isoformat()
        except Exception:
            try:
                return datetime.utcfromtimestamp(float(ts)).isoformat()
            except Exception:
                return datetime.utcnow().isoformat()


    def _validate_ip(self, ip):

        if not ip:
            return "unknown"

        try:
            ipaddress.ip_address(ip)
            return ip
        except ValueError:
            return "unknown"


    def map(self, log: dict):

        timestamp = self._normalize_timestamp(log.get("timestamp"))

        event_type = (
            log.get("event_type")
            or log.get("action")
            or log.get("event")
        )

        event_type = self._normalize_event_type(event_type)

        asset = (
            log.get("asset")
            or log.get("server")
            or log.get("host")
            or log.get("dst_host")
            or "unknown"
        )

        ip = (
            log.get("ip")
            or log.get("ip_address")
            or log.get("src_ip")
            or log.get("source_ip")
        )

        ip = self._validate_ip(ip)

        # Extract behavior fields
        timestamp_obj = datetime.fromisoformat(timestamp)
        login_hour = log.get("login_hour", timestamp_obj.hour)
        night_login = log.get("night_login") or (login_hour < 6 or login_hour > 22)

        event = {
            "timestamp": timestamp,
            "source": log.get("source", "unknown"),
            "event_type": event_type,
            "asset": asset,
            "user": log.get("user") or log.get("user_id") or "unknown",
            "ip": ip,
            "device": log.get("device"),
            "risk_flag": log.get("risk_flag", "normal"),
            "asset_criticality": log.get("asset_criticality", "medium"),
            "login_hour": login_hour,
            "night_login": night_login,
            "session_id": log.get("session_id"),
            "process": log.get("process"),
            "geo_location": log.get("geo_location"),
            "raw": log.get("raw", log)
        }

        # Structured fields
        event["behavior_features"] = {
            "login_hour": event["login_hour"],
            "night_login": event["night_login"]
        }
        event["entity_context"] = {
            "session_id": event["session_id"],
            "process": event["process"],
            "geo_location": event["geo_location"]
        }

        return event
