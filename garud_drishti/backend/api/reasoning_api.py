from fastapi import APIRouter, HTTPException

from garud_drishti.backend.utils.db import get_db

router = APIRouter(tags=["reasoning"])


@router.get("/reasoning/{incident_id}")
def get_incident_reasoning(incident_id: str):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title FROM incidents WHERE id = %s OR incident_ref = %s", (incident_id, incident_id))
            incident = cur.fetchone()
            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            cur.execute(
                """
                SELECT orchestrator_trace, model_name, model_mode, vector_db, events_processed, incident_object_tokens, inference_status
                FROM llm_reasoning_traces
                WHERE incident_id = %s
                ORDER BY generated_at DESC
                LIMIT 1
                """,
                (incident["id"],),
            )
            trace = cur.fetchone()
            cur.execute(
                """
                SELECT risk_score, compliance_score, business_impact_score,
                       risk_factors, compliance_factors,
                       risk_rejected, compliance_rejected, impact_rejected,
                       risk_reasoning, compliance_reasoning, impact_reasoning,
                       risk_prompt, compliance_prompt, impact_prompt
                FROM agent_decisions
                WHERE incident_id = %s
                ORDER BY decided_at DESC
                LIMIT 1
                """,
                (incident["id"],),
            )
            agent = cur.fetchone() or {}

            if not trace:
                raise HTTPException(status_code=404, detail="Reasoning not found")

            return {
                "incident_id": str(incident["id"]),
                "attack_type": incident["title"],
                "model_name": trace["model_name"],
                "model_mode": trace["model_mode"],
                "vector_db": trace["vector_db"],
                "events_processed": trace["events_processed"],
                "incident_object_tokens": trace["incident_object_tokens"],
                "status": trace["inference_status"],
                "orchestrator_trace": trace["orchestrator_trace"],
                "agents": [
                    {
                        "name": "Risk Agent",
                        "icon_name": "ShieldAlert",
                        "color": "#B91C1C",
                        "score": agent.get("risk_score", 0),
                        "considered": agent.get("risk_factors") or [],
                        "rejected": agent.get("risk_rejected") or [],
                        "reasoning": agent.get("risk_reasoning"),
                        "prompt": agent.get("risk_prompt"),
                    },
                    {
                        "name": "Compliance Agent",
                        "icon_name": "Scale",
                        "color": "#D97706",
                        "score": agent.get("compliance_score", 0),
                        "considered": agent.get("compliance_factors") or [],
                        "rejected": agent.get("compliance_rejected") or [],
                        "reasoning": agent.get("compliance_reasoning"),
                        "prompt": agent.get("compliance_prompt"),
                    },
                    {
                        "name": "Business Impact Agent",
                        "icon_name": "TrendingUp",
                        "color": "#15803D",
                        "score": agent.get("business_impact_score", 0),
                        "considered": [],
                        "rejected": agent.get("impact_rejected") or [],
                        "reasoning": agent.get("impact_reasoning"),
                        "prompt": agent.get("impact_prompt"),
                    },
                ],
            }
