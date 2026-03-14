import json
import random
from datetime import datetime, timedelta
from pathlib import Path

# -------------------------------
# PATH CONFIG (FIXED)
# -------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_FILE = BASE_DIR / "data" / "raw_logs" / "demo_logs.json"

OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# -------------------------------
# USERS
# -------------------------------

users = [
    "emp_101","emp_102","emp_103","emp_104",
    "emp_201","emp_202","admin_01"
]

# -------------------------------
# SERVERS
# -------------------------------

servers = [
    "core-banking",
    "payment-gateway",
    "customer-db",
    "fraud-engine",
    "auth-server"
]

# -------------------------------
# DEVICES
# -------------------------------

devices = [
    "workstation_01",
    "workstation_02",
    "atm_terminal",
    "mobile_app",
    "internal_api"
]

sources = ["IAM","EDR","Firewall","SIEM"]

actions = [
    "login_success",
    "login_failed",
    "file_access",
    "file_download",
    "db_query",
    "privilege_escalation",
    "network_connection"
]

logs = []

current_time = datetime.now()

# -------------------------------
# RANDOM IP
# -------------------------------

def random_ip():
    return f"{random.randint(10,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"


# -------------------------------
# NORMAL EVENT
# -------------------------------

def generate_normal_event():

    ts = current_time - timedelta(minutes=random.randint(0,5000))

    return {
        "timestamp": ts.isoformat(),
        "user_id": random.choice(users),
        "server": random.choice(servers),
        "ip": random_ip(),
        "device": random.choice(devices),
        "action": random.choice(actions[:4]),
        "status": random.choice(["success","failed"]),
        "event_type": "user_activity",
        "source": random.choice(sources),
        "asset_criticality": random.choice(["medium","high"]),
        "risk_flag": "normal",

        # UEBA FEATURES
        "login_hour": ts.hour,
        "night_login": 1 if ts.hour < 6 or ts.hour > 22 else 0
    }


# -------------------------------
# BRUTE FORCE
# -------------------------------

def generate_bruteforce():

    ip = random_ip()
    user = random.choice(users)

    events = []

    for _ in range(random.randint(5,10)):

        ts = datetime.now()

        events.append({
            "timestamp": ts.isoformat(),
            "user_id": user,
            "server": "auth-server",
            "ip": ip,
            "device": "unknown",
            "action": "login_failed",
            "status": "failed",
            "event_type": "authentication",
            "source": "IAM",
            "asset_criticality": "high",
            "risk_flag": "suspicious",
            "login_hour": ts.hour,
            "night_login": 1 if ts.hour < 6 or ts.hour > 22 else 0
        })

    return events


# -------------------------------
# LATERAL MOVEMENT
# -------------------------------

def generate_lateral():

    user = random.choice(users)
    ip = random_ip()

    events = []

    for server in servers:

        ts = datetime.now()

        events.append({
            "timestamp": ts.isoformat(),
            "user_id": user,
            "server": server,
            "ip": ip,
            "device": "workstation_02",
            "action": "login_success",
            "status": "success",
            "event_type": "authentication",
            "source": "IAM",
            "asset_criticality": "high",
            "risk_flag": "medium",
            "login_hour": ts.hour,
            "night_login": 1 if ts.hour < 6 or ts.hour > 22 else 0
        })

    return events


# -------------------------------
# PRIVILEGE ESCALATION
# -------------------------------

def privilege_attack():

    ts = datetime.now()

    return [{
        "timestamp": ts.isoformat(),
        "user_id": random.choice(users),
        "server": "core-banking",
        "ip": random_ip(),
        "device": "workstation_01",
        "action": "privilege_escalation",
        "status": "success",
        "event_type": "admin_activity",
        "source": "EDR",
        "asset_criticality": "high",
        "risk_flag": "high",
        "login_hour": ts.hour,
        "night_login": 1 if ts.hour < 6 or ts.hour > 22 else 0
    }]


# -------------------------------
# DATA EXFILTRATION
# -------------------------------

def data_exfil():

    ts = datetime.now()

    return [{
        "timestamp": ts.isoformat(),
        "user_id": random.choice(users),
        "server": "customer-db",
        "ip": random_ip(),
        "device": "workstation_01",
        "action": "file_download",
        "status": "success",
        "event_type": "data_access",
        "source": "SIEM",
        "asset_criticality": "high",
        "risk_flag": "high",
        "login_hour": ts.hour,
        "night_login": 1 if ts.hour < 6 or ts.hour > 22 else 0
    }]


# -------------------------------
# GENERATE DATASET
# -------------------------------

for _ in range(500):
    logs.append(generate_normal_event())

logs.extend(generate_bruteforce())
logs.extend(generate_lateral())
logs.extend(privilege_attack())
logs.extend(data_exfil())

# -------------------------------
# SAVE
# -------------------------------

with open(OUT_FILE,"w") as f:
    json.dump(logs,f,indent=2)

print(f"✅ Generated {len(logs)} realistic banking security logs")
print(f"Saved to: {OUT_FILE}")