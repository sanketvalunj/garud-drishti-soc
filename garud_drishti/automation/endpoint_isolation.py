from datetime import datetime


def isolate_endpoint(asset: str, dry_run: bool = True):
    """
    Isolate compromised endpoint from network.

    In production this could trigger:
    - EDR isolation command
    - NAC quarantine
    - firewall block rules
    """

    action = {
        "action": "isolate_endpoint",
        "target": asset,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "simulated" if dry_run else "executed"
    }

    return action