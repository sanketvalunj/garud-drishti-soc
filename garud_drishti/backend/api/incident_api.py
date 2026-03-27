from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import json

from garud_drishti.backend.utils.db import get_db

router = APIRouter(tags=["incidents"])


class IncidentStatusBody(BaseModel):
    status: str


class EscalateBody(BaseModel):
    recipients: list[str]
    reason: str | None = None


class ShareBody(BaseModel):
    recipients: list[str]
    note: str | None = None


@router.get("/incidents")
def get_incidents(
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort: str = Query(default="latest"),
):
    clauses = []
    args = []
    if severity and severity != "all":
        clauses.append("i.severity = %s")
        args.append(severity)
    if status and status != "all":
        clauses.append("i.status = %s")
        args.append(status)
    if search:
        clauses.append("(i.incident_ref ILIKE %s OR i.title ILIKE %s)")
        args.extend([f"%{search}%", f"%{search}%"])
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    sort_sql = "i.created_at DESC"
    if sort == "oldest":
        sort_sql = "i.created_at ASC"

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    i.id, i.incident_ref, i.title, i.severity, i.status, i.fidelity_score,
                    i.kill_chain_stage, i.created_at, i.detected_ago, i.entities
                FROM incidents i
                {where_sql}
                ORDER BY {sort_sql}
                """,
                tuple(args),
            )
            rows = cur.fetchall()
            return rows


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM incidents WHERE id = %s OR incident_ref = %s", (incident_id, incident_id))
            incident = cur.fetchone()
            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            cur.execute("SELECT * FROM fidelity_scores WHERE incident_id = %s ORDER BY computed_at DESC LIMIT 1", (incident["id"],))
            fidelity = cur.fetchone()
            cur.execute("SELECT * FROM agent_decisions WHERE incident_id = %s ORDER BY decided_at DESC LIMIT 1", (incident["id"],))
            agent = cur.fetchone()
            cur.execute(
                """
                SELECT id, timestamp, time_display, event_type, description, entity, severity
                FROM events WHERE incident_id = %s ORDER BY timestamp ASC
                """,
                (incident["id"],),
            )
            timeline = cur.fetchall()
            cur.execute("SELECT * FROM playbooks WHERE incident_id = %s ORDER BY created_at DESC LIMIT 1", (incident["id"],))
            playbook = cur.fetchone()
            steps = []
            if playbook:
                cur.execute(
                    """
                    SELECT id, step_number, title, description, priority, type, owner, estimated_time, status
                    FROM playbook_steps WHERE playbook_id = %s ORDER BY step_number ASC
                    """,
                    (playbook["id"],),
                )
                steps = cur.fetchall()

            result = dict(incident)
            result["fidelity_factors"] = [
                {"label": "Behavioral Deviation", "score": (fidelity or {}).get("behavioral_deviation", 0)},
                {"label": "Asset Criticality", "score": (fidelity or {}).get("asset_criticality", 0)},
                {"label": "Historical Similarity", "score": (fidelity or {}).get("historical_similarity", 0)},
            ]
            result["agent_scores"] = {
                "risk": (agent or {}).get("risk_score", 0),
                "compliance": (agent or {}).get("compliance_score", 0),
                "businessImpact": (agent or {}).get("business_impact_score", 0),
                "finalDecision": (agent or {}).get("final_decision", "LOW"),
            }
            result["timeline"] = timeline
            result["playbook"] = None
            if playbook:
                result["playbook"] = {
                    "id": playbook["id"],
                    "title": playbook["title"],
                    "generated_at": str(playbook["generated_at"]) if playbook["generated_at"] else None,
                    "generated_date": str(playbook["generated_date"]) if playbook["generated_date"] else None,
                    "steps": steps,
                }
            result["kill_chain_stages"] = [
                "Initial Access",
                "Execution",
                "Persistence",
                "Privilege Escalation",
                "Lateral Movement",
                "Exfiltration",
            ]
            return result


@router.patch("/incidents/{incident_id}")
def update_incident_status(incident_id: str, body: IncidentStatusBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE incidents
                SET status = %s, updated_at = NOW(),
                    resolved_at = CASE WHEN %s = 'resolved' THEN NOW() ELSE resolved_at END
                WHERE id = %s OR incident_ref = %s
                RETURNING id, incident_ref, status
                """,
                (body.status, body.status, incident_id, incident_id),
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Incident not found")
            conn.commit()
            return updated


@router.post("/incidents/{incident_id}/escalate")
def escalate_incident(incident_id: str, body: EscalateBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE incidents SET status = 'escalated', updated_at = NOW() WHERE id = %s OR incident_ref = %s RETURNING id",
                (incident_id, incident_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Incident not found")
            cur.execute(
                """
                INSERT INTO audit_logs(incident_id, action, action_type, details)
                VALUES (%s, %s, 'escalation', %s::jsonb)
                """,
                (row["id"], "Incident escalated", json.dumps({"recipients": body.recipients, "reason": body.reason})),
            )
            conn.commit()
            return {"success": True}


@router.post("/incidents/{incident_id}/share")
def share_incident_report(incident_id: str, body: ShareBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM incidents WHERE id = %s OR incident_ref = %s", (incident_id, incident_id))
            inc = cur.fetchone()
            if not inc:
                raise HTTPException(status_code=404, detail="Incident not found")
            cur.execute(
                """
                INSERT INTO report_shares(incident_id, recipients, note)
                VALUES (%s, %s, %s)
                """,
                (inc["id"], body.recipients, body.note),
            )
            cur.execute(
                """
                INSERT INTO audit_logs(incident_id, action, action_type, details)
                VALUES (%s, %s, 'review', %s::jsonb)
                """,
                (inc["id"], "Incident report shared", json.dumps({"recipients": body.recipients, "note": body.note})),
            )
            conn.commit()
            return {"success": True}


@router.post("/incidents/{incident_id}/activate-response")
def activate_response(incident_id: str):
    executed_steps = []
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM incidents WHERE id = %s OR incident_ref = %s", (incident_id, incident_id))
            inc = cur.fetchone()
            if not inc:
                raise HTTPException(status_code=404, detail="Incident not found")

            cur.execute("SELECT id FROM playbooks WHERE incident_id = %s ORDER BY created_at DESC LIMIT 1", (inc["id"],))
            pb = cur.fetchone()
            if pb:
                cur.execute(
                    """
                    SELECT id, title FROM playbook_steps
                    WHERE playbook_id = %s AND type = 'automated'
                    ORDER BY step_number ASC
                    """,
                    (pb["id"],),
                )
                steps = cur.fetchall()
                for step in steps:
                    cur.execute(
                        """
                        INSERT INTO containment_actions(incident_id, playbook_id, playbook_step_id, action_type, target_entity, automation_status, executed_at, result)
                        VALUES (%s, %s, %s, 'alert_only', %s, 'completed', NOW(), %s::jsonb)
                        """,
                        (inc["id"], pb["id"], step["id"], step["title"], json.dumps({"success": True})),
                    )
                    cur.execute(
                        "UPDATE playbook_steps SET status = 'completed', completed_at = NOW() WHERE id = %s",
                        (step["id"],),
                    )
                    executed_steps.append({"id": step["id"], "title": step["title"], "status": "completed"})
                cur.execute(
                    "UPDATE playbooks SET completed_steps = (SELECT COUNT(*) FROM playbook_steps WHERE playbook_id = %s AND status = 'completed') WHERE id = %s",
                    (pb["id"], pb["id"]),
                )

            cur.execute("UPDATE incidents SET status = 'contained', updated_at = NOW() WHERE id = %s", (inc["id"],))
            cur.execute(
                """
                INSERT INTO audit_logs(incident_id, action, action_type, details, automation_status)
                VALUES (%s, %s, 'response', %s::jsonb, 'completed')
                """,
                (inc["id"], "Activated response", json.dumps({"executedSteps": executed_steps})),
            )
            conn.commit()
    return {"success": True, "executedSteps": executed_steps}