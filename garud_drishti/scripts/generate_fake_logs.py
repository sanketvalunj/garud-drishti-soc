"""
CRYPTIX - GARUD-DRISHTI
generate_fake_logs.py

Generates 5 types of synthetic security logs:
  1. IAM Logs
  2. SIEM Logs
  3. Firewall/Network Logs
  4. EDR Logs
  5. Banking Transaction Logs

All logs share: entity_id, resolved_user, src_ip, session_id
for full pipeline correlation: Ingestion → UEBA → Correlation → Playbook
"""

import json
import random
import hashlib
import uuid
from datetime import datetime, timedelta
from pathlib import Path

# ─────────────────────────────────────────
# OUTPUT PATHS
# ─────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR  = BASE_DIR / "data" / "raw_logs"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SEED = 42
random.seed(SEED)

# ─────────────────────────────────────────
# FIX 1: EVENT CATEGORY MAP
# Required for ES queries, dashboards, detection rules
# ─────────────────────────────────────────

CATEGORY_MAP = {
    # IAM
    "LOGIN_SUCCESS"        : "authentication",
    "LOGIN_FAILURE"        : "authentication",
    "LOGOUT"               : "authentication",
    "PRIVILEGE_CHANGE"     : "identity",
    "PASSWORD_RESET"       : "identity",
    # SIEM
    "ALERT"                : "detection",
    "USER_ACTIVITY"        : "audit",
    # Firewall
    "CONNECTION_ALLOWED"   : "network",
    "CONNECTION_DENIED"    : "network",
    "PORT_SCAN"            : "network",
    "LARGE_DATA_TRANSFER"  : "network",
    # EDR
    "PROCESS_EXECUTION"    : "endpoint",
    "MALICIOUS_PROCESS"    : "endpoint",
    "FILE_ACCESS"          : "endpoint",
    "REGISTRY_MODIFICATION": "endpoint",
    "USB_INSERT"           : "endpoint",
    # Banking
    "TRANSACTION"          : "application",
    "LARGE_TRANSACTION"    : "application",
    "TRANSACTION_FAILED"   : "application",
}

# ─────────────────────────────────────────
# FIX 2: SEVERITY NORMALIZATION
# Numeric score for UEBA weighting + risk scoring
# ─────────────────────────────────────────

SEVERITY_SCORE = {
    "INFO"    : 0,
    "LOW"     : 1,
    "MEDIUM"  : 2,
    "HIGH"    : 3,
    "CRITICAL": 4,
}

# ─────────────────────────────────────────
# FIX 5: SOURCE TYPE MAP
# Helps downstream routing in ingestion layer
# ─────────────────────────────────────────

SOURCE_TYPE_MAP = {
    "IAM"     : "identity",
    "SIEM"    : "detection",
    "FIREWALL": "network",
    "EDR"     : "endpoint",
    "BANKING" : "application",
}

# ─────────────────────────────────────────
# MASTER IDENTITY TABLE  (20 users)
# entity_id + assigned_ip NEVER changes per user
# This is the anchor for cross-log correlation
# ─────────────────────────────────────────

USERS = [
    {"entity_id":"ENT-001","name":"john.doe",      "employee_id":"EMP-101","banking_user_id":"USR-101","workstation":"WS-FIN-01",  "assigned_ip":"192.168.1.101","dept":"Finance",   "role":"analyst",       "normal_hours":(9,18)},
    {"entity_id":"ENT-002","name":"sara.khan",     "employee_id":"EMP-102","banking_user_id":"USR-102","workstation":"WS-IT-02",   "assigned_ip":"192.168.1.102","dept":"IT",        "role":"engineer",      "normal_hours":(8,17)},
    {"entity_id":"ENT-003","name":"mike.ross",     "employee_id":"EMP-103","banking_user_id":"USR-103","workstation":"WS-OPS-03",  "assigned_ip":"192.168.1.103","dept":"Operations","role":"manager",       "normal_hours":(9,18)},
    {"entity_id":"ENT-004","name":"priya.sharma",  "employee_id":"EMP-104","banking_user_id":"USR-104","workstation":"WS-FIN-04",  "assigned_ip":"192.168.1.104","dept":"Finance",   "role":"analyst",       "normal_hours":(9,18)},
    {"entity_id":"ENT-005","name":"alex.turner",   "employee_id":"EMP-105","banking_user_id":"USR-105","workstation":"WS-SEC-05",  "assigned_ip":"192.168.1.105","dept":"Security",  "role":"soc_analyst",   "normal_hours":(7,16)},
    {"entity_id":"ENT-006","name":"neha.verma",    "employee_id":"EMP-106","banking_user_id":"USR-106","workstation":"WS-HR-06",   "assigned_ip":"192.168.1.106","dept":"HR",        "role":"hr_manager",    "normal_hours":(9,18)},
    {"entity_id":"ENT-007","name":"raj.patel",     "employee_id":"EMP-107","banking_user_id":"USR-107","workstation":"WS-IT-07",   "assigned_ip":"192.168.1.107","dept":"IT",        "role":"sysadmin",      "normal_hours":(8,20)},
    {"entity_id":"ENT-008","name":"emily.clark",   "employee_id":"EMP-108","banking_user_id":"USR-108","workstation":"WS-LEG-08",  "assigned_ip":"192.168.1.108","dept":"Legal",     "role":"legal_counsel", "normal_hours":(9,18)},
    {"entity_id":"ENT-009","name":"david.lee",     "employee_id":"EMP-109","banking_user_id":"USR-109","workstation":"WS-FIN-09",  "assigned_ip":"192.168.1.109","dept":"Finance",   "role":"trader",        "normal_hours":(7,16)},
    {"entity_id":"ENT-010","name":"fatima.ali",    "employee_id":"EMP-110","banking_user_id":"USR-110","workstation":"WS-OPS-10",  "assigned_ip":"192.168.1.110","dept":"Operations","role":"analyst",       "normal_hours":(9,18)},
    {"entity_id":"ENT-011","name":"chris.brown",   "employee_id":"EMP-111","banking_user_id":"USR-111","workstation":"WS-IT-11",   "assigned_ip":"192.168.1.111","dept":"IT",        "role":"devops",        "normal_hours":(8,17)},
    {"entity_id":"ENT-012","name":"ananya.iyer",   "employee_id":"EMP-112","banking_user_id":"USR-112","workstation":"WS-FIN-12",  "assigned_ip":"192.168.1.112","dept":"Finance",   "role":"auditor",       "normal_hours":(9,18)},
    {"entity_id":"ENT-013","name":"tom.hardy",     "employee_id":"EMP-113","banking_user_id":"USR-113","workstation":"WS-NET-13",  "assigned_ip":"192.168.1.113","dept":"Network",   "role":"netadmin",      "normal_hours":(8,17)},
    {"entity_id":"ENT-014","name":"sonia.mehta",   "employee_id":"EMP-114","banking_user_id":"USR-114","workstation":"WS-CUS-14",  "assigned_ip":"192.168.1.114","dept":"Customer",  "role":"support",       "normal_hours":(9,18)},
    {"entity_id":"ENT-015","name":"kevin.james",   "employee_id":"EMP-115","banking_user_id":"USR-115","workstation":"WS-FIN-15",  "assigned_ip":"192.168.1.115","dept":"Finance",   "role":"analyst",       "normal_hours":(9,18)},
    {"entity_id":"ENT-016","name":"lena.schmidt",  "employee_id":"EMP-116","banking_user_id":"USR-116","workstation":"WS-DEV-16",  "assigned_ip":"192.168.1.116","dept":"Dev",       "role":"developer",     "normal_hours":(9,18)},
    {"entity_id":"ENT-017","name":"omar.sheikh",   "employee_id":"EMP-117","banking_user_id":"USR-117","workstation":"WS-SEC-17",  "assigned_ip":"192.168.1.117","dept":"Security",  "role":"pen_tester",    "normal_hours":(8,17)},
    {"entity_id":"ENT-018","name":"jessica.wu",    "employee_id":"EMP-118","banking_user_id":"USR-118","workstation":"WS-MKT-18",  "assigned_ip":"192.168.1.118","dept":"Marketing", "role":"analyst",       "normal_hours":(9,18)},
    {"entity_id":"ENT-019","name":"admin.sys",     "employee_id":"EMP-119","banking_user_id":"USR-119","workstation":"WS-ADM-19",  "assigned_ip":"192.168.1.119","dept":"IT",        "role":"superadmin",    "normal_hours":(0,23)},
    {"entity_id":"ENT-020","name":"service.bot",   "employee_id":"EMP-120","banking_user_id":"USR-120","workstation":"WS-SVC-20",  "assigned_ip":"192.168.1.120","dept":"Automation","role":"service_account","normal_hours":(0,23)},
]

# ─────────────────────────────────────────
# 20 SERVERS
# ─────────────────────────────────────────

SERVERS = [
    {"name":"core-banking",      "ip":"10.0.0.1",  "criticality":"critical"},
    {"name":"auth-server",       "ip":"10.0.0.2",  "criticality":"critical"},
    {"name":"payment-gateway",   "ip":"10.0.0.3",  "criticality":"critical"},
    {"name":"customer-db",       "ip":"10.0.0.4",  "criticality":"high"},
    {"name":"fraud-engine",      "ip":"10.0.0.5",  "criticality":"high"},
    {"name":"loan-db",           "ip":"10.0.0.6",  "criticality":"high"},
    {"name":"swift-terminal",    "ip":"10.0.0.7",  "criticality":"critical"},
    {"name":"audit-log-server",  "ip":"10.0.0.8",  "criticality":"high"},
    {"name":"hr-portal",         "ip":"10.0.0.9",  "criticality":"medium"},
    {"name":"intranet-portal",   "ip":"10.0.0.10", "criticality":"medium"},
    {"name":"email-server",      "ip":"10.0.0.11", "criticality":"medium"},
    {"name":"backup-server",     "ip":"10.0.0.12", "criticality":"high"},
    {"name":"dev-server",        "ip":"10.0.0.13", "criticality":"low"},
    {"name":"staging-server",    "ip":"10.0.0.14", "criticality":"low"},
    {"name":"vpn-gateway",       "ip":"10.0.0.15", "criticality":"high"},
    {"name":"siem-server",       "ip":"10.0.0.16", "criticality":"critical"},
    {"name":"edr-console",       "ip":"10.0.0.17", "criticality":"high"},
    {"name":"file-server",       "ip":"10.0.0.18", "criticality":"medium"},
    {"name":"monitoring-server", "ip":"10.0.0.19", "criticality":"medium"},
    {"name":"external-api-gw",   "ip":"10.0.0.20", "criticality":"high"},
]

# ─────────────────────────────────────────
# 20 DEVICES
# ─────────────────────────────────────────

DEVICES = [
    "workstation_finance_01","workstation_finance_02",
    "workstation_it_01","workstation_it_02",
    "workstation_ops_01","workstation_sec_01",
    "laptop_remote_01","laptop_remote_02",
    "atm_terminal_01","atm_terminal_02",
    "mobile_app_ios","mobile_app_android",
    "internal_api_client","external_api_client",
    "kiosk_branch_01","kiosk_branch_02",
    "server_process_01","server_process_02",
    "unknown_device","contractor_laptop_01",
]

# ─────────────────────────────────────────
# EXTERNAL ATTACKER IPs (for anomaly injection)
# ─────────────────────────────────────────

EXTERNAL_IPS = [
    "203.0.113.5","198.51.100.22","185.220.101.45",
    "91.108.4.100","45.33.32.156","104.21.14.9",
    "178.62.195.10","23.111.8.100"
]

# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def make_session_id(user: dict, base_time: datetime, window_minutes: int = 15) -> str:
    """Deterministic session ID: same user + same 15-min window = same session."""
    slot = int(base_time.timestamp() // (window_minutes * 60))
    key  = f"{user['entity_id']}_{slot}"
    return "SES-" + hashlib.md5(key.encode()).hexdigest()[:12].upper()

def jitter(ts: datetime, max_seconds: int = 300) -> datetime:
    return ts + timedelta(seconds=random.randint(0, max_seconds))

def normal_ts(user: dict, base_date: datetime) -> datetime:
    """Timestamp within user's normal working hours."""
    h_start, h_end = user["normal_hours"]
    hour   = random.randint(h_start, h_end - 1)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return base_date.replace(hour=hour, minute=minute, second=second, microsecond=0)

def anomaly_ts(base_date: datetime) -> datetime:
    """Timestamp in off-hours (2–5 AM)."""
    hour   = random.randint(2, 5)
    minute = random.randint(0, 59)
    return base_date.replace(hour=hour, minute=minute, second=random.randint(0,59), microsecond=0)

def random_server():
    return random.choice(SERVERS)

def random_device():
    return random.choice(DEVICES)

def fmt(ts: datetime) -> str:
    return ts.isoformat()

# ─────────────────────────────────────────
# BASE SCHEMA BUILDER
# ─────────────────────────────────────────

def base_event(user: dict, ts: datetime, log_source: str, event_type: str,
               session_id: str, src_ip: str = None, severity: str = "LOW") -> dict:
    return {
        "event_id"       : str(uuid.uuid4()),
        "timestamp"      : fmt(ts),
        # FIX 5: source + source_type for downstream routing
        "log_source"     : log_source,
        "source"         : log_source,
        "source_type"    : SOURCE_TYPE_MAP.get(log_source, "unknown"),
        "event_type"     : event_type,
        # FIX 1: event_category for ES queries + detection rules
        "event_category" : CATEGORY_MAP.get(event_type, "unknown"),
        # FIX 2: severity string + numeric score for UEBA weighting
        "severity"       : severity,
        "severity_score" : SEVERITY_SCORE.get(severity, 0),
        "entity_id"      : user["entity_id"],
        "resolved_user"  : user["name"],
        "employee_id"    : user["employee_id"],
        "department"     : user["dept"],
        "role"           : user["role"],
        # FIX 3: device_id explicitly added (ingestion expects this field)
        "device_id"      : user["workstation"],
        "workstation"    : user["workstation"],
        "src_ip"         : src_ip or user["assigned_ip"],
        "session_id"     : session_id,
        "risk_flag"      : "normal",
    }

# ═══════════════════════════════════════════════════════
# 1. IAM LOG GENERATORS
# ═══════════════════════════════════════════════════════

def iam_login_success(user, ts, session_id, src_ip=None):
    e = base_event(user, ts, "IAM", "LOGIN_SUCCESS", session_id, src_ip, severity="LOW")
    e.update({
        "logon_type"      : random.choice(["Interactive","Network","RemoteInteractive"]),
        "auth_method"     : random.choice(["password","mfa","sso","certificate"]),
        "status"          : "success",
        "failure_reason"  : None,
        "mfa_used"        : random.choice([True, False]),
        "geo_country"     : "GB",
        "login_hour"      : ts.hour,
        "night_login"     : 1 if ts.hour < 6 or ts.hour > 22 else 0,
    })
    return e

def iam_login_failure(user, ts, session_id, src_ip=None, reason="Wrong Password"):
    e = base_event(user, ts, "IAM", "LOGIN_FAILURE", session_id, src_ip, severity="MEDIUM")
    e.update({
        "logon_type"      : "Network",
        "auth_method"     : "password",
        "status"          : "failure",
        "failure_reason"  : reason,
        "mfa_used"        : False,
        "geo_country"     : "GB",
        "login_hour"      : ts.hour,
        "night_login"     : 1 if ts.hour < 6 or ts.hour > 22 else 0,
        "risk_flag"       : "suspicious",
    })
    return e

def iam_logout(user, ts, session_id):
    e = base_event(user, ts, "IAM", "LOGOUT", session_id, severity="LOW")
    e.update({"status": "success", "session_duration_min": random.randint(10, 480)})
    return e

def iam_privilege_change(user, ts, session_id, elevated=False):
    e = base_event(user, ts, "IAM", "PRIVILEGE_CHANGE", session_id, severity="HIGH")
    e.update({
        "old_role"    : user["role"],
        "new_role"    : "superadmin" if elevated else user["role"],
        "changed_by"  : "admin.sys" if not elevated else user["name"],
        "status"      : "success",
        "risk_flag"   : "high" if elevated else "normal",
    })
    return e

def iam_password_reset(user, ts, session_id, forced=False):
    e = base_event(user, ts, "IAM", "PASSWORD_RESET", session_id, severity="MEDIUM")
    e.update({"forced": forced, "status": "success",
              "risk_flag": "suspicious" if forced else "normal"})
    return e

# ═══════════════════════════════════════════════════════
# 2. SIEM LOG GENERATORS
# ═══════════════════════════════════════════════════════

def siem_alert(user, ts, session_id, alert_name, severity, count=1, src_ip=None):
    server = random_server()
    e = base_event(user, ts, "SIEM", "ALERT", session_id, src_ip, severity=severity)
    e.update({
        "alert_name"       : alert_name,
        "severity"         : severity,
        "dst_ip"           : server["ip"],
        "dst_server"       : server["name"],
        "asset_criticality": server["criticality"],
        "alert_count"      : count,
        "mitre_tactic"     : None,
        "mitre_technique"  : None,
        "risk_flag"        : "suspicious" if severity in ["HIGH","CRITICAL"] else "normal",
    })
    return e

def siem_normal_activity(user, ts, session_id):
    server = random_server()
    e = base_event(user, ts, "SIEM", "USER_ACTIVITY", session_id, severity="INFO")
    e.update({
        "alert_name"       : "Normal Activity",
        "severity"         : "INFO",
        "dst_ip"           : server["ip"],
        "dst_server"       : server["name"],
        "asset_criticality": server["criticality"],
        "alert_count"      : 1,
    })
    return e

# ═══════════════════════════════════════════════════════
# 3. FIREWALL / NETWORK LOG GENERATORS
# ═══════════════════════════════════════════════════════

def fw_allow(user, ts, session_id, dst_server=None, src_ip=None):
    srv = dst_server or random_server()
    e = base_event(user, ts, "FIREWALL", "CONNECTION_ALLOWED", session_id, src_ip, severity="LOW")
    e.update({
        "dst_ip"           : srv["ip"],
        "dst_server"       : srv["name"],
        "dst_port"         : random.choice([80,443,8080,8443,22,3306,5432]),
        "protocol"         : random.choice(["TCP","UDP"]),
        "action"           : "ALLOW",
        "bytes_sent"       : random.randint(500, 50000),
        "bytes_recv"       : random.randint(500, 50000),
        "duration_ms"      : random.randint(10, 5000),
        "asset_criticality": srv["criticality"],
    })
    return e

def fw_deny(user, ts, session_id, dst_server=None, src_ip=None):
    srv = dst_server or random_server()
    e = base_event(user, ts, "FIREWALL", "CONNECTION_DENIED", session_id, src_ip, severity="MEDIUM")
    e.update({
        "dst_ip"           : srv["ip"],
        "dst_server"       : srv["name"],
        "dst_port"         : random.choice([22,3389,445,1433,3306]),
        "protocol"         : "TCP",
        "action"           : "DENY",
        "bytes_sent"       : 0,
        "bytes_recv"       : 0,
        "duration_ms"      : 0,
        "asset_criticality": srv["criticality"],
        "risk_flag"        : "suspicious",
    })
    return e

def fw_port_scan(user, ts, session_id, src_ip=None):
    e = base_event(user, ts, "FIREWALL", "PORT_SCAN", session_id, src_ip, severity="HIGH")
    ports = random.sample([22,23,80,443,445,1433,3306,3389,5432,8080], 8)
    e.update({
        "dst_ip"           : "10.0.0.0/24",
        "scanned_ports"    : ports,
        "scan_count"       : len(ports),
        "protocol"         : "TCP",
        "action"           : "ALERT",
        "risk_flag"        : "high",
    })
    return e

def fw_large_transfer(user, ts, session_id, src_ip=None):
    e = base_event(user, ts, "FIREWALL", "LARGE_DATA_TRANSFER", session_id, src_ip, severity="HIGH")
    e.update({
        "dst_ip"      : random.choice(EXTERNAL_IPS),
        "dst_port"    : 443,
        "protocol"    : "TCP",
        "action"      : "ALLOW",
        "bytes_sent"  : random.randint(50_000_000, 500_000_000),
        "bytes_recv"  : random.randint(1000, 5000),
        "duration_ms" : random.randint(30000, 120000),
        "risk_flag"   : "high",
    })
    return e

# ═══════════════════════════════════════════════════════
# 4. EDR LOG GENERATORS
# ═══════════════════════════════════════════════════════

def edr_process_normal(user, ts, session_id):
    e = base_event(user, ts, "EDR", "PROCESS_EXECUTION", session_id, severity="LOW")
    proc = random.choice(["chrome.exe","outlook.exe","excel.exe","notepad.exe","teams.exe"])
    e.update({
        "process_name"  : proc,
        "parent_process": "explorer.exe",
        "command_line"  : proc,
        "process_hash"  : hashlib.md5(proc.encode()).hexdigest(),
        "device"        : user["workstation"],
        "severity"      : "LOW",
        "is_signed"     : True,
    })
    return e

def edr_malicious_process(user, ts, session_id, proc_name, parent="cmd.exe", cmd=None):
    e = base_event(user, ts, "EDR", "MALICIOUS_PROCESS", session_id, severity="CRITICAL")
    e.update({
        "process_name"  : proc_name,
        "parent_process": parent,
        "command_line"  : cmd or proc_name,
        "process_hash"  : hashlib.md5(proc_name.encode()).hexdigest(),
        "device"        : user["workstation"],
        "severity"      : "CRITICAL",
        "is_signed"     : False,
        "risk_flag"     : "high",
    })
    return e

def edr_file_access(user, ts, session_id, file_path, action="READ"):
    e = base_event(user, ts, "EDR", "FILE_ACCESS", session_id, severity="LOW")
    e.update({
        "file_path"   : file_path,
        "file_action" : action,
        "device"      : user["workstation"],
        "severity"    : "MEDIUM" if action in ["WRITE","DELETE"] else "LOW",
        "risk_flag"   : "suspicious" if action == "DELETE" else "normal",
    })
    return e

def edr_registry_change(user, ts, session_id, elevated=False):
    e = base_event(user, ts, "EDR", "REGISTRY_MODIFICATION", session_id, severity="HIGH")
    e.update({
        "registry_key" : r"HKLM\Software\Microsoft\Windows\CurrentVersion\Run",
        "action"       : "SET",
        "device"       : user["workstation"],
        "severity"     : "HIGH" if elevated else "MEDIUM",
        "risk_flag"    : "high" if elevated else "normal",
    })
    return e

def edr_usb_insert(user, ts, session_id):
    e = base_event(user, ts, "EDR", "USB_INSERT", session_id, severity="MEDIUM")
    e.update({
        "device_name" : f"USB-{uuid.uuid4().hex[:6].upper()}",
        "device_type" : "Mass Storage",
        "severity"    : "MEDIUM",
        "risk_flag"   : "suspicious",
    })
    return e

# ═══════════════════════════════════════════════════════
# 5. BANKING TRANSACTION LOG GENERATORS
# ═══════════════════════════════════════════════════════

def banking_normal_txn(user, ts, session_id):
    e = base_event(user, ts, "BANKING", "TRANSACTION", session_id, severity="LOW")
    e.update({
        "transaction_id"  : "TXN-" + uuid.uuid4().hex[:8].upper(),
        "banking_user_id" : user["banking_user_id"],
        "txn_type"        : random.choice(["TRANSFER","PAYMENT","WITHDRAWAL","DEPOSIT"]),
        "amount"          : round(random.uniform(10, 5000), 2),
        "currency"        : "GBP",
        "src_account"     : f"ACC-{user['employee_id']}",
        "dst_account"     : f"ACC-{random.randint(1000,9999)}",
        "channel"         : random.choice(["online","branch","atm","mobile"]),
        "is_anomalous"    : False,
        "is_fraud"        : False,
        "country"         : "GB",
    })
    return e

def banking_large_txn(user, ts, session_id, amount=None, dst_country="NG"):
    e = base_event(user, ts, "BANKING", "LARGE_TRANSACTION", session_id, severity="CRITICAL")
    e.update({
        "transaction_id"  : "TXN-" + uuid.uuid4().hex[:8].upper(),
        "banking_user_id" : user["banking_user_id"],
        "txn_type"        : "TRANSFER",
        "amount"          : amount or round(random.uniform(50000, 150000), 2),
        "currency"        : "GBP",
        "src_account"     : f"ACC-{user['employee_id']}",
        "dst_account"     : f"ACC-EXT-{random.randint(9000,9999)}",
        "channel"         : "online",
        "is_anomalous"    : True,
        "is_fraud"        : True,
        "country"         : dst_country,
        "risk_flag"       : "high",
    })
    return e

def banking_failed_txn(user, ts, session_id, reason="Insufficient Funds"):
    e = base_event(user, ts, "BANKING", "TRANSACTION_FAILED", session_id, severity="MEDIUM")
    e.update({
        "transaction_id"  : "TXN-" + uuid.uuid4().hex[:8].upper(),
        "banking_user_id" : user["banking_user_id"],
        "txn_type"        : "TRANSFER",
        "amount"          : round(random.uniform(1000, 20000), 2),
        "currency"        : "GBP",
        "failure_reason"  : reason,
        "is_anomalous"    : False,
        "is_fraud"        : False,
        "country"         : "GB",
    })
    return e

# ═══════════════════════════════════════════════════════
# NORMAL BASELINE GENERATOR (8 days, all users)
# ═══════════════════════════════════════════════════════

def generate_normal_baseline(base_date: datetime, days: int = 8):
    iam_logs, siem_logs, fw_logs, edr_logs, banking_logs = [], [], [], [], []

    for user in USERS:
        for day_offset in range(days):
            day = base_date - timedelta(days=day_offset)

            # Skip service account & admin for normal variation
            if user["role"] in ("service_account",) and day_offset % 2 != 0:
                continue

            # 3–8 sessions per day per user
            session_count = random.randint(3, 8)

            for _ in range(session_count):
                ts = normal_ts(user, day)
                sid = make_session_id(user, ts)

                # IAM
                iam_logs.append(iam_login_success(user, ts, sid))
                if random.random() < 0.15:  # 15% chance of prior failure
                    fail_ts = ts - timedelta(seconds=random.randint(30, 300))
                    iam_logs.append(iam_login_failure(user, fail_ts, sid))
                iam_logs.append(iam_logout(user, ts + timedelta(hours=random.randint(1,4)), sid))

                # SIEM
                siem_logs.append(siem_normal_activity(user, jitter(ts, 60), sid))

                # Firewall
                for _ in range(random.randint(2, 6)):
                    fw_logs.append(fw_allow(user, jitter(ts, 600), sid))

                # EDR
                for _ in range(random.randint(2, 5)):
                    edr_logs.append(edr_process_normal(user, jitter(ts, 600), sid))
                if random.random() < 0.2:
                    edr_logs.append(edr_file_access(user, jitter(ts, 300), sid,
                                                    f"/data/{user['dept'].lower()}/report_{day.date()}.xlsx"))

                # Banking (Finance/Ops only + service)
                if user["dept"] in ("Finance","Operations","Automation"):
                    for _ in range(random.randint(1, 4)):
                        banking_logs.append(banking_normal_txn(user, jitter(ts, 600), sid))
                    if random.random() < 0.1:
                        banking_logs.append(banking_failed_txn(user, jitter(ts, 200), sid))

    return iam_logs, siem_logs, fw_logs, edr_logs, banking_logs

# ═══════════════════════════════════════════════════════
# ATTACK SCENARIO GENERATORS
# ═══════════════════════════════════════════════════════

def scenario_brute_force_to_exfil(base_date: datetime, victim_index: int = 3):
    """
    Full attack chain for Vishvesh's correlation:
    Brute Force → Login Success → Port Scan → Cred Dump →
    Privilege Escalation → Lateral Movement → Data Exfil → Large Banking Transfer
    """
    iam, siem, fw, edr, bank = [], [], [], [], []
    user   = USERS[victim_index]
    atk_ip = random.choice(EXTERNAL_IPS)
    ts     = anomaly_ts(base_date)

    # All events share ONE session_id for easy correlation
    sid = make_session_id(user, ts)

    # Step 1: Brute force (7 failures)
    for i in range(7):
        t = ts + timedelta(seconds=i * 15)
        iam.append(iam_login_failure(user, t, sid, src_ip=atk_ip,
                                     reason="Wrong Password"))
        siem.append(siem_alert(user, t, sid, "Multiple Failed Logins", "HIGH",
                                count=i+1, src_ip=atk_ip))

    # Step 2: Login success (brute force cracked)
    ts2 = ts + timedelta(minutes=3)
    sid2 = make_session_id(user, ts2)
    iam.append(iam_login_success(user, ts2, sid2, src_ip=atk_ip))
    siem.append(siem_alert(user, ts2, sid2, "Successful Login After Failures", "HIGH",
                            src_ip=atk_ip))

    # Step 3: Port scan
    ts3 = ts2 + timedelta(minutes=2)
    fw.append(fw_port_scan(user, ts3, sid2, src_ip=atk_ip))
    siem.append(siem_alert(user, ts3, sid2, "Port Scan Detected", "HIGH",
                            src_ip=atk_ip))

    # Step 4: Credential dumping
    ts4 = ts3 + timedelta(minutes=2)
    edr.append(edr_malicious_process(user, ts4, sid2,
        proc_name="mimikatz.exe",
        parent="cmd.exe",
        cmd="mimikatz privilege::debug sekurlsa::logonpasswords"))
    siem.append(siem_alert(user, ts4, sid2, "Credential Dumping Tool Detected", "CRITICAL",
                            src_ip=atk_ip))

    # Step 5: Registry persistence
    ts5 = ts4 + timedelta(minutes=1)
    edr.append(edr_registry_change(user, ts5, sid2, elevated=True))

    # Step 6: Privilege escalation
    ts6 = ts5 + timedelta(minutes=1)
    iam.append(iam_privilege_change(user, ts6, sid2, elevated=True))
    siem.append(siem_alert(user, ts6, sid2, "Privilege Escalation Detected", "CRITICAL",
                            src_ip=atk_ip))

    # Step 7: Lateral movement (access 4 critical servers)
    for srv in [SERVERS[0], SERVERS[2], SERVERS[6], SERVERS[3]]:
        ts7 = ts6 + timedelta(seconds=random.randint(30, 120))
        fw.append(fw_allow(user, ts7, sid2, dst_server=srv, src_ip=atk_ip))
        siem.append(siem_alert(user, ts7, sid2,
                                f"Lateral Movement to {srv['name']}", "HIGH",
                                src_ip=atk_ip))
        edr.append(edr_file_access(user, ts7 + timedelta(seconds=10), sid2,
                                    f"/{srv['name']}/sensitive_data.db", action="READ"))

    # Step 8: Data exfiltration
    ts8 = ts6 + timedelta(minutes=5)
    edr.append(edr_file_access(user, ts8, sid2,
                                "/customer-db/customer_records_ALL.csv", action="READ"))
    fw.append(fw_large_transfer(user, ts8 + timedelta(seconds=30), sid2, src_ip=atk_ip))
    siem.append(siem_alert(user, ts8, sid2, "Large Data Exfiltration Detected",
                            "CRITICAL", src_ip=atk_ip))
    edr.append(edr_usb_insert(user, ts8 + timedelta(minutes=1), sid2))

    # Step 9: Large banking transfer (fraud)
    ts9 = ts8 + timedelta(minutes=2)
    bank.append(banking_large_txn(user, ts9, sid2, amount=98500.00, dst_country="NG"))
    siem.append(siem_alert(user, ts9, sid2, "Anomalous Banking Transaction", "CRITICAL",
                            src_ip=atk_ip))

    return iam, siem, fw, edr, bank


def scenario_insider_threat(base_date: datetime, insider_index: int = 8):
    """
    Insider (finance trader) accessing HR and customer DB outside normal hours.
    """
    iam, siem, fw, edr, bank = [], [], [], [], []
    user = USERS[insider_index]
    ts   = anomaly_ts(base_date)
    sid  = make_session_id(user, ts)

    # Login at 3 AM
    iam.append(iam_login_success(user, ts, sid))
    siem.append(siem_alert(user, ts, sid, "After-Hours Login Detected", "MEDIUM"))

    # Access HR portal (not their dept)
    ts2 = ts + timedelta(minutes=5)
    hr_server = SERVERS[8]  # hr-portal
    fw.append(fw_allow(user, ts2, sid, dst_server=hr_server))
    edr.append(edr_file_access(user, ts2 + timedelta(seconds=20), sid,
                                "/hr-portal/employee_salaries.xlsx", action="READ"))
    siem.append(siem_alert(user, ts2, sid, "Unauthorized Resource Access", "HIGH"))

    # Access customer DB
    ts3 = ts2 + timedelta(minutes=3)
    cust_server = SERVERS[3]
    fw.append(fw_allow(user, ts3, sid, dst_server=cust_server))
    edr.append(edr_file_access(user, ts3 + timedelta(seconds=15), sid,
                                "/customer-db/vip_customers.csv", action="READ"))

    # Small fraudulent transfers (structuring)
    for i in range(5):
        t = ts3 + timedelta(minutes=i*2)
        bank.append(banking_large_txn(user, t, sid,
                                       amount=round(random.uniform(9000, 9999), 2),
                                       dst_country="AE"))

    return iam, siem, fw, edr, bank


def scenario_ransomware(base_date: datetime, victim_index: int = 1):
    """
    Ransomware: phishing → macro → file encryption loop → C2 beacon
    """
    iam, siem, fw, edr, bank = [], [], [], [], []
    user = USERS[victim_index]
    ts   = base_date.replace(hour=10, minute=15, second=0)  # daytime — more realistic
    sid  = make_session_id(user, ts)

    # Phishing email opened (SIEM alert)
    siem.append(siem_alert(user, ts, sid, "Phishing Email Opened", "MEDIUM"))

    # Malicious macro execution
    ts2 = ts + timedelta(minutes=2)
    edr.append(edr_malicious_process(user, ts2, sid,
        proc_name="WINWORD.EXE",
        parent="explorer.exe",
        cmd="WINWORD.EXE /q /dde 'cmd /c powershell -enc <base64>'"))
    edr.append(edr_malicious_process(user, ts2 + timedelta(seconds=10), sid,
        proc_name="powershell.exe",
        parent="WINWORD.EXE",
        cmd="powershell -enc aQBlAHgA..."))

    # Registry persistence
    edr.append(edr_registry_change(user, ts2 + timedelta(seconds=30), sid, elevated=True))

    # File encryption (ransomware loop)
    for i in range(10):
        t = ts2 + timedelta(seconds=i * 5)
        edr.append(edr_file_access(user, t, sid,
                                    f"/documents/file_{i:04d}.docx", action="WRITE"))

    # C2 beacon (outbound to external IP)
    ts3 = ts2 + timedelta(minutes=3)
    fw.append(fw_large_transfer(user, ts3, sid))
    siem.append(siem_alert(user, ts3, sid, "C2 Beacon Detected", "CRITICAL"))
    siem.append(siem_alert(user, ts3 + timedelta(seconds=30), sid,
                            "Ransomware File Encryption Detected", "CRITICAL"))

    return iam, siem, fw, edr, bank


def scenario_service_account_abuse(base_date: datetime):
    """
    Service account performing human-like actions — impossible travel + human hours
    """
    iam, siem, fw, edr, bank = [], [], [], [], []
    user = USERS[19]  # service.bot
    ts   = anomaly_ts(base_date)
    sid  = make_session_id(user, ts)

    # Login from unexpected external IP
    ext_ip = random.choice(EXTERNAL_IPS)
    iam.append(iam_login_success(user, ts, sid, src_ip=ext_ip))
    siem.append(siem_alert(user, ts, sid, "Service Account Human-Like Login", "HIGH",
                            src_ip=ext_ip))

    # Accessing core banking
    ts2 = ts + timedelta(minutes=2)
    fw.append(fw_allow(user, ts2, sid, dst_server=SERVERS[0], src_ip=ext_ip))
    edr.append(edr_malicious_process(user, ts2 + timedelta(seconds=10), sid,
        proc_name="python.exe",
        parent="bash",
        cmd="python exfil_script.py --target core-banking --out /tmp/dump.json"))
    siem.append(siem_alert(user, ts2, sid, "Service Account Anomalous Behavior", "CRITICAL",
                            src_ip=ext_ip))

    return iam, siem, fw, edr, bank

# ═══════════════════════════════════════════════════════
# EDGE CASES
# ═══════════════════════════════════════════════════════

def generate_edge_cases(base_date: datetime):
    """
    Edge cases to stress test UEBA + correlation:
    - Rapid sequential logins from different IPs (impossible travel)
    - Shared IP (two users same IP - NAT scenario)
    - Zero-byte transfers
    - Null/missing optional fields
    - Very long session
    - Same user rapid session switches
    """
    iam, siem, fw, edr, bank = [], [], [], [], []

    # Edge 1: Impossible travel (same user, 2 IPs, 1 minute apart)
    user = USERS[5]
    ts   = base_date.replace(hour=14, minute=0, second=0)
    sid1 = make_session_id(user, ts)
    sid2 = make_session_id(user, ts + timedelta(minutes=2))
    iam.append(iam_login_success(user, ts, sid1, src_ip="192.168.1.106"))
    iam.append(iam_login_success(user, ts + timedelta(minutes=1), sid2,
                                  src_ip="185.220.101.45"))  # external IP 1 min later
    siem.append(siem_alert(user, ts + timedelta(minutes=1), sid2,
                            "Impossible Travel Detected", "HIGH",
                            src_ip="185.220.101.45"))

    # Edge 2: Shared NAT IP (two different users, same external IP)
    for u in [USERS[2], USERS[4]]:
        ts_nat = base_date.replace(hour=11, minute=30)
        sid_nat = make_session_id(u, ts_nat)
        iam.append(iam_login_success(u, ts_nat, sid_nat, src_ip="10.0.0.254"))

    # Edge 3: Very high frequency banking (100 txns in 10 min — structuring)
    user3 = USERS[9]
    ts3   = base_date.replace(hour=16, minute=0)
    sid3  = make_session_id(user3, ts3)
    for i in range(20):
        t = ts3 + timedelta(seconds=i * 30)
        bank.append(banking_normal_txn(user3, t, sid3))
    siem.append(siem_alert(user3, ts3, sid3, "High Frequency Transactions", "HIGH"))

    # Edge 4: Failed login then immediate success then large transfer
    user4 = USERS[14]
    ts4   = base_date.replace(hour=3, minute=30)
    sid4  = make_session_id(user4, ts4)
    iam.append(iam_login_failure(user4, ts4, sid4, reason="Account Locked"))
    iam.append(iam_password_reset(user4, ts4 + timedelta(minutes=1), sid4, forced=True))
    iam.append(iam_login_success(user4, ts4 + timedelta(minutes=2), sid4))
    bank.append(banking_large_txn(user4, ts4 + timedelta(minutes=3), sid4, amount=75000.00))

    # Edge 5: USB insert on critical server workstation
    user5 = USERS[0]
    ts5   = base_date.replace(hour=23, minute=45)
    sid5  = make_session_id(user5, ts5)
    edr.append(edr_usb_insert(user5, ts5, sid5))
    siem.append(siem_alert(user5, ts5, sid5, "USB Device on Critical Asset", "HIGH"))

    return iam, siem, fw, edr, bank

# ═══════════════════════════════════════════════════════
# MAIN GENERATION PIPELINE
# ═══════════════════════════════════════════════════════

def main():
    base_date = datetime.now().replace(microsecond=0)
    print("🔄 Generating CRYPTIX synthetic logs...")

    all_iam, all_siem, all_fw, all_edr, all_bank = [], [], [], [], []

    # 1. Normal baseline (8 days)
    print("  ✅ Baseline logs (8 days × 20 users)...")
    b = generate_normal_baseline(base_date, days=8)
    all_iam += b[0]; all_siem += b[1]; all_fw += b[2]; all_edr += b[3]; all_bank += b[4]

    # 2. Attack scenario: Brute force → full exfil (3 different victims)
    for victim_idx in [3, 9, 14]:
        print(f"  ✅ Attack: Brute Force → Exfil (victim: {USERS[victim_idx]['name']})...")
        a = scenario_brute_force_to_exfil(base_date, victim_index=victim_idx)
        all_iam += a[0]; all_siem += a[1]; all_fw += a[2]; all_edr += a[3]; all_bank += a[4]

    # 3. Insider threat (2 insiders)
    for insider_idx in [8, 15]:
        print(f"  ✅ Attack: Insider Threat (user: {USERS[insider_idx]['name']})...")
        a = scenario_insider_threat(base_date, insider_index=insider_idx)
        all_iam += a[0]; all_siem += a[1]; all_fw += a[2]; all_edr += a[3]; all_bank += a[4]

    # 4. Ransomware (2 victims)
    for v in [1, 11]:
        print(f"  ✅ Attack: Ransomware (victim: {USERS[v]['name']})...")
        a = scenario_ransomware(base_date, victim_index=v)
        all_iam += a[0]; all_siem += a[1]; all_fw += a[2]; all_edr += a[3]; all_bank += a[4]

    # 5. Service account abuse
    print("  ✅ Attack: Service Account Abuse...")
    a = scenario_service_account_abuse(base_date)
    all_iam += a[0]; all_siem += a[1]; all_fw += a[2]; all_edr += a[3]; all_bank += a[4]

    # 6. Edge cases
    print("  ✅ Edge cases (impossible travel, NAT, structuring, forced reset)...")
    a = generate_edge_cases(base_date)
    all_iam += a[0]; all_siem += a[1]; all_fw += a[2]; all_edr += a[3]; all_bank += a[4]

    # Sort all logs by timestamp
    for lst in [all_iam, all_siem, all_fw, all_edr, all_bank]:
        lst.sort(key=lambda x: x["timestamp"])

    # ─── SAVE INDIVIDUAL FILES ───
    files = {
        "iam_logs.json"     : all_iam,
        "siem_logs.json"    : all_siem,
        "firewall_logs.json": all_fw,
        "edr_logs.json"     : all_edr,
        "banking_logs.json" : all_bank,
    }

    for fname, data in files.items():
        path = OUT_DIR / fname
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"  💾 {fname}: {len(data):,} events → {path}")

    # ─── SAVE UNIFIED FILE (for ingestion pipeline) ───
    all_logs = all_iam + all_siem + all_fw + all_edr + all_bank
    all_logs.sort(key=lambda x: x["timestamp"])
    unified_path = OUT_DIR / "demo_logs.json"
    with open(unified_path, "w") as f:
        json.dump(all_logs, f, indent=2)

    # ─── SAVE MASTER ENTITY TABLE ───
    entity_path = OUT_DIR / "entity_master.json"
    with open(entity_path, "w") as f:
        json.dump(USERS, f, indent=2)

    print(f"\n{'─'*55}")
    print(f"  📦 TOTAL EVENTS GENERATED: {len(all_logs):,}")
    print(f"     IAM      : {len(all_iam):,}")
    print(f"     SIEM     : {len(all_siem):,}")
    print(f"     Firewall : {len(all_fw):,}")
    print(f"     EDR      : {len(all_edr):,}")
    print(f"     Banking  : {len(all_bank):,}")
    print(f"{'─'*55}")
    print(f"  🗂  Unified  : {unified_path}")
    print(f"  👥 Entities : {entity_path}")
    print(f"  📁 Directory: {OUT_DIR}")
    print(f"{'─'*55}")
    print("✅ Done. Pipeline-ready for UEBA → Correlation → Playbook.")


if __name__ == "__main__":
    main()
