from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import subprocess

# ---- import new routers ----
from garud_drishti.backend.api.ingest_api import router as ingest_router
from garud_drishti.backend.api.detection_api import router as detection_router
from garud_drishti.backend.api.incident_api import router as incident_router
from garud_drishti.backend.api.playbook_api import router as playbook_router


app = FastAPI(title="Garud Drishti SOC")

# -------------------------------------------------
# ENABLE CORS (dashboard needs this)
# -------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# REGISTER NEW ARCHITECTURE ROUTERS
# -------------------------------------------------
app.include_router(ingest_router)
app.include_router(detection_router)
app.include_router(incident_router)
app.include_router(playbook_router)

# -------------------------------------------------
# FILE PATHS (old endpoints still use these)
# -------------------------------------------------
INCIDENT_FILE = Path("data/incident_records/incidents.json")
PLAYBOOK_FILE = Path("data/incident_records/playbooks.json")

# -------------------------------------------------
# BASIC HEALTH CHECK
# -------------------------------------------------
@app.get("/")
def home():
    return {"status": "Garud Drishti running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# -------------------------------------------------
# GET INCIDENTS (used by dashboard)
# -------------------------------------------------
@app.get("/incidents")
def get_incidents():
    if not INCIDENT_FILE.exists():
        return {"message": "No incidents generated yet"}

    with open(INCIDENT_FILE, "r") as f:
        data = json.load(f)

    return {"total": len(data), "incidents": data}

# -------------------------------------------------
# GET PLAYBOOKS (used by dashboard)
# -------------------------------------------------
@app.get("/playbooks")
def get_playbooks():
    if not PLAYBOOK_FILE.exists():
        return {"message": "No playbooks generated yet"}

    with open(PLAYBOOK_FILE, "r") as f:
        data = json.load(f)

    return {"total": len(data), "playbooks": data}

# -------------------------------------------------
# RUN OLD SCRIPT PIPELINE (fallback option)
# -------------------------------------------------
@app.post("/run-pipeline")
def run_pipeline():
    """
    Executes legacy script-based pipeline.
    Useful as fallback if SOC orchestration endpoint fails.
    """
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