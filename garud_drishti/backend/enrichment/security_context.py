"""
Garud-Drishti — AI SOC Platform
Security Context Enrichment  (backend/enrichment/security_context.py)

Adds enterprise SOC intelligence fields to every generated event:

  geo_country       : country resolved from IP
  geo_city          : city resolved from IP
  geo_risk          : low | medium | high | critical
  network_zone      : internal | dmz | external | secure_db
  asset_criticality : low | medium | high | critical
  user_risk_score   : 0.0 – 1.0  (from enterprise env when available)
  event_category    : authentication | endpoint_activity | network_activity |
                      database_access | data_exfiltration | malware_activity |
                      privilege_escalation | unknown
  threat_score      : 0 – 100  (composite risk score)

All lookups are local/offline — no external APIs are used.
IP→geo resolution uses prefix matching against a hand-crafted
representative table that covers common internal RFC-1918 ranges
and a selection of public address blocks.
"""

from __future__ import annotations

import ipaddress
import random
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_private(ip_str: str) -> bool:
    """Return True if the IP is in an RFC-1918 / loopback / link-local range."""
    try:
        return ipaddress.ip_address(ip_str).is_private
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Geo-location table
# Covers:
#   • RFC-1918 internal ranges  → India / Pune (our simulated HQ)
#   • Specific public /8 blocks → representative real-world countries
#   • High-risk nation prefixes → Russia, China, North Korea, Iran, Nigeria
# ---------------------------------------------------------------------------

_GEO_TABLE: list[tuple[ipaddress.IPv4Network, str, str, str]] = [
    # ( network,           country,        city,         risk   )
    # ── Internal / simulated corporate HQ ──────────────────────────────
    (ipaddress.IPv4Network("10.0.0.0/8"),       "India",        "Pune",        "low"),
    (ipaddress.IPv4Network("172.16.0.0/12"),     "India",        "Pune",        "low"),
    (ipaddress.IPv4Network("192.168.0.0/16"),    "India",        "Pune",        "low"),
    (ipaddress.IPv4Network("127.0.0.0/8"),       "India",        "Localhost",   "low"),
    # ── High-risk nations (commonly seen in threat intel) ───────────────
    (ipaddress.IPv4Network("5.0.0.0/8"),         "Russia",       "Moscow",      "critical"),
    (ipaddress.IPv4Network("46.0.0.0/8"),        "Russia",       "Saint Petersburg", "critical"),
    (ipaddress.IPv4Network("78.0.0.0/8"),        "Russia",       "Novosibirsk", "critical"),
    (ipaddress.IPv4Network("149.0.0.0/8"),       "Russia",       "Moscow",      "critical"),
    (ipaddress.IPv4Network("36.0.0.0/8"),        "China",        "Beijing",     "critical"),
    (ipaddress.IPv4Network("58.0.0.0/8"),        "China",        "Shanghai",    "critical"),
    (ipaddress.IPv4Network("61.0.0.0/8"),        "China",        "Shenzhen",    "critical"),
    (ipaddress.IPv4Network("175.0.0.0/8"),       "China",        "Guangzhou",   "critical"),
    (ipaddress.IPv4Network("175.45.0.0/16"),     "North Korea",  "Pyongyang",   "critical"),
    (ipaddress.IPv4Network("210.52.109.0/24"),   "North Korea",  "Pyongyang",   "critical"),
    (ipaddress.IPv4Network("91.0.0.0/8"),        "Iran",         "Tehran",      "high"),
    (ipaddress.IPv4Network("185.0.0.0/8"),       "Iran",         "Isfahan",     "high"),
    (ipaddress.IPv4Network("41.0.0.0/8"),        "Nigeria",      "Lagos",       "high"),
    (ipaddress.IPv4Network("102.0.0.0/8"),       "Nigeria",      "Abuja",       "high"),
    # ── Lower-risk public blocks ─────────────────────────────────────────
    (ipaddress.IPv4Network("8.0.0.0/8"),         "United States","New York",    "medium"),
    (ipaddress.IPv4Network("13.0.0.0/8"),        "United States","Seattle",     "medium"),
    (ipaddress.IPv4Network("23.0.0.0/8"),        "United States","San Jose",    "medium"),
    (ipaddress.IPv4Network("52.0.0.0/8"),        "United States","Ashburn",     "medium"),
    (ipaddress.IPv4Network("54.0.0.0/8"),        "United States","Virginia",    "medium"),
    (ipaddress.IPv4Network("31.0.0.0/8"),        "United Kingdom","London",     "low"),
    (ipaddress.IPv4Network("51.0.0.0/8"),        "United Kingdom","Manchester", "low"),
    (ipaddress.IPv4Network("62.0.0.0/8"),        "Germany",      "Frankfurt",   "low"),
    (ipaddress.IPv4Network("80.0.0.0/8"),        "Germany",      "Berlin",      "low"),
    (ipaddress.IPv4Network("103.0.0.0/8"),       "India",        "Mumbai",      "low"),
    (ipaddress.IPv4Network("122.0.0.0/8"),       "India",        "Bengaluru",   "low"),
    (ipaddress.IPv4Network("106.0.0.0/8"),       "Japan",        "Tokyo",       "low"),
    (ipaddress.IPv4Network("203.0.0.0/8"),       "Australia",    "Sydney",      "low"),
    (ipaddress.IPv4Network("200.0.0.0/8"),       "Brazil",       "São Paulo",   "medium"),
    (ipaddress.IPv4Network("177.0.0.0/8"),       "Brazil",       "Rio de Janeiro","medium"),
]

# Cache: ip_str → geo dict
_geo_cache: Dict[str, Dict[str, str]] = {}

_DEFAULT_GEO = {"geo_country": "Unknown", "geo_city": "Unknown", "geo_risk": "medium"}


def get_geo_context(ip_str: str) -> Dict[str, str]:
    """
    Resolve IP → geo context dict.

    Returns keys: geo_country, geo_city, geo_risk
    Falls back to Unknown / medium if IP is unrecognised.

    >>> get_geo_context("10.0.0.5")["geo_country"]
    'India'
    >>> get_geo_context("149.100.1.1")["geo_risk"]
    'critical'
    """
    if not ip_str:
        return _DEFAULT_GEO.copy()

    if ip_str in _geo_cache:
        return _geo_cache[ip_str].copy()

    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return _DEFAULT_GEO.copy()

    # EC-03: skip IPv6 — return default rather than crash on int("::1")
    import ipaddress as _ipa
    if isinstance(addr, _ipa.IPv6Address):
        return _DEFAULT_GEO.copy()

    for net, country, city, risk in _GEO_TABLE:
        if addr in net:
            result = {"geo_country": country, "geo_city": city, "geo_risk": risk}
            _geo_cache[ip_str] = result
            return result.copy()

    # Unknown public IPv4 — deterministic pseudo-random geo from first octet
    first_octet = int(str(addr).split(".")[0])
    fallback_geo = [
        ("United States", "Chicago",    "medium"),
        ("Canada",        "Toronto",    "low"),
        ("Netherlands",   "Amsterdam",  "medium"),
        ("Singapore",     "Singapore",  "medium"),
        ("South Africa",  "Cape Town",  "medium"),
    ]
    country, city, risk = fallback_geo[first_octet % len(fallback_geo)]
    result = {"geo_country": country, "geo_city": city, "geo_risk": risk}
    _geo_cache[ip_str] = result
    return result.copy()


# ---------------------------------------------------------------------------
# Network zone
# ---------------------------------------------------------------------------

_NETWORK_ZONES = {
    "10.0.0.0/8":    "internal",
    "172.16.0.0/12": "secure_db",
    "192.168.1.0/24":"dmz",
    "192.168.0.0/16":"internal",
    "127.0.0.0/8":   "internal",
}
_ZONE_NETS = [
    (ipaddress.IPv4Network(cidr), zone)
    for cidr, zone in _NETWORK_ZONES.items()
]


def get_network_zone(ip_str: str) -> str:
    """
    Map an IP address to a network zone.

    Zones: internal | secure_db | dmz | external

    >>> get_network_zone("10.0.0.5")
    'internal'
    >>> get_network_zone("172.16.0.1")
    'secure_db'
    >>> get_network_zone("8.8.8.8")
    'external'
    """
    if not ip_str:
        return "unknown"
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return "unknown"

    for net, zone in _ZONE_NETS:
        if addr in net:
            return zone
    return "external"


# ---------------------------------------------------------------------------
# Asset criticality
# ---------------------------------------------------------------------------

_ASSET_CRITICALITY: Dict[str, str] = {
    # Databases
    "core-banking-db":   "critical",
    "payments-db":       "critical",
    "trading-db":        "critical",
    "customer-db":       "high",
    "risk-db":           "high",
    "audit-db":          "high",
    "hr-db":             "medium",
    "archive-db":        "low",
    # Servers
    "auth-server":       "critical",
    "payments-server":   "critical",
    "trading-engine":    "critical",
    "internal-api":      "high",
    "vpn-gateway":       "high",
    "siem-server":       "high",
    "email-server":      "medium",
    "file-server":       "medium",
    "backup-server":     "medium",
    "monitoring-srv":    "low",
}

_DEVICE_CRITICALITY_HINTS = {
    "trading":    "high",
    "finance":    "high",
    "risk":       "high",
    "security":   "high",
    "payments":   "critical",
    "hr":         "medium",
    "ops":        "medium",
    "compliance": "medium",
}


def get_asset_criticality(asset: str) -> str:
    """
    Return asset criticality level: low | medium | high | critical.

    Checks exact matches first, then keyword heuristics,
    then defaults to 'medium'.

    >>> get_asset_criticality("core-banking-db")
    'critical'
    >>> get_asset_criticality("hr-desktop-001")
    'medium'
    """
    if not asset:
        return "medium"

    # Exact match
    if asset in _ASSET_CRITICALITY:
        return _ASSET_CRITICALITY[asset]

    # Keyword scan (longest matching keyword wins)
    asset_lower = asset.lower()
    for keyword, crit in _ASSET_CRITICALITY.items():
        if keyword in asset_lower:
            return crit

    # Department hints in device names
    for dept, crit in _DEVICE_CRITICALITY_HINTS.items():
        if dept in asset_lower:
            return crit

    return "medium"


# ---------------------------------------------------------------------------
# Event category classification
# ---------------------------------------------------------------------------

_EVENT_CATEGORY_MAP: Dict[str, str] = {
    "login_success":        "authentication",
    "login_failed":         "authentication",
    "account_locked":       "authentication",
    "password_change":      "authentication",
    "mfa_attempt":          "authentication",
    "mfa_failed":           "authentication",
    "logout":               "authentication",
    "vpn_connect":          "authentication",
    "vpn_disconnect":       "authentication",
    "process_start":        "endpoint_activity",
    "file_access":          "endpoint_activity",
    "file_download":        "endpoint_activity",
    "script_execution":     "endpoint_activity",
    "malware_detected":     "malware_activity",
    "connection_attempt":   "network_activity",
    "blocked_ip":           "network_activity",
    "port_scan":            "network_activity",
    "external_transfer":    "data_exfiltration",
    "database_query":       "database_access",
    "data_access":          "database_access",
    "data_export":          "data_exfiltration",
    "privilege_escalation": "privilege_escalation",
}


def classify_event_category(event_type: str) -> str:
    """
    Return the SOC event category for an event_type.

    >>> classify_event_category("login_failed")
    'authentication'
    >>> classify_event_category("data_export")
    'data_exfiltration'
    """
    return _EVENT_CATEGORY_MAP.get(event_type, "unknown")


# ---------------------------------------------------------------------------
# Threat score calculation
# ---------------------------------------------------------------------------

_SEVERITY_SCORES = {"low": 10, "medium": 30, "high": 55, "critical": 80}
_GEO_RISK_SCORES = {"low": 0, "medium": 5, "high": 10, "critical": 20}
_ASSET_CRIT_SCORES = {"low": 0, "medium": 5, "high": 10, "critical": 20}

# Technique-level base scores (add if severity alone is insufficient)
_TECHNIQUE_SCORES: Dict[str, int] = {
    "T1110": 20,   # Brute Force
    "T1068": 30,   # Privilege Escalation exploit
    "T1204": 25,   # User Execution (malware)
    "T1041": 25,   # Exfil over C2
    "T1046": 15,   # Network discovery
    "T1059": 20,   # Script interpreter
    "T1005": 15,   # Data from local system
    "T1021": 15,   # Remote services (lateral movement)
    "T1105": 10,   # Ingress tool transfer
}


def calculate_threat_score(event: Dict[str, Any]) -> int:
    """
    Compute a 0–100 composite threat score from:
      • severity           (10 / 30 / 55 / 80)
      • MITRE technique    (technique-specific bonus, 0–30)
      • geo_risk           (0 / 5 / 10 / 20)
      • asset_criticality  (0 / 5 / 10 / 20)
      • user_risk_score    (0–10, scaled from 0.0–1.0)
      • small random jitter (±3) for realism

    Returns an int clamped to [0, 100].

    >>> calculate_threat_score({"severity": "critical", "geo_risk": "high",
    ...                         "asset_criticality": "critical",
    ...                         "mitre_technique": "T1041"})
    100
    """
    score = 0

    # Severity base
    sev = event.get("severity", "low")
    score += _SEVERITY_SCORES.get(sev, 10)

    # MITRE technique bonus
    technique = event.get("mitre_technique", "T0000")
    score += _TECHNIQUE_SCORES.get(technique, 0)

    # Geo risk
    geo_risk = event.get("geo_risk", "") or event.get("geo_country", "")
    # geo_risk might already be "critical" or we might need to re-derive
    if geo_risk in _GEO_RISK_SCORES:
        score += _GEO_RISK_SCORES[geo_risk]
    else:
        # Fall back: if the IP is an external IP we add a small bump
        ip = event.get("ip", "") or event.get("src_ip", "")
        if ip and not _is_private(ip):
            score += 5

    # Asset criticality
    asset_crit = event.get("asset_criticality", "medium")
    score += _ASSET_CRIT_SCORES.get(asset_crit, 5)

    # User risk score (0.0–1.0 → 0–10 pts)
    urs = event.get("user_risk_score", 0.0)
    try:
        score += int(float(urs) * 10)
    except (TypeError, ValueError):
        pass

    # Small jitter for realism
    score += random.randint(-3, 3)

    return max(0, min(100, score))


# ---------------------------------------------------------------------------
# Master enrichment function — one call enriches everything
# ---------------------------------------------------------------------------

def enrich_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a single event dict in-place with all security context fields.

    Added / updated fields
    ----------------------
    geo_country, geo_city, geo_risk
    network_zone
    asset_criticality
    event_category
    threat_score

    Note: user_risk_score is expected to already be set on the event
    (populated from the employee record in the log generator).
    If absent it defaults to 0.0 and can be set separately.

    Returns the same dict for chaining.
    """
    ip = event.get("ip") or event.get("src_ip") or ""

    # Geo
    geo = get_geo_context(ip)
    event.update(geo)

    # Network zone
    event["network_zone"] = get_network_zone(ip)

    # Asset criticality
    asset = event.get("asset") or event.get("device") or ""
    event["asset_criticality"] = get_asset_criticality(asset)

    # Event category
    event["event_category"] = classify_event_category(event.get("event_type", ""))

    # Threat score (uses fields enriched above + MITRE if present)
    event["threat_score"] = calculate_threat_score(event)

    return event


def enrich_events(events: list) -> list:
    """Enrich a list of event dicts in-place. Returns the same list."""
    for e in events:
        enrich_event(e)
    return events


# ---------------------------------------------------------------------------
# Quick test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    sample = {
        "event_id":      "test-uuid",
        "timestamp":     "2026-03-15T02:41:00",
        "user":          "emp_102",
        "device":        "finance-laptop",
        "asset":         "core-banking-db",
        "ip":            "149.100.1.1",
        "event_type":    "data_export",
        "source":        "APP",
        "severity":      "critical",
        "mitre_technique":"T1041",
        "mitre_tactic":  "Exfiltration",
        "user_risk_score": 0.82,
        "session_id":    "abcd1234",
    }
    enriched = enrich_event(sample)
    print(json.dumps(enriched, indent=2))