import json
import random
from datetime import datetime, timedelta
from pathlib import Path

OUT = Path("data/raw_logs/fake_logs.json")
OUT.parent.mkdir(parents=True, exist_ok=True)

sources = ["SIEM", "EDR", "AUTH", "NET", "BANK"]

users = ["user1", "user2", "admin"]
devices = ["laptop1", "server1", "pc2"]
events = [
    "login_success",
    "login_failed",
    "powershell_exec",
    "file_download",
    "external_connection",
    "privilege_escalation",
    "large_transfer"
]

logs = []
base = datetime.now()

for i in range(100):
    src = random.choice(sources)

    log = {
        "timestamp": (base + timedelta(seconds=i*20)).isoformat(),
        "source": src,
        "user": random.choice(users),
        "device": random.choice(devices),
        "ip": f"192.168.1.{random.randint(1,50)}",
        "event_type": random.choice(events)
    }

    logs.append(log)

with open(OUT, "w") as f:
    json.dump(logs, f, indent=2)

print(f"Generated {len(logs)} multi-source logs")