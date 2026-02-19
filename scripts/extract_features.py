import json
import pandas as pd
from pathlib import Path

INPUT_FILE = Path("data/normalized_events/events.json")
OUTPUT_FILE = Path("data/model_features/features.csv")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# -----------------------------
# Load events
# -----------------------------
with open(INPUT_FILE, "r") as f:
    events = json.load(f)

if not events:
    raise ValueError("No normalized events found")

df = pd.DataFrame(events)

# Preserve row order index for alignment
df["row_id"] = range(len(df))

# Convert timestamp safely
df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

# -----------------------------
# FEATURE 1: hour of day
# -----------------------------
df["hour"] = df["timestamp"].dt.hour.fillna(0)

# -----------------------------
# FEATURE 2: weekend flag
# -----------------------------
df["is_weekend"] = (df["timestamp"].dt.weekday >= 5).fillna(False).astype(int)

# -----------------------------
# FEATURE 3: action encoding (stable mapping)
# -----------------------------
unique_actions = sorted(df["event_type"].dropna().unique())
action_map = {a: i for i, a in enumerate(unique_actions)}
df["action_code"] = df["event_type"].map(action_map).fillna(0)

# -----------------------------
# FEATURE 4: severity encoding
# -----------------------------
severity_map = {"low": 1, "medium": 2, "high": 3}
df["severity_score"] = df["severity"].map(severity_map).fillna(1)

# -----------------------------
# FEATURE 5: user activity count
# -----------------------------
df["user_activity_count"] = df.groupby("user")["event_id"].transform("count").fillna(1)

# -----------------------------
# FEATURE 6: asset access frequency
# -----------------------------
df["asset_access_count"] = df.groupby("asset")["event_id"].transform("count").fillna(1)

# -----------------------------
# Build feature matrix
# -----------------------------
features = df[[
    "hour",
    "is_weekend",
    "action_code",
    "severity_score",
    "user_activity_count",
    "asset_access_count"
]].copy()

# Ensure numeric types
features = features.astype({
    "hour": "int",
    "is_weekend": "int",
    "action_code": "int",
    "severity_score": "int",
    "user_activity_count": "int",
    "asset_access_count": "int"
})

# -----------------------------
# Save features
# -----------------------------
features.to_csv(OUTPUT_FILE, index=False)

print(f"✅ Feature matrix saved to: {OUTPUT_FILE}")
print(features.head())
