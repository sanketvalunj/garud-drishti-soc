import pandas as pd
from datetime import datetime, timedelta
import random

events = []

users = ["user1", "user2", "admin"]
devices = ["laptop1", "server1", "pc2"]
event_types = [
    "login_success",
    "login_failed",
    "powershell_exec",
    "file_download",
    "external_connection"
]

base_time = datetime.now()

for i in range(20):
    events.append({
        "timestamp": base_time + timedelta(minutes=i),
        "user": random.choice(users),
        "device": random.choice(devices),
        "ip": f"192.168.1.{random.randint(1,50)}",
        "event_type": random.choice(event_types)
    })

df = pd.DataFrame(events)

df.to_csv("data/normalized_events/events.csv", index=False)

print("✅ Fake normalized events generated")