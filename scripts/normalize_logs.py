import json
from pathlib import Path
from uuid import uuid4

import sys
sys.path.append('.')
from garud_drishti.ingestion import LogParser, SchemaMapper, EventEnricher, SchemaValidator


# -----------------------------
# Paths
# -----------------------------
RAW_FILE = Path("data/raw_logs/demo_logs.json")
OUTPUT_FILE = Path("data/normalized_events/events.json")

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)


# -----------------------------
# Initialize pipeline components
# -----------------------------
parser = LogParser()
mapper = SchemaMapper()
enricher = EventEnricher()
validator = SchemaValidator()


# -----------------------------
# Severity classification
# -----------------------------
def classify_severity(event_type, risk_flag):

    if risk_flag in ["malicious", "critical"]:
        return "critical"

    if risk_flag == "suspicious":
        return "high"

    if event_type in [
        "login_failed",
        "port_scan",
        "privilege_escalation",
        "data_exfiltration"
    ]:
        return "medium"

    return "low"


def severity_score(level):

    scores = {
        "info": 1,
        "low": 2,
        "medium": 3,
        "high": 4,
        "critical": 5
    }

    return scores.get(level, 1)


# -----------------------------
# Load raw logs
# -----------------------------
if not RAW_FILE.exists():
    raise FileNotFoundError(f"Raw log file not found: {RAW_FILE}")

with open(RAW_FILE, "r") as f:
    logs = json.load(f)


# -----------------------------
# Normalize pipeline
# -----------------------------
normalized_events = []
seen_hashes = set()

for raw_log in logs:

    try:

        # Step 1 — Parse raw log
        parsed = parser.parse(raw_log)

        if not parsed:
            continue

        # Step 2 — Schema mapping
        event = mapper.map(parsed)

        # Step 2 - Schema validation
        if not validator.validate(event):
            continue

        if not validator.validate(event):
            continue

        # Step 3 - Enrichment
        event = enricher.enrich(event)

        if not validator.validate(event):
            continue

        # Step 4 - Deduplication
        event_hash = event.get("event_hash")
        if event_hash in seen_hashes:
            continue

        seen_hashes.add(event_hash)

        normalized_events.append(event)

    except Exception as e:
        print("Error processing log:", raw_log)
        print("Reason:", e)


# -----------------------------
# Sort events for timeline
# -----------------------------
normalized_events = sorted(
    normalized_events,
    key=lambda x: x["timestamp"] or ""
)


# -----------------------------
# Write normalized output
# -----------------------------
with open(OUTPUT_FILE, "w") as f:
    json.dump(normalized_events, f, indent=2)


# -----------------------------
# Pipeline stats
# -----------------------------
print("Normalization complete")
print("Output file:", OUTPUT_FILE)
print("Total events:", len(normalized_events))