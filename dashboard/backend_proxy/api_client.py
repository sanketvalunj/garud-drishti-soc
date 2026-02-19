from fastapi import FastAPI
import requests

app = FastAPI()

BACKEND = "http://localhost:8000"

@app.get("/incidents")
def incidents():
    try:
        r = requests.get(f"{BACKEND}/incidents")
        return r.json()
    except:
        return []

@app.get("/playbooks")
def playbooks():
    try:
        r = requests.get(f"{BACKEND}/playbooks")
        return r.json()
    except:
        return []

@app.get("/health")
def health():
    try:
        r = requests.get(f"{BACKEND}/health")
        return r.json()
    except:
        return {"status":"offline"}

@app.post("/run")
def run_pipeline():
    try:
        r = requests.post(f"{BACKEND}/run-pipeline")
        return r.json()
    except:
        return {"status":"failed"}
