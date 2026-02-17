from fastapi import APIRouter
from datetime import datetime

from garud_drishti.backend.utils.json_helpers import load_json

# Storage layer
from garud_drishti.storage import IncidentRepository

# Pipeline layers
from garud_drishti.ingestion.ingestion_api import IngestionService
from garud_drishti.detection import DetectionService
from garud_drishti.correlation.correlation_service import CorrelationService

# Reasoning layer
from garud_drishti.ai_engine.reasoning import (
    IncidentInterpreter,
    MitreMapper,
    RiskExplainer,
)

# Playbook layer
from garud_drishti.ai_engine.playbook import (
    PlaybookGenerator,
    WorkflowBuilder,
    ResponseSelector,
)

# Automation
from garud_drishti.automation.automation_executor import AutomationExecutor

router = APIRouter()


# ---------------------------------------------------
# FULL SOC PIPELINE
# ---------------------------------------------------
@router.post("/generate-playbooks-live")
def generate_live():
    """
    Runs full SOC pipeline:
    ingest → detect → correlate → reason → playbook → automation
    """

    # ---------------------------------------------------
    # 1️⃣ LOAD RAW LOGS
    # ---------------------------------------------------
    raw_logs = load_json("data/raw_logs/fake_logs.json") or []

    ingestion = IngestionService()
    normalized = ingestion.ingest(raw_logs)

    # ---------------------------------------------------
    # 2️⃣ DETECTION
    # ---------------------------------------------------
    detector = DetectionService()
    detected_events = detector.run(normalized)

    # ---------------------------------------------------
    # 3️⃣ CORRELATION
    # ---------------------------------------------------
    correlation = CorrelationService()
    incidents = correlation.build_incidents(detected_events)

    # ensure timestamp exists for dashboard timeline
    now = datetime.utcnow().isoformat()
    for inc in incidents:
        inc.setdefault("timestamp", now)

    # ---------------------------------------------------
    # 4️⃣ REASONING
    # ---------------------------------------------------
    interpreter = IncidentInterpreter()
    mitre = MitreMapper()
    risk_engine = RiskExplainer()

    enriched = []
    for inc in incidents:
        try:
            interp = interpreter.interpret(inc)
            mitre_hits = mitre.map(interp)

            # attach MITRE mapping for dashboard
            inc["mitre"] = mitre_hits

            risk = risk_engine.explain(inc, interp, mitre_hits)
        except Exception:
            inc["mitre"] = []
            risk = {"score": inc.get("fidelity_score", 0)}

        enriched.append((inc, risk))

    # ---------------------------------------------------
    # 5️⃣ PLAYBOOK + WORKFLOW + AUTOMATION
    # ---------------------------------------------------
    generator = PlaybookGenerator()
    selector = ResponseSelector()
    workflow_builder = WorkflowBuilder()
    executor = AutomationExecutor()

    playbooks = []
    automation_reports = []

    for inc, risk in enriched:
        try:
            pb = generator.generate(inc, risk)
        except Exception:
            pb = {
                "steps": [
                    "Review authentication logs",
                    "Check endpoint activity",
                    "Isolate suspicious asset",
                    "Escalate to SOC lead"
                ]
            }

        wf = workflow_builder.build(pb)

        try:
            actions = selector.select_actions(pb)
            report = executor.execute(actions, inc)
        except Exception:
            report = {
                "incident_id": inc["incident_id"],
                "actions_executed": []
            }

        playbooks.append({
            "incident_id": inc["incident_id"],
            "playbook": pb,
            "workflow": wf
        })

        automation_reports.append(report)

    # ---------------------------------------------------
    # 6️⃣ SAVE USING STORAGE LAYER
    # ---------------------------------------------------
    repo = IncidentRepository()

    repo.save_incidents(incidents)
    repo.save_playbooks(playbooks)
    repo.save_automation(automation_reports)

    # return lightweight summary + full objects for dashboard
    return {
        "incidents": len(incidents),
        "playbooks": playbooks,
        "automation": automation_reports
    }


# ---------------------------------------------------
# DASHBOARD FETCH ENDPOINTS (NOW USING REPOSITORY)
# ---------------------------------------------------
@router.get("/automation")
def get_automation():
    repo = IncidentRepository()
    return repo.load_automation()


@router.get("/playbooks")
def get_playbooks():
    repo = IncidentRepository()
    return {"playbooks": repo.load_playbooks()}


@router.get("/incidents")
def get_incidents():
    repo = IncidentRepository()
    data = repo.load_incidents()
    return {"incidents": data, "total": len(data)}