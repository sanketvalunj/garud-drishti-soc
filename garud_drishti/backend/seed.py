import json
from datetime import date, datetime, timedelta

import bcrypt
from psycopg.types.json import Jsonb

from garud_drishti.backend.utils.db import get_db


USERS = [
    ("sarah", "password123", "Sarah Chen", "SC", "tier1"),
    ("testuser", "password123", "testuser", "TU", "tier2"),
    ("james", "password123", "James Okafor", "JO", "tier3"),
    ("priya", "password123", "Priya Sharma", "PS", "manager"),
]

INCIDENT_IDS = [
    ("INC-2091", "Privilege Escalation", "high", "investigating", 0.87, 4, "2 min ago"),
    ("INC-2090", "Lateral Movement", "high", "investigating", 0.65, 5, "5 min ago"),
    ("INC-2089", "Data Exfiltration", "high", "escalated", 0.92, 6, "12 min ago"),
    ("INC-2088", "Brute Force Attempt", "medium", "contained", 0.45, 1, "1 hr ago"),
    ("INC-2087", "Anomalous Login", "low", "contained", 0.38, 1, "3 hrs ago"),
    ("INC-2086", "Excessive File Access", "high", "investigating", 0.55, 3, "4 hrs ago"),
    ("INC-2085", "Malware Detected", "high", "escalated", 0.98, 2, "5 hrs ago"),
    ("INC-2084", "Suspicious Execution", "medium", "contained", 0.41, 2, "6 hrs ago"),
    ("INC-2083", "Data Exfiltration", "high", "investigating", 0.88, 6, "8 hrs ago"),
    ("INC-2082", "Lateral Movement", "medium", "investigating", 0.72, 5, "10 hrs ago"),
    ("INC-2081", "Brute Force", "medium", "contained", 0.55, 1, "12 hrs ago"),
    ("INC-2080", "Anomalous Login", "low", "contained", 0.33, 1, "1 day ago"),
]


def main():
    with get_db() as conn:
        with conn.cursor() as cur:
            # users
            for username, password, display_name, avatar, role in USERS:
                password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
                cur.execute(
                    """
                    INSERT INTO users(username, password_hash, display_name, avatar, role)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name, avatar = EXCLUDED.avatar, role = EXCLUDED.role
                    """,
                    (username, password_hash, display_name, avatar, role),
                )

            # incidents and associated records
            incident_uuid_map = {}
            now = datetime.utcnow()
            for idx, (ref, title, severity, status, score, stage, detected_ago) in enumerate(INCIDENT_IDS):
                created_at = now - timedelta(minutes=idx * 15)
                entities = {
                    "users": [{"name": f"emp_{100 + idx}", "status": "suspected"}],
                    "servers": [{"name": f"server_{idx+1}", "status": "suspected"}],
                    "ips": [{"name": f"203.0.113.{20+idx}", "status": "suspected"}],
                }
                cur.execute(
                    """
                    INSERT INTO incidents(incident_ref, title, narrative, severity, status, fidelity_score, kill_chain_stage, entities, graph_nodes, graph_edges, mitre_techniques, detected_ago, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s,%s,%s)
                    ON CONFLICT (incident_ref) DO UPDATE SET title = EXCLUDED.title, severity = EXCLUDED.severity, status = EXCLUDED.status, fidelity_score = EXCLUDED.fidelity_score, entities = EXCLUDED.entities
                    RETURNING id
                    """,
                    (
                        ref,
                        title,
                        f"AI narrative for {ref}",
                        severity,
                        status,
                        score,
                        stage,
                        json.dumps(entities),
                        json.dumps([{"id": "n1", "type": "user", "label": entities["users"][0]["name"], "compromised": True, "position": {"x": 200, "y": 100}}]),
                        json.dumps([{"id": "e1", "source": "n1", "target": "n1", "label": "observed"}]),
                        json.dumps([{"id": "T1078", "name": "Valid Accounts", "tactic": "Initial Access", "confidence": 80}]),
                        detected_ago,
                        created_at,
                        created_at,
                    ),
                )
                incident_id = cur.fetchone()["id"]
                incident_uuid_map[ref] = incident_id

                cur.execute(
                    """
                    INSERT INTO fidelity_scores(incident_id, behavioral_deviation, asset_criticality, historical_similarity, final_score)
                    VALUES (%s,%s,%s,%s,%s)
                    """,
                    (incident_id, min(score + 0.04, 0.99), max(score - 0.02, 0.1), max(score - 0.08, 0.1), score),
                )
                cur.execute(
                    """
                    INSERT INTO agent_decisions(incident_id, risk_score, compliance_score, business_impact_score, weighted_final_score, final_decision,
                                                risk_factors, compliance_factors, risk_rejected, compliance_rejected, impact_rejected, risk_reasoning, compliance_reasoning, impact_reasoning,
                                                risk_prompt, compliance_prompt, impact_prompt)
                    VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s::jsonb,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        incident_id, score, max(score - 0.07, 0.1), max(score - 0.12, 0.1), score,
                        "HIGH" if score >= 0.8 else "MEDIUM" if score >= 0.5 else "LOW",
                        json.dumps(["External login", "Suspicious execution"]),
                        json.dumps(["PCI scope impact"]),
                        json.dumps(["Low confidence hypothesis"]),
                        json.dumps(["No regulatory trigger"]),
                        json.dumps(["Low business disruption"]),
                        "Risk reasoning", "Compliance reasoning", "Impact reasoning",
                        "Risk prompt", "Compliance prompt", "Impact prompt",
                    ),
                )

                cur.execute(
                    """
                    INSERT INTO playbooks(playbook_ref, incident_id, title, status, generated_at, generated_date, total_steps, completed_steps, mitre_tactic, mitre_name, affected_entity)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (playbook_ref) DO UPDATE SET title = EXCLUDED.title
                    RETURNING id
                    """,
                    (f"PB-{ref.split('-')[1]}", incident_id, f"{title} Response", "pending", datetime.utcnow().time(), date.today(), 3, 0, "T1068", title, entities["users"][0]["name"]),
                )
                pb_id = cur.fetchone()["id"]
                for s_idx, step in enumerate(["Isolate account", "Block source IP", "Review logs"], start=1):
                    cur.execute(
                        """
                        INSERT INTO playbook_steps(playbook_id, incident_id, step_number, title, description, priority, type, owner, estimated_time, status)
                        VALUES (%s,%s,%s,%s,%s,'urgent','manual','SOC Team','5 min','pending')
                        """,
                        (pb_id, incident_id, s_idx, step, step),
                    )

            # events for INC-2091 (6 timeline entries)
            inc2091 = incident_uuid_map["INC-2091"]
            timeline = [
                ("Login Attempt", "External login attempt detected", "203.0.113.45", "medium"),
                ("Auth Success", "Authentication successful on auth-server", "auth-server", "high"),
                ("PowerShell Execution", "Encoded PowerShell command executed", "user_laptop_88", "high"),
                ("Lateral Movement", "Movement from auth-server to loan-db", "loan-db", "high"),
                ("Access Attempt", "Unauthorized access attempt on core-banking", "core-banking", "high"),
                ("Login Failed", "Failed login attempt on swift-terminal", "swift-terminal", "medium"),
            ]
            for i, (ev_type, desc, entity, sev) in enumerate(timeline):
                ts = datetime.utcnow() - timedelta(minutes=6 - i)
                cur.execute(
                    """
                    INSERT INTO events(incident_id, timestamp, time_display, event_type, description, entity, severity)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (inc2091, ts, ts.strftime("%H:%M:%S"), ev_type, desc, entity, sev),
                )

            # llm traces for INC-2091 and INC-2089
            for ref in ["INC-2091", "INC-2089"]:
                cur.execute(
                    """
                    INSERT INTO llm_reasoning_traces(incident_id, orchestrator_trace, model_name, model_mode, vector_db, events_processed, incident_object_tokens, inference_status)
                    VALUES (%s,%s::jsonb,'Llama 3.1 8B','offline','FAISS offline index',847,2847,'complete')
                    """,
                    (incident_uuid_map[ref], json.dumps([{"phase": "ORCHESTRATOR", "color": "#00AEEF", "lines": ["trace line"], "duration": "0.1s"}])),
                )

            # suspicious users
            for i in range(3):
                cur.execute(
                    """
                    INSERT INTO suspicious_users(incident_id, username, risk_level, risk_score, reason, last_seen)
                    VALUES (%s,%s,%s,%s,%s,%s)
                    """,
                    (inc2091, f"emp_{104+i}", "high" if i == 0 else "medium", 90 - (i * 12), "Anomalous behavior", "12:11:47"),
                )

            # pipeline runs (6)
            for i in range(6):
                run_ref = f"RUN-04{7-i}"
                cur.execute(
                    """
                    INSERT INTO pipeline_runs(run_ref, status, started_at, completed_at, duration_seconds, events_processed, incidents_generated, trigger_type)
                    VALUES (%s,%s,NOW() - (%s || ' minutes')::interval, NOW() - (%s || ' minutes')::interval, %s, %s, %s, 'manual')
                    ON CONFLICT (run_ref) DO NOTHING
                    """,
                    (run_ref, "completed" if i != 5 else "failed", i * 20 + 2, i * 20, 40 + i, 800 - i * 70, max(0, 12 - i)),
                )

            # audit logs (6)
            for i in range(6):
                cur.execute(
                    """
                    INSERT INTO audit_logs(incident_id, action, action_type, details)
                    VALUES (%s,%s,%s,%s::jsonb)
                    """,
                    (inc2091, f"Audit action {i+1}", "review", json.dumps({"index": i + 1})),
                )

            conn.commit()
    print("Seed completed.")


if __name__ == "__main__":
    main()
