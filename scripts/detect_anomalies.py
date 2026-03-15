import pandas as pd
import os
from pyod.models.iforest import IForest

# ensure output folder exists
os.makedirs("data/incident_records", exist_ok=True)

# load features
df = pd.read_csv("data/model_features/features.csv")

# select ML features
X = df.drop(columns=["user_id"])

# build anomaly model
model = IForest(
    contamination=0.05,
    n_estimators=200,
    random_state=42
)

model.fit(X)

# anomaly score
scores = model.decision_function(X)

df["anomaly_score"] = scores
df["is_anomaly"] = model.predict(X)

# save results
df.to_csv("data/incident_records/anomaly_results.csv", index=False)

print("Anomaly detection completed")
print(df.head())