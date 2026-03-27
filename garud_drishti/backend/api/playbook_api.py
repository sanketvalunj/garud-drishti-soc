from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import json

from garud_drishti.backend.utils.db import get_db

router = APIRouter(tags=["playbooks"])


class StepStatusBody(BaseModel):
    status: str


@router.get("/playbooks")
def get_playbooks(status: str | None = Query(default=None), type: str | None = Query(default=None)):
    clauses = []
    args = []
    if status and status != "all":
        clauses.append("p.status = %s")
        args.append(status)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT p.*
                FROM playbooks p
                {where_sql}
                ORDER BY p.created_at DESC
                """,
                tuple(args),
            )
            playbooks = cur.fetchall()
            response = []
            for pb in playbooks:
                cur.execute(
                    """
                    SELECT id, step_number, title, description, priority, type, owner, estimated_time, status
                    FROM playbook_steps
                    WHERE playbook_id = %s
                    ORDER BY step_number ASC
                    """,
                    (pb["id"],),
                )
                steps = cur.fetchall()
                entry = dict(pb)
                entry["steps"] = steps
                response.append(entry)
            return response


@router.get("/playbooks/{playbook_id}")
def get_playbook(playbook_id: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM playbooks WHERE id = %s OR playbook_ref = %s", (playbook_id, playbook_id))
            pb = cur.fetchone()
            if not pb:
                raise HTTPException(status_code=404, detail="Playbook not found")
            cur.execute(
                """
                SELECT id, step_number, title, description, priority, type, owner, estimated_time, status
                FROM playbook_steps
                WHERE playbook_id = %s
                ORDER BY step_number ASC
                """,
                (pb["id"],),
            )
            steps = cur.fetchall()
            payload = dict(pb)
            payload["steps"] = steps
            return payload


@router.patch("/playbooks/{playbook_id}/steps/{step_id}")
def update_step_status(playbook_id: str, step_id: str, body: StepStatusBody):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE playbook_steps
                SET status = %s, completed_at = CASE WHEN %s = 'completed' THEN NOW() ELSE completed_at END
                WHERE id = %s AND (playbook_id = %s OR playbook_id = (SELECT id FROM playbooks WHERE playbook_ref = %s))
                RETURNING id, status
                """,
                (body.status, body.status, step_id, playbook_id, playbook_id),
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Step not found")

            cur.execute(
                """
                UPDATE playbooks
                SET completed_steps = (
                    SELECT COUNT(*) FROM playbook_steps
                    WHERE playbook_id = playbooks.id AND status = 'completed'
                )
                WHERE id = %s OR playbook_ref = %s
                """,
                (playbook_id, playbook_id),
            )
            conn.commit()
            return updated


@router.post("/playbooks/{playbook_id}/review")
def mark_playbook_reviewed(playbook_id: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE playbooks
                SET status = 'reviewed', reviewed_at = NOW()
                WHERE id = %s OR playbook_ref = %s
                RETURNING id, incident_id
                """,
                (playbook_id, playbook_id),
            )
            pb = cur.fetchone()
            if not pb:
                raise HTTPException(status_code=404, detail="Playbook not found")
            cur.execute(
                """
                INSERT INTO audit_logs(incident_id, action, action_type, details)
                VALUES (%s, %s, 'review', %s::jsonb)
                """,
                (pb["incident_id"], "Playbook marked as reviewed", json.dumps({"playbook_id": pb["id"]})),
            )
            conn.commit()
            return {"success": True}