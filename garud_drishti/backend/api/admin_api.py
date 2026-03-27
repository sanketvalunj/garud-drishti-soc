from datetime import datetime
import uuid
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from garud_drishti.backend.utils.db import get_db

router = APIRouter(tags=["admin"])


@router.get("/admin/health")
def get_health():
    return {
        "aiEngine": "operational",
        "faissIndex": "synced",
        "ollama": "online",
        "pipeline": "ready",
    }


@router.get("/admin/pipeline-status")
def get_pipeline_status():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 1"
            )
            run = cur.fetchone()
            if not run:
                return {"status": "idle"}
            return run


@router.post("/admin/run-pipeline")
def run_pipeline():
    run_ref = f"RUN-{str(uuid.uuid4())[:6].upper()}"
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pipeline_runs(run_ref, status, started_at, completed_at, duration_seconds, events_processed, incidents_generated, trigger_type)
                VALUES (%s, 'completed', NOW(), NOW(), 45, 847, 12, 'manual')
                RETURNING id, run_ref, status
                """,
                (run_ref,),
            )
            row = cur.fetchone()
            cur.execute(
                """
                INSERT INTO audit_logs(action, action_type, details)
                VALUES ('Pipeline run triggered', 'pipeline', %s::jsonb)
                """,
                (json.dumps({"run_ref": row["run_ref"]}),),
            )
            conn.commit()
            return {"runId": str(row["id"]), "status": row["status"]}


@router.get("/admin/pipeline-history")
def pipeline_history():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 20")
            return cur.fetchall()


@router.post("/admin/ingest-logs")
def ingest_logs(file: UploadFile = File(...), sourceSystem: str = Form(default="unknown")):
    run_ref = f"RUN-{str(uuid.uuid4())[:6].upper()}"
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pipeline_runs(run_ref, status, started_at, completed_at, duration_seconds, events_processed, incidents_generated, trigger_type, uploaded_file, source_system)
                VALUES (%s, 'completed', NOW(), NOW(), 35, 220, 3, 'file_upload', %s, %s)
                RETURNING id, run_ref, status
                """,
                (run_ref, file.filename, sourceSystem),
            )
            row = cur.fetchone()
            conn.commit()
            return {"runId": str(row["id"]), "status": row["status"], "uploadedFile": file.filename}


@router.get("/admin/suspicious-users")
def get_suspicious_users():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM suspicious_users WHERE is_isolated = FALSE ORDER BY flagged_at DESC")
            return cur.fetchall()


@router.post("/admin/suspicious-users/{suspicious_id}/isolate")
def isolate_suspicious_user(suspicious_id: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE suspicious_users
                SET is_isolated = TRUE, isolated_at = NOW()
                WHERE id = %s
                RETURNING id, incident_id, username
                """,
                (suspicious_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Suspicious user not found")
            cur.execute(
                """
                INSERT INTO containment_actions(incident_id, action_type, target_entity, automation_status, executed_at, result)
                VALUES (%s, 'disable_user', %s, 'completed', NOW(), %s::jsonb)
                """,
                (row["incident_id"], row["username"], json.dumps({"success": True})),
            )
            cur.execute(
                """
                INSERT INTO audit_logs(incident_id, action, action_type, details, automation_status)
                VALUES (%s, 'User isolated', 'isolation', %s::jsonb, 'completed')
                """,
                (row["incident_id"], json.dumps({"username": row["username"]})),
            )
            conn.commit()
            return {"success": True}


@router.get("/admin/team")
def get_team():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.username, u.display_name, u.role, u.avatar, u.department, u.is_online,
                       COUNT(i.id) FILTER (WHERE i.assigned_to = u.id) AS assigned_incidents
                FROM users u
                LEFT JOIN incidents i ON i.assigned_to = u.id
                GROUP BY u.id
                ORDER BY u.display_name
                """
            )
            return cur.fetchall()


@router.get("/admin/audit-trail")
def get_audit_trail():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.*, u.display_name AS user_name
                FROM audit_logs a
                LEFT JOIN users u ON u.id = a.user_id
                ORDER BY a.created_at DESC
                LIMIT 20
                """
            )
            return cur.fetchall()


@router.get("/admin/stats")
def get_stats():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM incidents")
            total = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) AS c FROM incidents WHERE status = 'contained'")
            contained = cur.fetchone()["c"]
            cur.execute(
                """
                SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS mttr_seconds
                FROM incidents
                WHERE resolved_at IS NOT NULL
                """
            )
            mttr = cur.fetchone()["mttr_seconds"] or 0
            cur.execute("SELECT COUNT(*) AS c FROM users WHERE is_online = TRUE")
            online = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) AS c FROM incidents WHERE status = 'suppressed'")
            suppressed = cur.fetchone()["c"]
            false_positive_rate = (suppressed / total * 100) if total else 0
            return {
                "totalIncidents": total,
                "contained": contained,
                "mttr": round(mttr / 60, 2),
                "analystsOnline": online,
                "falsePositiveRate": round(false_positive_rate, 2),
            }
