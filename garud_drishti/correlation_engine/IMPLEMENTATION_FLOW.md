# GARUD-DRISHTI Correlation Engine Implementation Flow

## What This Module Does

The correlation engine is the offline, air-gapped part of GARUD-DRISHTI that:

- consumes Avantika's event feed from `garud_drishti/data/normalized_events/normalized_events.json`
- normalizes those records into Vishvesh's canonical event schema
- enriches every event with Shreya's anomaly results from `garud_drishti/data/processed/anomaly_events.json`
- groups all relevant events into event-time correlation sequences
- builds an attack graph and ordered attack paths
- detects multi-stage patterns from canonical event codes
- maps both event-level candidates and pattern-level confirmed MITRE ATT&CK techniques using only local assets
- computes incident-local risk scores
- writes final incident JSON outputs under `garud_drishti/data/incidents/`

The engine is offline-only. It does not call the internet. The MITRE workbook is parsed locally from `C:\Users\vishv\Downloads\enterprise-attack-v18.1.xlsx`, and any `http...` content stored in exported JSON is passive workbook metadata only.

## Why The Normalization Layer Lives In `preprocessing/`

The normalizer is implemented in `garud_drishti/correlation_engine/preprocessing/event_normalizer.py`.

This is a better fit than `loaders/` because:

- normalization changes event semantics, not just file access
- it creates a canonical schema that downstream modules rely on
- it is a true preprocessing transform between source input and correlation-ready data
- loaders should primarily read structured data and expose stable in-memory views

## End-To-End Flow

### 1. Input Read

File read:

- `garud_drishti/data/normalized_events/normalized_events.json`

Code:

- `garud_drishti/correlation_engine/preprocessing/event_normalizer.py`

Functions:

- `load_raw_logs(...)`
- `normalize_event(...)`
- `normalize_events(...)`
- `write_normalized_events(...)`

### 2. Canonical Normalization

The normalizer maps raw event types to canonical event codes using:

- `garud_drishti/correlation_engine/config/normalized_event_catalog.json`

Canonical output fields include:

- `event_id`
- `timestamp`
- `user_id`
- `src_ip`
- `device_id`
- `asset_id`
- `session_id`
- `source_system`
- `raw_event_type`
- `event_code`
- `event_category`
- `event_outcome`
- `severity`
- `severity_score`
- `risk_flag`
- `login_hour`
- `night_login`
- `event_hash`

Additional fields are retained where useful for correlation and scoring:

- `entity_id`
- `dest_ip`
- `resource`
- `file_path`
- `process_name`
- `department`
- `role`
- `duplicate_detected`

File written:

- `garud_drishti/data/normalized_events/vishvesh_normalized_events.json`

### 3. Canonical Event Loading

Code:

- `garud_drishti/correlation_engine/loaders/normalized_log_loader.py`

This loader:

- reads canonical Vishvesh events
- validates and standardizes dataframe columns
- normalizes timestamps and core identifiers
- keeps `event_code` as the primary correlation field
- marks duplicates using `duplicate_detected` and repeated `event_hash`

### 4. Anomaly Enrichment

File read:

- `garud_drishti/data/processed/anomaly_events.json`

Code:

- `garud_drishti/correlation_engine/loaders/anomaly_loader.py`

Anomaly handling rules:

- anomaly results are enrichment only
- no event is filtered out before correlation
- anomaly only boosts event context, confidence, and final risk

Matching strategy:

1. exact match on `entity_id + session_id + src_ip + event_code + timestamp`
2. nearest match within tolerance on `entity_id + session_id + event_code`
3. nearest match within tolerance on `entity_id + event_code`
4. nearest match within tolerance on `src_ip + event_code`

Default tolerance is loaded from:

- `garud_drishti/correlation_engine/config/correlation_config.json`

File written:

- `garud_drishti/data/correlation/enriched_events.json`

### 5. Correlation / Sequence Building

Code:

- `garud_drishti/correlation_engine/preprocessing/event_sequence_builder.py`

Config:

- `garud_drishti/correlation_engine/config/correlation_config.json`
- `garud_drishti/correlation_engine/config/entity_linking_rules.json`
- `garud_drishti/correlation_engine/entity_resolution/entity_config.json`

What happens here:

- all enriched events are grouped by best-available entity key
- entity preference is config-driven
- session correlation is preferred, then user+IP, then user, then IP, then device, then asset
- event-time windows are used, not arrival time
- sequences are split by sliding-window length and inter-event gap
- duplicates can be excluded from active correlation while still being counted for scoring/metadata

This stage provides the offline batch equivalent of correlation state.

### 6. Attack Graph Build

Code:

- `garud_drishti/correlation_engine/graph_engine/attack_graph_builder.py`

What it builds:

- node per canonical event
- temporal edge between ordered events in the same sequence
- graph metadata storing per-sequence ordered node lists

### 7. Attack Path Extraction

Code:

- `garud_drishti/correlation_engine/graph_engine/attack_path_extractor.py`

What it produces:

- one ordered path object per correlation sequence
- path length
- duration
- sequence id
- source-system diversity

### 8. Pattern Detection

Code:

- `garud_drishti/correlation_engine/detection/pattern_detector.py`

Rule config:

- `garud_drishti/correlation_engine/config/detection_rules.json`

Pattern logic uses:

- canonical `event_code`
- ordered stage matching
- minimum occurrences per stage
- event-time bounds
- minimum distinct source systems when configured

Examples:

- failed logins -> successful login
- login -> suspicious process execution
- file access -> large transfer
- port scan -> allowed connection
- login -> privilege change

### 9. MITRE ATT&CK Mapping

Code:

- `garud_drishti/correlation_engine/detection/mitre_mapper.py`

MITRE support has two layers.

#### Event-Level Candidate Mapping

Config:

- `garud_drishti/correlation_engine/config/mitre_event_mapping.json`

Behavior:

- maps canonical `event_code` to candidate techniques
- used after correlation paths are built
- does not rely on raw event types

#### Pattern-Level Confirmed Mapping

Config:

- `garud_drishti/correlation_engine/config/mitre_pattern_mapping.json`

Behavior:

- maps detected pattern names to stronger confirmed techniques
- adds higher-confidence ATT&CK context than event-only mapping

#### Local Workbook Export

Workbook source:

- `C:\Users\vishv\Downloads\enterprise-attack-v18.1.xlsx`

Generated files:

- `garud_drishti/data/mitre/mitre_workbook_manifest.json`
- `garud_drishti/data/mitre/mitre_techniques_sheet.json`
- `garud_drishti/data/mitre/mitre_tactics_sheet.json`
- `garud_drishti/data/mitre/mitre_software_sheet.json`
- `garud_drishti/data/mitre/mitre_groups_sheet.json`
- `garud_drishti/data/mitre/mitre_campaigns_sheet.json`
- `garud_drishti/data/mitre/mitre_mitigations_sheet.json`
- `garud_drishti/data/mitre/mitre_enterprise_attack_matrix_sheet.json`
- `garud_drishti/data/mitre/mitre_relationships_sheet.json`
- `garud_drishti/data/mitre/mitre_datacomponents_sheet.json`
- `garud_drishti/data/mitre/mitre_analytics_sheet.json`
- `garud_drishti/data/mitre/mitre_detectionstrategies_sheet.json`
- `garud_drishti/data/mitre/mitre_citations_sheet.json`
- `garud_drishti/data/mitre/mitre_techniques_index.json`
- `garud_drishti/data/mitre/mitre_tactics_index.json`

### 10. Risk Scoring

Code:

- `garud_drishti/correlation_engine/scoring/risk_scoring_engine.py`

Config:

- `garud_drishti/correlation_engine/config/risk_config.json`
- `garud_drishti/correlation_engine/config/entity_weights.json`

Risk is calculated per incident candidate, not globally. Components include:

- matched pattern severity
- event severity accumulation
- risk-flag weight
- anomaly boost
- event-level MITRE candidate count
- pattern-level MITRE confirmed count
- MITRE tactic severity spread
- source-system diversity
- path length
- entity context such as privileged roles and critical assets
- duplicate penalty

### 11. Incident JSON Generation

Code:

- `garud_drishti/correlation_engine/outputs/incident_builder.py`

Files written:

- `garud_drishti/data/incidents/correlated_incidents.json`
- `garud_drishti/data/incidents/by_incident/*.json`

Incident payloads include:

- incident id
- generated timestamp
- entity context
- correlation window metadata
- anomaly contribution
- final risk score and level
- patterns detected
- MITRE techniques and tactics
- attack graph summary
- ordered timeline
- attack narrative

## Main Pipeline Entrypoint

Code:

- `garud_drishti/correlation_engine/correlation_pipeline.py`

It supports:

- direct execution
- module execution

Pipeline stages:

1. export offline MITRE workbook assets
2. normalize Avantika input
3. load canonical normalized events
4. load anomaly feed
5. enrich canonical events
6. build correlation sequences
7. build attack graph
8. extract attack paths
9. detect patterns
10. map event-level MITRE candidates
11. map pattern-level MITRE confirmations
12. compute risk
13. generate incidents

## How To Run

Normalizing only:

```powershell
C:\Users\vishv\AppData\Local\Programs\Python\Python313\python.exe .\garud_drishti\correlation_engine\preprocessing\event_normalizer.py
```

Running the full pipeline:

```powershell
C:\Users\vishv\AppData\Local\Programs\Python\Python313\python.exe .\garud_drishti\correlation_engine\correlation_pipeline.py
```

Module execution:

```powershell
C:\Users\vishv\AppData\Local\Programs\Python\Python313\python.exe -m garud_drishti.correlation_engine.correlation_pipeline
```

## Files Read At Each Stage

- `garud_drishti/data/normalized_events/normalized_events.json`
- `garud_drishti/data/processed/anomaly_events.json`
- `garud_drishti/correlation_engine/config/normalized_event_catalog.json`
- `garud_drishti/correlation_engine/config/detection_rules.json`
- `garud_drishti/correlation_engine/config/mitre_event_mapping.json`
- `garud_drishti/correlation_engine/config/mitre_pattern_mapping.json`
- `garud_drishti/correlation_engine/config/risk_config.json`
- `garud_drishti/correlation_engine/config/correlation_config.json`
- `garud_drishti/correlation_engine/config/entity_linking_rules.json`
- `garud_drishti/correlation_engine/config/entity_weights.json`
- `garud_drishti/correlation_engine/entity_resolution/entity_config.json`
- `C:\Users\vishv\Downloads\enterprise-attack-v18.1.xlsx`

## Files Written At Each Stage

- `garud_drishti/data/normalized_events/vishvesh_normalized_events.json`
- `garud_drishti/data/correlation/enriched_events.json`
- `garud_drishti/data/mitre/*.json`
- `garud_drishti/data/incidents/correlated_incidents.json`
- `garud_drishti/data/incidents/by_incident/*.json`

## Current Limitations

- this is still an offline batch engine, not a live streaming correlation service
- late or out-of-order events are handled correctly only within a batch replay, not as incremental stateful updates
- incidents are regenerated per batch run rather than upserted into a long-lived incident state store
- correlation windows are sequence-based and event-time-driven, but there is no continuously running in-memory state cleanup loop
- MITRE mapping is workbook-backed and offline, but candidate/confirmed associations are still config-driven and should be expanded as the event catalog grows
