import json
import pandas as pd
from pathlib import Path
from datetime import datetime

INPUT_FILE = Path("data/normalized_events/events.json")
OUTPUT_FILE = Path("data/model_features/features.csv")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# Load events
with open(INPUT_FILE, "r") as f:
    events = json.load(f)

df = pd.DataFrame(events)

# Convert timestamp
df["timestamp"] = pd.to_datetime(df["timestamp"])

# ---- FEATURE 1: hour of day ----
df["hour"] = df["timestamp"].dt.hour

# ---- FEATURE 2: weekend flag ----
df["is_weekend"] = df["timestamp"].dt.weekday >= 5

# ---- FEATURE 3: action encoding ----
action_map = {a: i for i, a in enumerate(df["event_type"].unique())}
df["action_code"] = df["event_type"].map(action_map)

# ---- FEATURE 4: severity encoding ----
severity_map = {"low": 1, "medium": 2, "high": 3}
df["severity_score"] = df["severity"].map(severity_map)

# ---- FEATURE 5: user activity count ----
df["user_activity_count"] = df.groupby("user")["event_id"].transform("count")

# ---- FEATURE 6: asset access frequency ----
df["asset_access_count"] = df.groupby("asset")["event_id"].transform("count")

# Select only ML features
features = df[[
    "hour",
    "is_weekend",
    "action_code",
    "severity_score",
    "user_activity_count",
    "asset_access_count"
]]

# Convert boolean to int
features["is_weekend"] = features["is_weekend"].astype(int)

# Save features
features.to_csv(OUTPUT_FILE, index=False)

print(f"✅ Feature matrix saved to: {OUTPUT_FILE}")
print(features.head())