import json
import pandas as pd
import os

# ensure output directory exists
os.makedirs("data/model_features", exist_ok=True)

# load logs
with open("data/raw_logs/demo_logs.json") as f:
    logs = json.load(f)

df = pd.DataFrame(logs)

print("Columns detected:", df.columns)

# convert timestamp
df["timestamp"] = pd.to_datetime(df["timestamp"])

# extract hour
df["hour"] = df["timestamp"].dt.hour

# default columns if missing (prevents crashes)
if "status" not in df.columns:
    df["status"] = "success"

if "device" not in df.columns:
    df["device"] = "unknown"

if "asset_criticality" not in df.columns:
    df["asset_criticality"] = "low"

# detect failures
df["failed_event"] = df["status"].apply(lambda x: 1 if x == "failed" else 0)

# detect logins
df["login_event"] = df["action"].apply(lambda x: 1 if "login" in x else 0)

# detect downloads
df["download_event"] = df["action"].apply(lambda x: 1 if "download" in x else 0)

# night activity
df["night_activity"] = df["hour"].apply(lambda x: 1 if x < 6 else 0)

# critical asset access
df["critical_asset"] = df["asset_criticality"].apply(
    lambda x: 1 if x == "high" else 0
)

# group by user behavior
features = df.groupby("user_id").agg(
    total_events=("action", "count"),
    failed_events=("failed_event", "sum"),
    login_events=("login_event", "sum"),
    downloads=("download_event", "sum"),
    unique_ips=("ip", "nunique"),
    unique_servers=("server", "nunique"),
    unique_devices=("device", "nunique"),
    night_activity=("night_activity", "sum"),
    critical_asset_access=("critical_asset", "sum"),
    avg_hour=("hour", "mean")
).reset_index()

# ratio feature
features["failure_ratio"] = features["failed_events"] / features["total_events"]

# save features
features.to_csv("data/model_features/features.csv", index=False)

print("\nFeature extraction completed.")
print(features.head())