from datetime import datetime


def block_ip(ip: str, dry_run: bool = True):
    """
    Block malicious IP address.

    In production could call:
    - firewall API
    - WAF rule insertion
    - SIEM suppression list
    """

    action = {
        "action": "block_ip",
        "target": ip,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "simulated" if dry_run else "executed"
    }

    return action