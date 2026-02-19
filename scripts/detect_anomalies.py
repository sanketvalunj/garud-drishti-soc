import pandas as pd
from pathlib import Path
from pyod.models.iforest import IForest

FEATURE_FILE = Path("data/model_features/features.csv")
OUTPUT_FILE = Path("data/incident_records/anomaly_results.csv")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# ----------------------------
# Load features
# ----------------------------
df = pd.read_csv(FEATURE_FILE)

if df.empty:
    raise ValueError("Feature file is empty")

# Keep numeric matrix only (safer for model)
X = df.select_dtypes(include=["number"]).copy()

if X.empty:
    raise ValueError("No numeric features found for anomaly detection")

# ----------------------------
# Train Isolation Forest
# ----------------------------
model = IForest(contamination=0.1, random_state=42)
model.fit(X)

# ----------------------------
# Predict anomalies
# ----------------------------
scores = model.decision_scores_
labels = model.predict(X)   # 1 = anomaly, 0 = normal

# Attach results AFTER prediction
df["anomaly_score"] = scores
df["is_anomaly"] = labels

# ----------------------------
# SAFETY: ensure at least some anomalies exist
# (prevents demo showing 0 incidents)
# ----------------------------
if df["is_anomaly"].sum() == 0:
    print("⚠️ No anomalies detected — forcing top 5 as anomalies for demo")
    top_idx = df["anomaly_score"].nlargest(5).index
    df.loc[top_idx, "is_anomaly"] = 1

# ----------------------------
# Save results
# ----------------------------
df.to_csv(OUTPUT_FILE, index=False)

print("✅ Anomaly detection completed")
print(f"Results saved to: {OUTPUT_FILE}")

print("\nTop suspicious rows:")
print(
    df.sort_values("anomaly_score", ascending=False)
      .head(5)
      [["anomaly_score", "is_anomaly"]]
)
