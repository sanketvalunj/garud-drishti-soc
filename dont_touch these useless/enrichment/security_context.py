"""
Garud-Drishti — AI SOC Platform
Security Context Enrichment Module

Enriches security events with contextual intelligence:
  - geo_country     — ISO-3166 country code derived from IP
  - geo_risk        — risk classification of the country
  - network_zone    — internal | dmz | external | db_tier
  - asset_criticality — inferred from asset name
  - threat_score    — composite risk score (0–100)

All enrichment is offline — based on IP range heuristics and
static lookup tables. No external API calls.
"""

from __future__ import annotations

import hashlib
import ipaddress
import random
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Geo-IP Heuristic Lookup (offline)
# ---------------------------------------------------------------------------
# Since we generate our own IPs, we derive geo context from IP octets.
# Private IPs → "IN" (Indian bank, internal).  Public IPs → heuristic.

HIGH_RISK_COUNTRIES = {"RU", "CN", "KP", "IR", "NG", "BY", "VE"}
MEDIUM_RISK_COUNTRIES = {"BR", "UA", "PK", "ID", "PH", "VN", "RO"}
LOW_RISK_COUNTRIES = {"US", "GB", "DE", "JP", "SG", "AU", "CA", "IN"}

# Deterministic country derivation from IP (for simulation consistency)
_COUNTRY_POOL_HIGH   = list(HIGH_RISK_COUNTRIES)
_COUNTRY_POOL_MEDIUM = list(MEDIUM_RISK_COUNTRIES)
_COUNTRY_POOL_LOW    = list(LOW_RISK_COUNTRIES)


def _ip_to_country(ip_str: str) -> str:
    """
    Derive a deterministic country from an IP address.
    Private IPs → IN (internal bank).
    Public IPs → heuristic based on first octet hash.
    """
    if not ip_str or ip_str in ("", "unknown"):
        return "IN"

    try:
        addr = ipaddress.ip_address(ip_str)
    except (ValueError, TypeError):
        return "IN"

    if addr.is_private or addr.is_loopback or addr.is_reserved:
        return "IN"

    # Deterministic mapping based on IP hash
    h = int(hashlib.md5(ip_str.encode()).hexdigest()[:4], 16)
    bucket = h % 100

    if bucket < 15:  # 15% high-risk
        return _COUNTRY_POOL_HIGH[h % len(_COUNTRY_POOL_HIGH)]
    elif bucket < 35:  # 20% medium-risk
        return _COUNTRY_POOL_MEDIUM[h % len(_COUNTRY_POOL_MEDIUM)]
    else:  # 65% low-risk
        return _COUNTRY_POOL_LOW[h % len(_COUNTRY_POOL_LOW)]


def _country_risk(country: str) -> str:
    """Return risk classification for a country code."""
    if country in HIGH_RISK_COUNTRIES:
        return "high"
    if country in MEDIUM_RISK_COUNTRIES:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Network Zone Classification
# ---------------------------------------------------------------------------

def _classify_network_zone(ip_str: str) -> str:
    """Classify IP into a network zone."""
    if not ip_str:
        return "unknown"

    try:
        addr = ipaddress.ip_address(ip_str)
    except (ValueError, TypeError):
        return "unknown"

    if addr.is_loopback:
        return "internal"

    # Internal corporate LAN
    try:
        if addr in ipaddress.IPv4Network("10.0.0.0/8"):
            return "internal"
    except (TypeError, ValueError):
        pass

    # DB tier
    try:
        if addr in ipaddress.IPv4Network("172.16.0.0/12"):
            return "db_tier"
    except (TypeError, ValueError):
        pass

    # DMZ
    try:
        if addr in ipaddress.IPv4Network("192.168.0.0/16"):
            return "dmz"
    except (TypeError, ValueError):
        pass

    return "external"


# ---------------------------------------------------------------------------
# Asset Criticality Inference
# ---------------------------------------------------------------------------

_CRITICAL_ASSETS = {
    "auth-server", "payments-server", "trading-engine",
    "core-banking-db", "payments-db", "trading-db",
}
_HIGH_ASSETS = {
    "internal-api", "vpn-gateway", "siem-server", "backup-server",
    "customer-db", "risk-db", "audit-db",
}
_MEDIUM_ASSETS = {
    "email-server", "file-server", "hr-db", "archive-db",
    "monitoring-srv",
}


def _infer_asset_criticality(asset: str) -> str:
    """Infer asset criticality from asset name."""
    if not asset:
        return "low"
    asset_lower = asset.lower()
    if asset_lower in _CRITICAL_ASSETS:
        return "critical"
    if asset_lower in _HIGH_ASSETS:
        return "high"
    if asset_lower in _MEDIUM_ASSETS:
        return "medium"
    # Keyword matching fallback
    if any(kw in asset_lower for kw in ("banking", "payment", "trading", "auth")):
        return "critical"
    if any(kw in asset_lower for kw in ("customer", "risk", "audit", "vpn", "siem")):
        return "high"
    return "low"


# ---------------------------------------------------------------------------
# Threat Score Calculation
# ---------------------------------------------------------------------------

_SEVERITY_WEIGHTS = {
    "critical": 40, "high": 25, "medium": 12, "low": 3,
}

_EVENT_TYPE_RISK = {
    "privilege_escalation": 35, "malware_detected": 40,
    "data_export": 30, "external_transfer": 25,
    "port_scan": 20, "script_execution": 18,
    "login_failed": 8, "blocked_ip": 15,
    "account_locked": 12, "data_access": 10,
    "mfa_failed": 15, "file_download": 5,
    "connection_attempt": 3, "database_query": 3,
    "login_success": 2, "process_start": 2,
    "file_access": 2, "logout": 1,
    "vpn_connect": 1, "vpn_disconnect": 1,
    "mfa_attempt": 1, "password_change": 1,
}


def _calculate_threat_score(event: Dict[str, Any]) -> int:
    """
    Calculate a composite threat score (0–100) from multiple signals.

    Components:
      - Severity weight (0-40)
      - Event type risk (0-40)
      - Geo risk bonus (0-10)
      - After-hours bonus (0-5)
      - Attack chain bonus (0-10)

    Clamped to [0, 100].
    """
    score = 0

    # Severity component
    severity = event.get("severity", "low")
    score += _SEVERITY_WEIGHTS.get(severity, 3)

    # Event type component
    event_type = event.get("event_type", "")
    score += _EVENT_TYPE_RISK.get(event_type, 2)

    # Geo risk bonus
    geo_risk = event.get("geo_risk", "low")
    if geo_risk == "high":
        score += 10
    elif geo_risk == "medium":
        score += 5

    # After-hours bonus
    details = event.get("details", {})
    if isinstance(details, dict) and details.get("after_hours"):
        score += 5

    # Attack chain bonus
    chain = event.get("_attack_chain") or event.get("attack_chain", "")
    if chain:
        score += 10

    # User risk score factor
    user_risk = event.get("user_risk_score", 0)
    if isinstance(user_risk, (int, float)):
        score += int(user_risk * 5)  # 0-5 bonus

    return max(0, min(100, score))


# ---------------------------------------------------------------------------
# Master Enrichment Function
# ---------------------------------------------------------------------------

def enrich_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a security event in-place with contextual intelligence.

    Adds:
        geo_country        — Country code (heuristic from IP)
        geo_risk           — Country risk level
        network_zone       — Network classification
        asset_criticality  — Inferred from asset name
        threat_score       — Composite risk score (0–100)

    Returns the same dict for convenience.
    """
    # Extract the best available IP
    ip = event.get("ip") or event.get("src_ip") or ""

    # Geo enrichment
    country = event.get("geo_country") or _ip_to_country(ip)
    event["geo_country"] = country
    event["geo_risk"]    = _country_risk(country)

    # Network zone
    event["network_zone"] = _classify_network_zone(ip)

    # Asset criticality
    asset = event.get("asset", "")
    event["asset_criticality"] = _infer_asset_criticality(asset)

    # Threat score (computed after geo/zone enrichment)
    event["threat_score"] = _calculate_threat_score(event)

    return event


# ---------------------------------------------------------------------------
# Standalone test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json

    print("=" * 60)
    print("Security Context Enrichment Test")
    print("=" * 60)

    test_cases = [
        {
            "event_type": "login_failed",
            "ip": "10.0.0.5",
            "severity": "medium",
            "asset": "auth-server",
        },
        {
            "event_type": "privilege_escalation",
            "ip": "185.45.67.89",
            "severity": "critical",
            "asset": "core-banking-db",
            "_attack_chain": "privilege_escalation",
        },
        {
            "event_type": "data_export",
            "ip": "203.150.22.10",
            "severity": "critical",
            "asset": "payments-db",
            "details": {"after_hours": True},
        },
        {
            "event_type": "connection_attempt",
            "ip": "192.168.1.50",
            "severity": "low",
            "asset": "file-server",
        },
    ]

    for i, evt in enumerate(test_cases):
        enriched = enrich_event(evt.copy())
        print(f"\n[Test {i+1}] {evt['event_type']} from {evt['ip']}:")
        print(f"  geo: {enriched['geo_country']} ({enriched['geo_risk']})")
        print(f"  zone: {enriched['network_zone']}")
        print(f"  asset criticality: {enriched['asset_criticality']}")
        print(f"  threat score: {enriched['threat_score']}/100")
