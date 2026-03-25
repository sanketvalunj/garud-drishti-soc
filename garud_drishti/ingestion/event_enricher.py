import hashlib
import ipaddress


class EventEnricher:

    EVENT_CATEGORIES = {
        "login_failed": "authentication",
        "login_success": "authentication",
        "privilege_escalation": "authorization",
        "port_scan": "network",
        "network_connection": "network",
        "file_access": "data_access"
    }

    MITRE_MAPPING = {
        "login_failed": "T1110",
        "privilege_escalation": "T1068",
        "port_scan": "T1046",
        "network_connection": "T1021"
    }

    def validate_ip(self, ip):
        if not ip:
            return "unknown"
        try:
            ipaddress.ip_address(ip)
            return ip
        except:
            return "unknown"

    def categorize(self, event_type):
        return self.EVENT_CATEGORIES.get(event_type, "other")

    def mitre_tag(self, event_type):
        return self.MITRE_MAPPING.get(event_type, "unknown")

    def fingerprint(self, event):
        timestamp = event.get('timestamp', '')
        user = event.get('user', '')
        event_type = event.get('event_type', '')
        asset = event.get('asset', '')
        ip = event.get('ip', '')
        raw = f"{timestamp}{user}{event_type}{asset}{ip}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def enrich(self, event):
        event["ip"] = self.validate_ip(event.get("ip"))
        event["event_category"] = self.categorize(event.get("event_type"))
        event["mitre_technique"] = self.mitre_tag(event.get("event_type"))
        event["event_hash"] = self.fingerprint(event)
        return event
