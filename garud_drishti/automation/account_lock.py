from datetime import datetime


def lock_account(user: str, dry_run: bool = True):
    """
    Lock a compromised user account.

    In production this could connect to:
    - Active Directory
    - IAM system
    - SSO provider
    """

    action = {
        "action": "lock_account",
        "target": user,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "simulated" if dry_run else "executed"
    }

    # Future: real integration here

    return action