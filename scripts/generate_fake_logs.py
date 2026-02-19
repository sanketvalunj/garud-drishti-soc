import json
import random
from datetime import datetime, timedelta
from pathlib import Path

OUT = Path("data/raw_logs/demo_logs.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

sources = ["SIEM", "EDR", "AUTH", "NET", "BANK"]

users = ["emp_101", "emp_102", "emp_103", "emp_104"]
servers = ["auth-server", "loan-db", "core-banking", "swift-terminal"]

actions = [
    "login_success",
    "login_failed",
    "powershell_execution",
    "data_download",
    "export_report",
    "privilege_escalation"
]

ips = [
    "10.0.0.2",
    "10.0.0.5",
    "203.0.113.45",
    "185.220.101.1"
]

logs = []
base = datetime.now()

for i in range(200):

    action = random.choice(actions)

    log = {
        "timestamp": (base + timedelta(seconds=i*20)).isoformat(),
        "user_id": random.choice(users),
        "server": random.choice(servers),
        "ip": random.choice(ips),
        "action": action,
        "risk_flag": "suspicious" if action in [
            "powershell_execution",
            "data_download",
            "privilege_escalation"
        ] else "normal",
        "source": random.choice(sources)
    }

    logs.append(log)

with open(OUT, "w") as f:
    json.dump(logs, f, indent=2)

print(f"✅ Generated {len(logs)} multi-source SOC logs at {OUT}")
