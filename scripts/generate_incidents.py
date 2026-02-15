import pandas as pd
from pathlib import Path
from uuid import uuid4
from datetime import datetime

INPUT_FILE = Path("data/incident_records/anomaly_results.csv")
OUTPUT_FILE = Path("data/incident_records/incidents.json")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# Load anomaly results
df = pd.read_csv(INPUT_FILE)

# Keep only anomalies
anomalies = df[df["is_anomaly"] == 1]

incidents = []

for idx, row in anomalies.iterrows():

    # Assign severity based on anomaly score
    if row["anomaly_score"] > 0.6:
        severity = "high"
    elif row["anomaly_score"] > 0.3:
        severity = "medium"
    else:
        severity = "low"

    incident = {
        "incident_id": str(uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "severity": severity,
        "risk_score": float(row["anomaly_score"]),
        "summary": "Suspicious behavioral activity detected",
        "recommended_action": "Investigate user activity and verify login source",
        "features": {
            "hour": int(row["hour"]),
            "is_weekend": int(row["is_weekend"]),
            "action_code": int(row["action_code"]),
            "severity_score": int(row["severity_score"]),
            "user_activity_count": int(row["user_activity_count"]),
            "asset_access_count": int(row["asset_access_count"])
        }
    }

    incidents.append(incident)

# Save incidents
import json
with open(OUTPUT_FILE, "w") as f:
    json.dump(incidents, f, indent=2)
print("✅ Incidents generated successfully")
print(f"Saved to: {OUTPUT_FILE}")
print(f"Total incidents: {len(incidents)}")