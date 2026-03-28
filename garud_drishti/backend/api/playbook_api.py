from fastapi import APIRouter
from datetime import datetime, timezone

from garud_drishti.backend.utils.json_helpers import load_json

# Storage layer
from garud_drishti.storage import IncidentRepository

# Pipeline layers
from garud_drishti.ingestion.ingestion_api import IngestionService
from garud_drishti.detectiontemp import DetectionService
from garud_drishti.correlation_engine.correlation_service import CorrelationService

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
            ent = inc.get("entity") if isinstance(inc.get("entity"), dict) else {}
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            sip = str(ent.get("src_ip") or "").strip()
            uid = str(ent.get("user_id") or ent.get("entity_key") or "").strip()
            row_a = {
                "timestamp": ts,
                "event_type": "ingest.correlation",
                "event_category": "detection",
                "severity": str(inc.get("severity") or "medium"),
                "src_ip": sip or None,
                "resolved_user": uid or None,
                "session_id": ent.get("session_id"),
                "analysis": f"Ingest pipeline batch; context score={risk.get('score')}.",
            }
            row_b = {
                **row_a,
                "event_type": "ingest.summary",
                "analysis": "Secondary sample row for minimum playbook context.",
            }
            threat_ctx = {"risk_score": risk.get("score"), "batch_pipeline": True}
            pb_full = generator.generate_for_incident(
                inc, threat_ctx, [row_a, row_b], [row_a, row_b], write_pdf=False
            )
            pb = {
                **pb_full,
                "playbook_steps": [{"action": x} for x in (pb_full.get("steps_flat") or [])],
                "risk_level": pb_full.get("severity_label") or "Unknown",
            }
        except Exception:
            iid = str(inc.get("incident_id") or "unknown")
            pb = {
                "playbook_title": f"SOC playbook placeholder: {iid}",
                "playbook_steps": [{"action": f"Review correlated telemetry for {iid} in the ingest pipeline output."}],
                "risk_level": str(inc.get("severity") or "Unknown"),
                "automation_candidates": [],
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