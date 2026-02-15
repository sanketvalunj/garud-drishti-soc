import pandas as pd
from pathlib import Path
from pyod.models.iforest import IForest

FEATURE_FILE = Path("data/model_features/features.csv")
OUTPUT_FILE = Path("data/incident_records/anomaly_results.csv")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

# Load features
df = pd.read_csv(FEATURE_FILE)

# ---- IMPORTANT: keep feature matrix separate ----
X = df.copy()   # this is what model sees

# Train model
model = IForest(contamination=0.1)
model.fit(X)

# Predictions ONLY on feature matrix
scores = model.decision_scores_
labels = model.predict(X)  # 1 = anomaly, 0 = normal

# Attach results AFTER prediction
df["anomaly_score"] = scores
df["is_anomaly"] = labels

# Save
df.to_csv(OUTPUT_FILE, index=False)

print("✅ Anomaly detection completed")
print(f"Results saved to: {OUTPUT_FILE}")
print("\nTop suspicious rows:")
print(df.sort_values("anomaly_score", ascending=False).head())