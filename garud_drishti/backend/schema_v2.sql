CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('tier1','tier2','tier3','manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE severity_level AS ENUM ('high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('open','investigating','escalated','contained','resolved','suppressed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE execution_mode AS ENUM ('manual','assisted','autonomous');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE automation_status AS ENUM ('pending','approved','running','completed','rolled_back','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE step_type AS ENUM ('automated','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE step_status AS ENUM ('pending','running','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE action_type AS ENUM ('block_ip','isolate_host','disable_user','revoke_sessions','alert_only','escalate','enable_logging');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE step_priority AS ENUM ('immediate','urgent','within_1hr','within_4hr','ongoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE agent_decision_level AS ENUM ('HIGH','MEDIUM','LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE pipeline_status AS ENUM ('running','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar VARCHAR(10),
  role user_role NOT NULL DEFAULT 'tier1',
  department VARCHAR(100) DEFAULT 'SOC Operations',
  is_active BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_ref VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  narrative TEXT,
  severity severity_level NOT NULL,
  status incident_status NOT NULL DEFAULT 'open',
  fidelity_score FLOAT,
  kill_chain_stage INTEGER DEFAULT 1,
  mitre_techniques JSONB,
  graph_nodes JSONB,
  graph_edges JSONB,
  entities JSONB,
  source_types TEXT[],
  assigned_to UUID REFERENCES users(id),
  escalated_to UUID REFERENCES users(id),
  detected_ago VARCHAR(50),
  execution_mode execution_mode DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  time_display VARCHAR(20),
  event_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  entity VARCHAR(255),
  severity severity_level,
  source_type VARCHAR(50),
  raw_log JSONB,
  normalized JSONB,
  entity_type VARCHAR(50),
  anomaly_score FLOAT,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fidelity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  behavioral_deviation FLOAT,
  asset_criticality FLOAT,
  historical_similarity FLOAT,
  final_score FLOAT,
  weight_behavioral FLOAT DEFAULT 0.50,
  weight_criticality FLOAT DEFAULT 0.30,
  weight_similarity FLOAT DEFAULT 0.20,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  risk_score FLOAT,
  compliance_score FLOAT,
  business_impact_score FLOAT,
  weighted_final_score FLOAT,
  final_decision agent_decision_level,
  risk_factors JSONB,
  compliance_factors JSONB,
  risk_rejected JSONB,
  compliance_rejected JSONB,
  impact_rejected JSONB,
  risk_reasoning TEXT,
  compliance_reasoning TEXT,
  impact_reasoning TEXT,
  risk_prompt TEXT,
  compliance_prompt TEXT,
  impact_prompt TEXT,
  model_name VARCHAR(100) DEFAULT 'Llama 3.1 8B',
  model_mode VARCHAR(50) DEFAULT 'offline',
  vector_db VARCHAR(100) DEFAULT 'FAISS offline index',
  tokens_processed INTEGER,
  policy_violations JSONB,
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  orchestrator_trace JSONB NOT NULL,
  model_name VARCHAR(100),
  model_mode VARCHAR(50) DEFAULT 'offline',
  vector_db VARCHAR(100),
  events_processed INTEGER,
  incident_object_tokens INTEGER,
  inference_status VARCHAR(50) DEFAULT 'complete',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_ref VARCHAR(20) UNIQUE,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  title VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  generated_by VARCHAR(100) DEFAULT 'Llama 3.1 8B',
  model_version VARCHAR(50),
  generated_at TIME,
  generated_date DATE,
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  mitre_tactic VARCHAR(20),
  mitre_name VARCHAR(100),
  affected_entity VARCHAR(255),
  policy_validated BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playbook_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority step_priority DEFAULT 'urgent',
  type step_type DEFAULT 'manual',
  owner VARCHAR(100),
  estimated_time VARCHAR(50),
  status step_status DEFAULT 'pending',
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  tool_used VARCHAR(100),
  execution_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS containment_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  playbook_id UUID REFERENCES playbooks(id),
  playbook_step_id UUID REFERENCES playbook_steps(id),
  action_type action_type NOT NULL,
  target_entity VARCHAR(255),
  automation_status automation_status DEFAULT 'pending',
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  executed_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suspicious_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  risk_score FLOAT,
  reason TEXT,
  last_seen VARCHAR(20),
  is_isolated BOOLEAN DEFAULT FALSE,
  isolated_by UUID REFERENCES users(id),
  isolated_at TIMESTAMPTZ,
  flagged_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_ref VARCHAR(20) UNIQUE,
  status pipeline_status DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  events_processed INTEGER DEFAULT 0,
  incidents_generated INTEGER DEFAULT 0,
  stage_results JSONB,
  triggered_by UUID REFERENCES users(id),
  trigger_type VARCHAR(50) DEFAULT 'manual',
  uploaded_file VARCHAR(255),
  source_system VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  action_type VARCHAR(50),
  details JSONB,
  policy_checks JSONB,
  automation_status automation_status,
  model_version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES users(id),
  recipients TEXT[],
  note TEXT,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_hash VARCHAR(64) UNIQUE,
  mitre_techniques TEXT[],
  similarity_hits INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  sample_incident_id UUID REFERENCES incidents(id)
);
