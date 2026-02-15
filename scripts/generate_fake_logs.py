import json
import random
from datetime import datetime, timedelta
from pathlib import Path

# Output file
OUTPUT_FILE = Path("data/raw_logs/demo_logs.json")

# Ensure folder exists
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

users = [
    {"id": "emp_101", "country": "India"},
    {"id": "emp_102", "country": "India"},
    {"id": "emp_103", "country": "India"},
    {"id": "emp_104", "country": "India"},
]

servers = ["core-banking", "swift-terminal", "loan-db", "auth-server"]

normal_ips = ["10.0.0.2", "10.0.0.5", "10.0.0.7"]
suspicious_ips = ["185.220.101.1", "203.0.113.45"]

events = []

start_time = datetime.now()

for i in range(200):

    user = random.choice(users)

    # Random time progression
    timestamp = start_time + timedelta(minutes=i)

    # 90% normal, 10% suspicious
    if random.random() < 0.9:
        event = {
            "timestamp": timestamp.isoformat(),
            "user_id": user["id"],
            "action": random.choice(["login_success", "view_account", "export_report"]),
            "server": random.choice(servers),
            "ip": random.choice(normal_ips),
            "risk_flag": "normal"
        }
    else:
        # Suspicious event
        event = {
            "timestamp": timestamp.isoformat(),
            "user_id": user["id"],
            "action": random.choice([
                "login_failed",
                "powershell_execution",
                "data_download",
                "privilege_escalation"
            ]),
            "server": random.choice(servers),
            "ip": random.choice(suspicious_ips),
            "risk_flag": "suspicious"
        }

    events.append(event)

# Write logs
with open(OUTPUT_FILE, "w") as f:
    json.dump(events, f, indent=2)

print(f"✅ Fake logs generated at: {OUTPUT_FILE}")