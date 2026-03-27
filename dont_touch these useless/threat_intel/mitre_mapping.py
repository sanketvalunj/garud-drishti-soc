"""
Garud-Drishti — AI SOC Platform
MITRE ATT&CK Mapping Module

Maps SOC event types to MITRE ATT&CK techniques and tactics.
Enriches events in-place with:
  - mitre_technique   (e.g., T1110.001)
  - mitre_tactic      (e.g., Credential Access)
  - mitre_name        (e.g., Brute Force: Password Guessing)

All mappings are offline / embedded — no external API calls.
"""

from typing import Dict, Any, Optional, Tuple

# ---------------------------------------------------------------------------
# MITRE ATT&CK Mapping Table
# ---------------------------------------------------------------------------
# Format: event_type -> (technique_id, tactic, technique_name)

MITRE_MAP: Dict[str, Tuple[str, str, str]] = {
    # IAM / Authentication events
    "login_success":          ("T1078",     "Initial Access",      "Valid Accounts"),
    "login_failed":           ("T1110.001", "Credential Access",   "Brute Force: Password Guessing"),
    "account_locked":         ("T1110",     "Credential Access",   "Brute Force"),
    "password_change":        ("T1098",     "Persistence",         "Account Manipulation"),
    "mfa_attempt":            ("T1556",     "Credential Access",   "Modify Authentication Process"),
    "mfa_failed":             ("T1556",     "Credential Access",   "Modify Authentication Process"),
    "logout":                 ("T1078",     "Defense Evasion",     "Valid Accounts"),

    # EDR / Endpoint events
    "process_start":          ("T1059",     "Execution",           "Command and Scripting Interpreter"),
    "file_access":            ("T1083",     "Discovery",           "File and Directory Discovery"),
    "file_download":          ("T1105",     "Command and Control", "Ingress Tool Transfer"),
    "script_execution":       ("T1059.001", "Execution",           "PowerShell"),
    "privilege_escalation":   ("T1068",     "Privilege Escalation","Exploitation for Privilege Escalation"),
    "malware_detected":       ("T1204.002", "Execution",           "Malicious File"),

    # Firewall / Network events
    "connection_attempt":     ("T1071",     "Command and Control", "Application Layer Protocol"),
    "blocked_ip":             ("T1090",     "Command and Control", "Proxy"),
    "port_scan":              ("T1046",     "Discovery",           "Network Service Discovery"),
    "external_transfer":      ("T1041",     "Exfiltration",        "Exfiltration Over C2 Channel"),
    "vpn_connect":            ("T1133",     "Initial Access",      "External Remote Services"),
    "vpn_disconnect":         ("T1133",     "Initial Access",      "External Remote Services"),

    # Application / Data events
    "database_query":         ("T1213",     "Collection",          "Data from Information Repositories"),
    "data_access":            ("T1530",     "Collection",          "Data from Cloud Storage"),
    "data_export":            ("T1567",     "Exfiltration",        "Exfiltration Over Web Service"),
}

# ---------------------------------------------------------------------------
# Attack-chain → MITRE campaign mapping
# ---------------------------------------------------------------------------

ATTACK_CHAIN_MITRE: Dict[str, Tuple[str, str]] = {
    "brute_force":            ("T1110",  "Credential Access"),
    "privilege_escalation":   ("T1068",  "Privilege Escalation"),
    "insider_data_theft":     ("T1567",  "Exfiltration"),
    "data_exfiltration":      ("T1041",  "Exfiltration"),
    "lateral_movement":       ("T1021",  "Lateral Movement"),
    "suspicious_night_login": ("T1078",  "Initial Access"),
    "malware_infection":      ("T1204",  "Execution"),
    "malware_execution":      ("T1204",  "Execution"),
}


# ---------------------------------------------------------------------------
# Enrichment function
# ---------------------------------------------------------------------------

def enrich_event_mitre(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich an event dict in-place with MITRE ATT&CK mappings.

    Adds:
        mitre_technique  — ATT&CK technique ID
        mitre_tactic     — ATT&CK tactic name
        mitre_name       — Human-readable technique name

    Returns the same dict (mutated in-place) for convenience.
    """
    event_type = event.get("event_type", "")

    mapping = MITRE_MAP.get(event_type)
    if mapping:
        technique_id, tactic, technique_name = mapping
        event["mitre_technique"] = technique_id
        event["mitre_tactic"]    = tactic
        event["mitre_name"]      = technique_name
    else:
        event.setdefault("mitre_technique", "")
        event.setdefault("mitre_tactic",    "")
        event.setdefault("mitre_name",      "")

    # Also map attack chain if present
    chain = event.get("_attack_chain") or event.get("attack_chain", "")
    if chain and chain in ATTACK_CHAIN_MITRE:
        chain_tech, chain_tactic = ATTACK_CHAIN_MITRE[chain]
        event.setdefault("attack_chain", chain)
        # Prefer event-level mapping but annotate chain-level if missing
        if not event.get("mitre_technique"):
            event["mitre_technique"] = chain_tech
            event["mitre_tactic"]    = chain_tactic

    return event


def get_mitre_info(event_type: str) -> Optional[Dict[str, str]]:
    """Lookup MITRE info for an event type. Returns None if unmapped."""
    mapping = MITRE_MAP.get(event_type)
    if not mapping:
        return None
    return {
        "technique_id": mapping[0],
        "tactic":       mapping[1],
        "name":         mapping[2],
    }


def get_all_mapped_types() -> Dict[str, Dict[str, str]]:
    """Return all event types with their MITRE mappings."""
    return {
        evt: {"technique_id": m[0], "tactic": m[1], "name": m[2]}
        for evt, m in MITRE_MAP.items()
    }


# ---------------------------------------------------------------------------
# Standalone test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("MITRE ATT&CK Mapping Table")
    print("=" * 60)
    for evt_type, (tech, tactic, name) in MITRE_MAP.items():
        print(f"  {evt_type:30s} → {tech:12s} | {tactic:22s} | {name}")

    print(f"\n  Total mapped event types: {len(MITRE_MAP)}")

    # Test enrichment
    print("\n--- Enrichment Test ---")
    test_event = {"event_type": "login_failed", "user": "emp_101"}
    enrich_event_mitre(test_event)
    print(json.dumps(test_event, indent=2))
