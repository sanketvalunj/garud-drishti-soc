"""
CRYPTIX — SHAP EXPLAINER (FINAL FIXED VERSION)
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
import shap
import random

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


print("🔥 FILE STARTED")


# ─────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_PATH = BASE_DIR / "garud_drishti" / "data" / "processed" / "features.csv"
OUTPUT_PATH = BASE_DIR / "garud_drishti" / "data" / "processed" / "shap_explanations.json"


# ─────────────────────────────────────────
# LOAD
# ─────────────────────────────────────────
def load_data():
    print("📥 Loading data...")
    df = pd.read_csv(INPUT_PATH)
    print(f"✅ Loaded {len(df)} rows")
    return df


# ─────────────────────────────────────────
# FEATURES
# ─────────────────────────────────────────
def select_features(df):

    feature_cols = [
        "hour", "is_night",
        "user_event_count", "session_event_count",
        "severity_score", "high_severity_flag",
        "ip_changed", "impossible_travel_flag",
        "sensitive_action_flag", "data_exfiltration_risk",
        "heavy_data_user_flag",
        "has_dest_ip", "file_access_flag",
        "resource_access_flag", "target_activity_score",
        "event_type_encoded", "category_encoded"
    ]

    feature_cols = [c for c in feature_cols if c in df.columns]

    X = df[feature_cols].fillna(0)

    return X, feature_cols


# ─────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────
def train_model(X):

    print("🤖 Training model...")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )

    model.fit(X_scaled)

    return model, X_scaled


# ─────────────────────────────────────────
# SHAP
# ─────────────────────────────────────────
def compute_shap(model, X_scaled):

    print("🔍 Computing SHAP...")

    explainer = shap.Explainer(model, X_scaled)
    shap_values = explainer(X_scaled)

    print("✅ SHAP done")

    return shap_values


# ─────────────────────────────────────────
# 🔥 SUPER SMART SUMMARY (FINAL FIX)
# ─────────────────────────────────────────
def generate_summary(row):

    user = row.get("resolved_user") or row.get("entity_id")
    event = str(row.get("event_type"))

    # 🎯 EVENT BASED VARIATION
    event_map = {
        "login_failure": [
            f"Multiple failed login attempts detected for {user}",
            f"Authentication failures observed for {user}"
        ],
        "login_success": [
            f"Successful login recorded for {user}",
            f"User {user} authenticated successfully"
        ],
        "process_execution": [
            f"Process execution detected on system by {user}",
            f"Program execution activity observed for {user}"
        ],
        "connection_allowed": [
            f"Network connection initiated by {user}",
            f"{user} established connection to another system"
        ],
        "transaction": [
            f"Transaction activity recorded for {user}",
            f"{user} performed a system transaction"
        ],
        "user_activity": [
            f"User activity detected for {user}",
            f"System interaction observed for {user}"
        ]
    }

    base = random.choice(event_map.get(event, [f"Activity detected for {user}"]))

    # 🎯 BEHAVIOR VARIATION
    behavior_options = []

    if row.get("impossible_travel_flag", 0) == 1:
        behavior_options.append("impossible travel detected")

    if row.get("data_exfiltration_risk", 0) == 1:
        behavior_options.append("sensitive data access pattern")

    if row.get("high_severity_flag", 0) == 1:
        behavior_options.append("high privilege action")

    if row.get("has_dest_ip", 0) == 1:
        behavior_options.append("possible lateral movement")

    if row.get("is_night", 0) == 1:
        behavior_options.append("unusual time activity")

    if row.get("target_activity_score", 0) >= 2:
        behavior_options.append("access to multiple critical resources")

    # 🎯 COMBINE (THIS FIXES REPETITION)
    if behavior_options:
        return f"{base} | {random.choice(behavior_options)}"

    return base


# ─────────────────────────────────────────
# BUILD OUTPUT
# ─────────────────────────────────────────
def build_output(df, shap_values, feature_cols):

    print("🧩 Building output...")

    output = []

    for i in range(len(df)):

        row = df.iloc[i]

        event = {
            "entity_id": row.get("entity_id"),
            "timestamp": row.get("timestamp"),
            "event_type": row.get("event_type"),
            "summary": generate_summary(row)
        }

        output.append(event)

    print("✅ Output built")

    return output


# ─────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────
def save_output(data):

    print("💾 Saving file...")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print("✅ Saved at:", OUTPUT_PATH)


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def run():

    print("🚀 RUN STARTED")

    df = load_data()

    X, feature_cols = select_features(df)

    model, X_scaled = train_model(X)

    shap_values = compute_shap(model, X_scaled)

    output = build_output(df, shap_values, feature_cols)

    save_output(output)

    print("\n🎯 DONE — CHECK JSON FILE")


if __name__ == "__main__":
    run()