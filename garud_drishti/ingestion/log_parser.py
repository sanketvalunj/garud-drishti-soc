import os
import sys
import json
import random
import logging
import warnings
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("cryptix.log_parser")

# ─────────────────────────────────────────────────────────
# CONFIG (EDIT PATHS HERE)
# ─────────────────────────────────────────────────────────
TRAINING_CSV = "data/raw/UNSW_NB15_training-set.csv"
TESTING_CSV  = "data/raw/UNSW_NB15_testing-set.csv"
OUTPUT_JSON  = "data/processed/normalized_events.json"

OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3"
OLLAMA_TIMEOUT = 30

BASE_TIMESTAMP = datetime(2026, 3, 23, 10, 0, 0)

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# ─────────────────────────────────────────────────────────
# LLM CACHE
# ─────────────────────────────────────────────────────────
LLM_CACHE = {}

# ─────────────────────────────────────────────────────────
# GEO CACHE (FIXED UEBA CONSISTENCY)
# ─────────────────────────────────────────────────────────
USER_GEO = {}

# ─────────────────────────────────────────────────────────
# LABEL MAPS
# ─────────────────────────────────────────────────────────
PROTO_LABELS = {"tcp": "TCP", "udp": "UDP", "icmp": "ICMP", "-": "UNKNOWN"}
SERVICE_LABELS = {"-": "unknown", "http": "HTTP", "dns": "DNS", "ssh": "SSH"}

# ─────────────────────────────────────────────────────────
# LOAD + CLEAN
# ─────────────────────────────────────────────────────────
def load_and_clean(train_path, test_path):
    frames = []

    for path, name in [(train_path, "train"), (test_path, "test")]:
        if os.path.exists(path):
            df = pd.read_csv(path)
            df["_source"] = name
            frames.append(df)
            log.info(f"{name} loaded: {df.shape}")
        else:
            log.warning(f"Missing: {path}")

    if not frames:
        raise Exception("No CSV files found")

    df = pd.concat(frames, ignore_index=True)
    df = df.loc[:, ~df.columns.duplicated()]

    for col in df.select_dtypes(include="object"):
        df[col] = df[col].astype(str).str.strip().replace(
            {"nan": "unknown", "-": "unknown", "": "unknown"}
        )

    for col in df.select_dtypes(include=np.number):
        df[col] = df[col].replace([np.inf, -np.inf], np.nan)
        df[col] = df[col].fillna(df[col].median())

    return df

# ─────────────────────────────────────────────────────────
# FLOW → TEXT
# ─────────────────────────────────────────────────────────
def flow_to_text(row, user_id, ip):
    return (
        f"User {user_id} from IP {ip} initiated a network session. "
        f"Protocol {row.get('proto')} to {row.get('service')}. "
        f"Duration {row.get('dur')} seconds. "
        f"Bytes sent {row.get('sbytes')}, received {row.get('dbytes')}."
    )

# ─────────────────────────────────────────────────────────
# OLLAMA ENRICH (FIXED PARSING)
# ─────────────────────────────────────────────────────────
def _ollama_enrich(text, attack_cat):
    try:
        import urllib.request

        payload = json.dumps({
            "model": OLLAMA_MODEL,
            "prompt": f"Return JSON with mitre_id, threat_type, action:\n{text}",
            "stream": False
        }).encode()

        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )

        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as r:
            out = json.loads(r.read())

        raw = out.get("response", "").strip()

        # ✅ FIX: handle markdown JSON
        if "```" in raw:
            raw = raw.split("```")[1].strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()

        return json.loads(raw)

    except Exception as e:
        log.debug(f"Ollama failed: {e}")
        return {
            "mitre_id": None,
            "threat_type": attack_cat,
            "action": "alert"
        }

# ─────────────────────────────────────────────────────────
# CACHED ENRICH
# ─────────────────────────────────────────────────────────
def cached_enrich(text, attack_cat):
    key = f"{attack_cat.lower()}"   # improved key

    if key in LLM_CACHE:
        return LLM_CACHE[key]

    result = _ollama_enrich(text, attack_cat)
    LLM_CACHE[key] = result
    return result

# ─────────────────────────────────────────────────────────
# ANOMALY DETECTION (FIXED)
# ─────────────────────────────────────────────────────────
def compute_anomaly(df):
    from sklearn.ensemble import IsolationForest

    X = df.select_dtypes(include=np.number).fillna(0)

    model = IsolationForest(
        contamination=0.1,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )

    model.fit(X)

    scores = -model.score_samples(X)

    # ✅ FIX: safe normalization
    denom = (scores.max() - scores.min())
    if denom == 0:
        scores = np.full(len(scores), 0.5)
    else:
        scores = (scores - scores.min()) / denom

    return scores

# ─────────────────────────────────────────────────────────
# IDENTITY
# ─────────────────────────────────────────────────────────
_USER_IP = {}

def assign_identity(i, attack_cat):
    user = f"user_{i % 1000}"

    if user not in _USER_IP:
        _USER_IP[user] = f"10.0.0.{(i % 254)+1}"

    return user, _USER_IP[user], f"device_{i % 200}"

# ─────────────────────────────────────────────────────────
# GEO (FIXED CONSISTENCY)
# ─────────────────────────────────────────────────────────
CITIES = [
    ("Pune", 18.52, 73.85),
    ("Mumbai", 19.07, 72.87),
    ("Delhi", 28.61, 77.20),
    ("Bangalore", 12.97, 77.59),
]

def generate_geo(ip, user):
    if user not in USER_GEO:
        USER_GEO[user] = random.choice(CITIES)

    city = USER_GEO[user]

    return {
        "country": "IN",
        "city": city[0],
        "lat": city[1],
        "lon": city[2]
    }

# ─────────────────────────────────────────────────────────
# CONFIDENCE
# ─────────────────────────────────────────────────────────
def compute_confidence(label, score):
    try:
        label = int(label)
    except:
        return 0.5

    if label == 1:
        return round(0.7 + score * 0.3, 2)

    return round(0.3 * (1 - score), 2)

# ─────────────────────────────────────────────────────────
# BUILD EVENTS (FIXED LOOP)
# ─────────────────────────────────────────────────────────
def build_events(df, scores):
    events = []

    for i, (idx, row) in enumerate(df.iterrows()):   # ✅ FIXED
        user, ip, device = assign_identity(i, row.get("attack_cat", "Normal"))

        delta = random.randint(1, 10)
        ts = BASE_TIMESTAMP + timedelta(seconds=i * delta)

        session_id = f"sess_{user}_{i//10}"

        text = flow_to_text(row, user, ip)
        enrich = cached_enrich(text, row.get("attack_cat", "Normal"))

        event = {
            "timestamp": ts.isoformat() + "Z",
            "event_id": f"evt_{i}",

            "user_id": user,
            "src_ip": ip,
            "device_id": device,
            "session_id": session_id,

            "geo_location": generate_geo(ip, user),

            "event_type": "network_session",
            "protocol": row.get("proto"),
            "resource": row.get("service"),

            "bytes_transferred": int(row.get("sbytes", 0)),
            "bytes_received": int(row.get("dbytes", 0)),

            "session_duration": float(row.get("dur", 0)),

            "attack_category": row.get("attack_cat"),
            "label": int(row.get("label", 0)),

            "mitre_id": enrich.get("mitre_id"),
            "threat_type": enrich.get("threat_type"),
            "action": enrich.get("action"),

            "flow_description": text,

            "anomaly_score": round(scores[i], 4),
            "confidence": compute_confidence(row.get("label"), scores[i]),
        }

        events.append(event)

    return events

# ─────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────
def run_pipeline():
    log.info("START PIPELINE")

    df = load_and_clean(TRAINING_CSV, TESTING_CSV)
    log.info(f"Total rows: {len(df)}")

    scores = compute_anomaly(df)

    events = build_events(df, scores)

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

    with open(OUTPUT_JSON, "w") as f:
        json.dump(events, f, indent=2)

    log.info(f"Saved → {OUTPUT_JSON}")
    log.info("PIPELINE COMPLETE")

# ─────────────────────────────────────────────────────────
# ENTRY
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    run_pipeline()
