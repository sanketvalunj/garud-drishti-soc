from fastapi import FastAPI
from pathlib import Path
import json
import subprocess

app = FastAPI(title="Garud Drishti SOC")

INCIDENT_FILE = Path("data/incident_records/incidents.json")
PLAYBOOK_FILE = Path("data/incident_records/playbooks.json")

# -------------------------------------------------
# BASIC HEALTH CHECK
# -------------------------------------------------
@app.get("/")
def home():
    return {"status": "Garud Drishti running"}

# -------------------------------------------------
# GET INCIDENTS
# -------------------------------------------------
@app.get("/incidents")
def get_incidents():
    if not INCIDENT_FILE.exists():
        return {"message": "No incidents generated yet"}

    with open(INCIDENT_FILE, "r") as f:
        data = json.load(f)

    return {"total": len(data), "incidents": data}

# -------------------------------------------------
# GET PLAYBOOKS
# -------------------------------------------------
@app.get("/playbooks")
def get_playbooks():
    if not PLAYBOOK_FILE.exists():
        return {"message": "No playbooks generated yet"}

    with open(PLAYBOOK_FILE, "r") as f:
        data = json.load(f)

    return {"total": len(data), "playbooks": data}

# -------------------------------------------------
# RUN FULL PIPELINE (DEMO MAGIC BUTTON)
# -------------------------------------------------
@app.post("/run-pipeline")
def run_pipeline():

    try:
        subprocess.run(["python", "scripts/generate_fake_logs.py"], check=True)
        subprocess.run(["python", "scripts/normalize_logs.py"], check=True)
        subprocess.run(["python", "scripts/extract_features.py"], check=True)
        subprocess.run(["python", "scripts/detect_anomalies.py"], check=True)
        subprocess.run(["python", "scripts/generate_incidents.py"], check=True)
        subprocess.run(["python", "scripts/generate_playbooks.py"], check=True)

        return {"status": "Pipeline executed successfully"}

    except Exception as e:
        return {"error": str(e)}