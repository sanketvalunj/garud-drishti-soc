"""
CRYPTIX — GARUD-DRISHTI
scripts/extract_features.py

INPUT:
 garud_drishti/data/normalized_events/normalized_events.json

OUTPUT:
 garud_drishti/data/processed/features.csv

GOAL:
 Convert normalized SOC events → ML-ready UEBA features
 + TARGET AWARENESS + CORRELATION CONTEXT
"""

import json
import pandas as pd
from pathlib import Path

# Dynamic path resolution for cross-platform compatibility
BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_PATH = BASE_DIR / "garud_drishti" / "data" / "normalized_events" / "normalized_events.json"
OUTPUT_PATH = BASE_DIR / "garud_drishti" / "data" / "processed" / "features.csv"

# ─────────────────────────────────────────
# LOAD
# ─────────────────────────────────────────
def load_events(path):
    with open(path, "r") as f:
        return json.load(f)

# ─────────────────────────────────────────
# PREPROCESS
# ─────────────────────────────────────────
def preprocess(events):
    df = pd.DataFrame(events)

    required_cols = [
        "timestamp", "event_type", "event_category",
        "severity", "severity_score",
        "entity_id", "resolved_user",
        "src_ip", "session_id",
        "dest_ip", "file_path", "resource"
    ]

    for col in required_cols:
        if col not in df.columns:
            df[col] = None

    # timestamp
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])

    # remove duplicates
    df = df.drop_duplicates(subset=[
        "entity_id", "timestamp", "event_type", "src_ip"
    ])

    return df

# ─────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────
def build_features(df):

    # ── TIME ──
    df["hour"] = df["timestamp"].dt.hour
    df["is_night"] = df["hour"].apply(lambda x: 1 if x < 6 or x > 22 else 0)

    # ── FREQUENCY ──
    df["user_event_count"] = df.groupby("entity_id")["entity_id"].transform("count")
    df["session_event_count"] = df.groupby("session_id")["session_id"].transform("count")

    # ── SEVERITY ──
    df["high_severity_flag"] = df["severity"].apply(
        lambda x: 1 if str(x).upper() in ["HIGH", "CRITICAL"] else 0
    )

    # ============================================================
    # 🔥 IMPOSSIBLE TRAVEL
    # ============================================================
    df = df.sort_values(by=["entity_id", "timestamp"])

    df["prev_ip"] = df.groupby("entity_id")["src_ip"].shift(1)
    df["prev_time"] = df.groupby("entity_id")["timestamp"].shift(1)

    df["time_diff"] = (df["timestamp"] - df["prev_time"]).dt.total_seconds()
    df["ip_changed"] = (df["src_ip"] != df["prev_ip"]).astype(int)

    df["impossible_travel_flag"] = df.apply(
        lambda x: 1 if (
            x["ip_changed"] == 1 and
            pd.notnull(x["time_diff"]) and
            x["time_diff"] < 3600
        ) else 0,
        axis=1
    )

    # ============================================================
    # 🔥 DATA EXFILTRATION
    # ============================================================
    SENSITIVE_EVENTS = [
        "DATA_EXPORT",
        "FILE_ACCESS",
        "DATABASE_QUERY",
        "TRANSACTION",
        "LARGE_TRANSACTION"
    ]

    df["sensitive_action_flag"] = df["event_type"].apply(
        lambda x: 1 if str(x).upper() in SENSITIVE_EVENTS else 0
    )

    df["data_exfiltration_risk"] = (
        df["sensitive_action_flag"] * df["high_severity_flag"]
    )

    df["user_sensitive_activity"] = df.groupby("entity_id")["sensitive_action_flag"].transform("sum")

    df["heavy_data_user_flag"] = df["user_sensitive_activity"].apply(
        lambda x: 1 if x > 50 else 0
    )

    # ============================================================
    # 🔥 TARGET AWARENESS (CRITICAL FIX)
    # ============================================================
    df["has_dest_ip"] = df["dest_ip"].notna().astype(int)
    df["file_access_flag"] = df["file_path"].notna().astype(int)
    df["resource_access_flag"] = df["resource"].notna().astype(int)

    df["target_activity_score"] = (
        df["has_dest_ip"] +
        df["file_access_flag"] +
        df["resource_access_flag"]
    )

    # ============================================================
    # ENCODING
    # ============================================================
    df["event_type_encoded"] = df["event_type"].astype("category").cat.codes
    df["category_encoded"] = df["event_category"].astype("category").cat.codes

    return df

# ─────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────
def save_features(df, path):

    os.makedirs(os.path.dirname(path), exist_ok=True)

    cols = [
        # context
        "entity_id", "timestamp", "session_id",
        "src_ip", "dest_ip", "file_path", "resource",
        "event_type", "event_category", "severity",

        # features
        "hour", "is_night",
        "user_event_count", "session_event_count",
        "severity_score", "high_severity_flag",

        "ip_changed", "impossible_travel_flag",

        "sensitive_action_flag",
        "data_exfiltration_risk",
        "heavy_data_user_flag",

        # 🔥 NEW
        "has_dest_ip",
        "file_access_flag",
        "resource_access_flag",
        "target_activity_score",

        "event_type_encoded",
        "category_encoded"
    ]

    cols = [c for c in cols if c in df.columns]

    df[cols].to_csv(path, index=False)

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def run():

    print("\n" + "="*50)
    print("🚀 FEATURE ENGINEERING PIPELINE")
    print("="*50)

    events = load_events(INPUT_PATH)
    print(f"📥 Loaded {len(events)} raw events")

    df = preprocess(events)
    print(f"🧹 After cleaning: {len(df)} events")

    df = build_features(df)
    print("🧠 Features generated (UEBA ready)")

    save_features(df, OUTPUT_PATH)
    print(f"💾 Saved → {OUTPUT_PATH}")

    print("\n✅ READY FOR ANOMALY DETECTION\n")

# ─────────────────────────────────────────
if __name__ == "__main__":
    run()
