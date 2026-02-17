from datetime import datetime

from garud_drishti.ai_engine.reasoning import (
    IncidentInterpreter,
    MitreMapper,
    RiskExplainer,
)

from garud_drishti.ai_engine.playbook import (
    PlaybookGenerator,
    WorkflowBuilder,
    ResponseSelector,
)

from garud_drishti.automation.automation_executor import AutomationExecutor

from .correlation_service import run_correlation


def run_response():
    """
    Full SOC orchestration:
    detection → correlation → reasoning → playbook → automation
    """

    corr = run_correlation()
    incidents = corr["incidents"]

    now = datetime.utcnow().isoformat()
    for inc in incidents:
        inc.setdefault("timestamp", now)

    interpreter = IncidentInterpreter()
    mitre = MitreMapper()
    risk_engine = RiskExplainer()

    generator = PlaybookGenerator()
    workflow_builder = WorkflowBuilder()
    selector = ResponseSelector()
    executor = AutomationExecutor()

    playbooks = []
    automation_reports = []

    for inc in incidents:
        try:
            interp = interpreter.interpret(inc)
            mitre_hits = mitre.map(interp)
            inc["mitre"] = mitre_hits
            risk = risk_engine.explain(inc, interp, mitre_hits)
        except Exception:
            inc["mitre"] = []
            risk = {"score": inc.get("fidelity_score", 0)}

        try:
            pb = generator.generate(inc, risk)
        except Exception:
            pb = {
                "steps": [
                    "Review logs",
                    "Investigate asset",
                    "Contain suspicious activity"
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

    return {
        "incidents": incidents,
        "playbooks": playbooks,
        "automation": automation_reports
    }