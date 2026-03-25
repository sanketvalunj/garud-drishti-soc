import hashlib
import ipaddress


def hash_text(text: str) -> str:
    """
    Hash sensitive values before storing.
    Useful for anonymizing logs or user IDs.
    """
    return hashlib.sha256(text.encode()).hexdigest()


def validate_ip(ip: str) -> bool:
    """
    Check if IP address is valid.
    """
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False