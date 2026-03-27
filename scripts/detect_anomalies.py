"""
CRYPTIX — GARUD-DRISHTI
scripts/detect_anomalies.py

FINAL VERSION:
 Single output → correlation-ready UEBA events
"""
import os
import json
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Dynamic path resolution for cross-platform compatibility
BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_PATH = BASE_DIR / "garud_drishti" / "data" / "processed" / "features.csv"
OUTPUT_PATH = BASE_DIR / "garud_drishti" / "data" / "processed" / "anomaly_events.json"


# ─────────────────────────────────────────
# LOAD
# ─────────────────────────────────────────
def load_data(path):
    """Load features from CSV with path validation."""
    print("📥 Loading features...")
    
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")
    
    df = pd.read_csv(path)
    print(f"✅ Loaded {len(df)} records")
    return df


# ─────────────────────────────────────────
# FEATURE SELECTION
# ─────────────────────────────────────────
def select_features(df):

    print("🧠 Selecting ML features...")

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

    print(f"📊 Using {len(feature_cols)} features")

    X = df[feature_cols].fillna(0)

    return X, feature_cols


# ─────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────
def train_model(X):

    print("🤖 Training IsolationForest model...")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=150,
        contamination=0.05,
        random_state=42
    )

    model.fit(X_scaled)

    scores = -model.score_samples(X_scaled)

    # normalize
    denom = scores.max() - scores.min()
    if denom == 0:
        scores = np.full(len(scores), 0.5)
    else:
        scores = (scores - scores.min()) / denom

    print("✅ Model training complete")

    return scores


# ─────────────────────────────────────────
# RULE-BASED RISK
# ─────────────────────────────────────────
def compute_rule_risk(df):

    print("📏 Computing rule-based risk signals...")

    risk = np.zeros(len(df))

    risk += df["impossible_travel_flag"] * 0.25
    risk += df["data_exfiltration_risk"] * 0.3
    risk += df["target_activity_score"] * 0.1
    risk += df["high_severity_flag"] * 0.15
    risk += df["heavy_data_user_flag"] * 0.2

    return np.clip(risk, 0, 1)


# ─────────────────────────────────────────
# FINAL SCORE
# ─────────────────────────────────────────
def combine_scores(ml_scores, rule_scores):

    print("⚖️ Combining ML + rule-based scores...")

    final = (0.7 * ml_scores) + (0.3 * rule_scores)

    return np.clip(final, 0, 1)


# ─────────────────────────────────────────
# SAFE JSON
# ─────────────────────────────────────────
def safe(val):
    if pd.isna(val) or val == "":
        return None
    return val


# ─────────────────────────────────────────
# EXPLANATION ENGINE
# ─────────────────────────────────────────
def generate_reason(row):

    reasons = []

    if row.get("impossible_travel_flag", 0) == 1:
        reasons.append("Impossible travel")

    if row.get("data_exfiltration_risk", 0) == 1:
        reasons.append("Data exfiltration")

    if row.get("high_severity_flag", 0) == 1:
        reasons.append("High severity")

    if row.get("target_activity_score", 0) >= 2:
        reasons.append("Targeted system access")

    if row.get("heavy_data_user_flag", 0) == 1:
        reasons.append("High data usage")

    return " | ".join(reasons) if reasons else "Normal"


# ─────────────────────────────────────────
# BUILD FINAL OUTPUT
# ─────────────────────────────────────────
def build_output(df, scores):

    print("🧩 Building correlation-ready events...")

    output = []

    for i, row in df.iterrows():

        event = {
            # ── IDENTITY ──
            "entity_id": row["entity_id"],
            "timestamp": safe(row.get("timestamp")),
            "session_id": safe(row.get("session_id")),

            # ── NETWORK ──
            "src_ip": safe(row.get("src_ip")),
            "dest_ip": safe(row.get("dest_ip")),

            # ── TARGET CONTEXT ──
            "target": {
                "dest_ip": safe(row.get("dest_ip")),
                "file_path": safe(row.get("file_path")),
                "resource": safe(row.get("resource")),
                "has_target": int(row.get("target_activity_score", 0) > 0)
            },

            # ── EVENT ──
            "event_type": row["event_type"],
            "event_category": row["event_category"],
            "severity": row["severity"],

            # ── RISK ──
            "risk_score": round(float(scores[i]), 4),

            # ── FLAGS ──
            "flags": {
                "impossible_travel": int(row.get("impossible_travel_flag", 0)),
                "data_exfiltration": int(row.get("data_exfiltration_risk", 0)),
                "high_severity": int(row.get("high_severity_flag", 0)),
                "target_activity": int(row.get("target_activity_score", 0)),
            },

            # ── ANALYSIS ──
            "analysis": generate_reason(row),

            # ── CONTEXT FOR CORRELATION ──
            "context": {
                "hour": int(row.get("hour", 0)),
                "user_event_count": int(row.get("user_event_count", 0)),
                "session_event_count": int(row.get("session_event_count", 0))
            }
        }

        output.append(event)

    print(f"✅ Built {len(output)} anomaly events")

    return output


# ─────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────
def save_output(data, path):

    print("💾 Saving output...")

    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"✅ Saved → {path}")


# ─────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────
def run():

    print("\n" + "="*60)
    print("🚀 GARUD-DRISHTI UEBA ANOMALY ENGINE")
    print("="*60)

    df = load_data(INPUT_PATH)

    X, feature_cols = select_features(df)

    ml_scores = train_model(X)
    rule_scores = compute_rule_risk(df)

    final_scores = combine_scores(ml_scores, rule_scores)

    output = build_output(df, final_scores)

    save_output(output, OUTPUT_PATH)

    print("\n🎯 Pipeline Complete — Ready for Correlation Engine")


# ─────────────────────────────────────────
if __name__ == "__main__":
    run()
