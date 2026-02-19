import json
from pathlib import Path
from uuid import uuid4

RAW_FILE = Path("data/raw_logs/demo_logs.json")
OUTPUT_FILE = Path("data/normalized_events/events.json")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)


def classify_severity(action, risk_flag):
    if risk_flag == "suspicious":
        return "high"
    if action in ["login_failed"]:
        return "medium"
    return "low"


def severity_score(level):
    return {
        "low": 1,
        "medium": 2,
        "high": 3
    }.get(level, 1)


normalized = []

with open(RAW_FILE, "r") as f:
    logs = json.load(f)

for log in logs:

    sev = classify_severity(log["action"], log["risk_flag"])

    event = {
        "event_id": str(uuid4()),
        "timestamp": log["timestamp"],
        "user": log["user_id"],
        "event_type": log["action"],
        "asset": log["server"],
        "source_ip": log["ip"],
        "severity": sev,
        "severity_score": severity_score(sev),
        "risk_flag": log["risk_flag"],     # ← useful later
        "source": log.get("source", "bank_internal"),
        "raw": log
    }

    normalized.append(event)

# Sort chronologically for better correlation
normalized = sorted(normalized, key=lambda x: x["timestamp"])

with open(OUTPUT_FILE, "w") as f:
    json.dump(normalized, f, indent=2)

print(f"✅ Normalized events saved to: {OUTPUT_FILE}")
print(f"Total events: {len(normalized)}")
