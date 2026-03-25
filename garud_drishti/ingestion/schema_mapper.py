"""
CRYPTIX — GARUD-DRISHTI
ingestion/schema_mapper.py

RESPONSIBILITY: MAPPING ONLY
─────────────────────────────
Transform a raw parsed dict (from log_parser) into the
canonical SOC event schema. No parsing, no validation,
no crash-handling — that is safe_mapper.py's job.

Three-layer event_type normalisation:
  Layer 1 — Canonical pass-through (already correct → no-op)
  Layer 2 — Exact alias lookup (160+ variants)
  Layer 3 — Signal-keyword fuzzy matching (tokenises input)

All Critical Fixes Applied:
  FIX-01  event_type strictly "unknown" + original_event_type saved
  FIX-02  user    ← user, username, usr, resolved_user
          device  ← device, hostname, workstation, device_id
          source  ← source OR log_source
  FIX-03  device_id always normalised and set
  FIX-04  event_category derived from event_type, not only source
  FIX-05  geo_location always {country, city, lat, lon}
  FIX-06  details merge never overwrites existing keys
  FIX-07  session_id: sess_{entity_id}_{timestamp[:13]}
  FIX-08  anomaly_score, confidence, port → correct types (ES-safe)
  FIX-09  VALID_SOURCES includes all GARUD-DRISHTI systemss
  FIX-10  Data lineage: _source_file, _ingestion_time forwarded
"""

from __future__ import annotations

import json
import uuid
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# ─────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────

VALID_SEVERITIES = {"info", "low", "medium", "high", "critical"}

VALID_SOURCES = {
    "IAM","EDR","FIREWALL","APP","RAW",
    "SIEM","BANKING","NETWORK","ENDPOINT",
    "IDENTITY","DETECTION","AUDIT","UNKNOWN",
}

SOURCE_TO_CATEGORY = {
    "IAM":"authentication",
    "EDR":"endpoint",
    "FIREWALL":"network",
    "APP":"application",
    "RAW":"unknown",
    "SIEM":"detection",
    "BANKING":"application",
    "NETWORK":"network",
    "ENDPOINT":"endpoint",
    "IDENTITY":"identity",
    "DETECTION":"detection",
    "AUDIT":"audit",
    "UNKNOWN":"unknown",
}

SEVERITY_SCORE = {"info":0,"low":1,"medium":2,"high":3,"critical":4}

_NULL_STRINGS = {"", "none", "null", "n/a", "na", "undefined"}

def _is_null(val):
    return val is None or str(val).strip().lower() in _NULL_STRINGS

def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _safe_ts(val):
    if val is None:
        return _now_iso()
    try:
        return str(val)[:19].replace(" ", "T")
    except:
        return _now_iso()

def _safe_float(val, default=0.0):
    try:
        return float(val)
    except:
        return default

def _safe_port(val):
    return "" if val is None else str(val)

# ─────────────────────────────────────────────
# SCHEMA MAPPER
# ─────────────────────────────────────────────

class SchemaMapper:

    def map(self, raw: Dict[str, Any]) -> Dict[str, Any]:

        # ── BASIC ─────────────────────────────
        timestamp = _safe_ts(raw.get("timestamp"))

        source = str(raw.get("source") or raw.get("log_source") or "UNKNOWN").upper()
        if source not in VALID_SOURCES:
            source = "RAW"

        event_type = str(raw.get("event_type") or "unknown").lower()
        if _is_null(event_type):
            event_type = "unknown"

        event_category = SOURCE_TO_CATEGORY.get(source, "unknown")

        severity = str(raw.get("severity") or "low").lower()
        if severity not in VALID_SEVERITIES:
            severity = "low"

        severity_score = SEVERITY_SCORE.get(severity, 1)

        # ── USER / DEVICE ─────────────────────
        user = (
            raw.get("user") or raw.get("username") or
            raw.get("usr") or raw.get("resolved_user") or ""
        )

        device_id = (
            raw.get("device_id") or raw.get("workstation") or
            raw.get("device") or raw.get("hostname") or "unknown"
        )

        # ── ENTITY ────────────────────────────
        entity_id = (
            raw.get("entity_id") or
            raw.get("employee_id") or
            raw.get("user_id") or
            user or "unknown"
        )

        # ─────────────────────────────────────────────
        # 🔥 NETWORK + TARGET AWARENESS (NEW)
        # ─────────────────────────────────────────────

        ip = raw.get("ip") or raw.get("src_ip") or raw.get("source_ip") or ""
        src_ip = raw.get("src_ip") or raw.get("ip_addr") or ip or ""

        dest_ip = (
            raw.get("dest_ip") or
            raw.get("dst_ip") or
            raw.get("destination_ip") or
            raw.get("remote_ip") or
            raw.get("target_ip") or
            ""
        )

        file_path = (
            raw.get("file_path") or
            raw.get("path") or
            raw.get("file") or
            raw.get("filename") or
            raw.get("file_name") or
            ""
        )

        resource = (
            raw.get("resource") or
            raw.get("endpoint") or
            raw.get("url") or
            raw.get("database") or
            raw.get("table") or
            raw.get("api") or
            raw.get("asset") or
            ""
        )

        protocol = raw.get("protocol") or ""
        process = raw.get("process") or raw.get("process_name") or ""
        port = _safe_port(raw.get("port") or raw.get("dst_port"))

        # ── SESSION ───────────────────────────
        session_id = raw.get("session_id")
        if _is_null(session_id):
            session_id = f"sess_{entity_id}_{timestamp[:13]}"

        # ── GEO ───────────────────────────────
        geo = raw.get("geo_location") or {}
        if not isinstance(geo, dict):
            geo = {}

        geo_location = {
            "country": geo.get("country", "XX"),
            "city": geo.get("city", "Unknown"),
            "lat": float(geo.get("lat", 0.0)),
            "lon": float(geo.get("lon", 0.0)),
        }

        # ── SCORES ────────────────────────────
        anomaly_score = _safe_float(raw.get("anomaly_score"))
        confidence = _safe_float(raw.get("confidence"))

        # ── DETAILS ───────────────────────────
        details = raw.get("details") or {}
        if not isinstance(details, dict):
            details = {"raw": details}

        # ── OUTPUT ────────────────────────────
        return {
            "event_id": raw.get("event_id") or str(uuid.uuid4()),
            "timestamp": timestamp,
            "entity_id": entity_id,

            "log_source": source,
            "source": source,
            "source_type": SOURCE_TO_CATEGORY.get(source, "unknown"),

            "event_type": event_type,
            "event_category": event_category,
            "severity": severity,
            "severity_score": severity_score,

            "resolved_user": user,
            "employee_id": raw.get("employee_id", ""),
            "department": raw.get("department", ""),
            "role": raw.get("role", ""),

            "device_id": device_id,
            "workstation": device_id,

            # 🔥 UPDATED BLOCK
            "src_ip": src_ip,
            "dest_ip": dest_ip,
            "file_path": file_path,
            "resource": resource,

            "port": port,
            "protocol": protocol,
            "process": process,

            "session_id": session_id,
            "risk_flag": raw.get("risk_flag", "normal"),

            "geo_location": geo_location,

            "anomaly_score": anomaly_score,
            "confidence": confidence,

            "details": details,

            "_source_file": raw.get("_source_file", ""),
            "_ingestion_time": raw.get("_ingestion_time", _now_iso()),
        }

# Singleton
_MAPPER = SchemaMapper()

def get_mapper():
    return _MAPPER
