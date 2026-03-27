from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---- import new routers ----
from garud_drishti.backend.api.ingest_api import router as ingest_router
from garud_drishti.backend.api.detection_api import router as detection_router
from garud_drishti.backend.api.incident_api import router as incident_router
from garud_drishti.backend.api.playbook_api import router as playbook_router
from garud_drishti.backend.api.stream_api import router as stream_router
from garud_drishti.backend.api.reasoning_api import router as reasoning_router
from garud_drishti.backend.api.mitre_api import router as mitre_router
from garud_drishti.backend.api.admin_api import router as admin_router
from garud_drishti.backend.api.auth_api import router as auth_router


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
app.include_router(stream_router)
app.include_router(reasoning_router)
app.include_router(mitre_router)
app.include_router(admin_router)
app.include_router(auth_router)

# -------------------------------------------------
# BASIC HEALTH CHECK
# -------------------------------------------------
@app.get("/")
def home():
    return {"status": "Garud Drishti running"}

@app.get("/health")
def health():
    return {"status": "ok"}