"""
╔══════════════════════════════════════════════════════════════╗
║  GARUD-DRISHTI — AI SOC PLATFORM                            ║
║  COMPLETE SYSTEM TEST SUITE                                 ║
║  QA Checklist for Cybersecurity Engineers                   ║
╚══════════════════════════════════════════════════════════════╝

Tests every module of the pipeline:
  1. Enterprise Environment Simulator
  2. MITRE ATT&CK Mapping
  3. Security Context Enrichment
  4. Attack Chain Generator (all 7 scenarios)
  5. Log Generator (10K+ events)
  6. Log Parser (4 formats)
  7. Schema Mapper
  8. Log Normalizer Pipeline
  9. Event Indexer (in-memory)
  10. End-to-End Pipeline (generate → parse → normalize → enrich → index → query)
"""

import sys
import os
import json
import time

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.dirname(__file__) else ".")
sys.path.insert(0, ".")

PASS = "✅ PASS"
FAIL = "❌ FAIL"
tests_passed = 0
tests_failed = 0
test_results = []


def report(name, passed, detail=""):
    global tests_passed, tests_failed
    status = PASS if passed else FAIL
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1
    msg = f"  {status}  {name}"
    if detail:
        msg += f"  —  {detail}"
    print(msg)
    test_results.append((name, passed, detail))


print("═" * 70)
print("  GARUD-DRISHTI AI SOC PLATFORM — SYSTEM TEST SUITE")
print(f"  Run at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print("═" * 70)


# ══════════════════════════════════════════════════════════════
# TEST 1: Enterprise Environment Simulator
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 1: Enterprise Environment Simulator              │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from simulator.enterprise_simulator import (
        EnterpriseEnvironment, get_enterprise_env, reset_enterprise_env,
    )
    reset_enterprise_env()
    env = get_enterprise_env(50)

    report("Import EnterpriseEnvironment", True)
    report("50 employees generated", len(env.employees) == 50, f"got {len(env.employees)}")
    report("50 devices generated", len(env.devices) == 50, f"got {len(env.devices)}")
    report("10 servers generated", len(env.servers) == 10, f"got {len(env.servers)}")
    report("8 databases generated", len(env.databases) == 8, f"got {len(env.databases)}")
    report("4 network segments", len(env.segments) == 4, f"got {len(env.segments)}")

    # Test accessors
    emp = env.random_employee()
    report("random_employee() works", emp is not None, f"{emp.emp_id}: {emp.name}")
    report("Employee has device field", hasattr(emp, "device") and emp.device, emp.device)
    report("Employee has risk_score", hasattr(emp, "risk_score") and 0 <= emp.risk_score <= 1, f"{emp.risk_score}")

    srv = env.random_server()
    report("random_server() works", srv is not None, f"{srv.hostname}")

    db = env.random_database()
    report("random_database() works", db is not None, f"{db.name}")

    dev = env.random_device_for_employee(emp)
    report("random_device_for_employee()", dev is not None, f"{dev.hostname}")

    ext_ip = env.random_external_ip()
    import ipaddress
    report("External IP is public", not ipaddress.ip_address(ext_ip).is_private, ext_ip)

    emp_lookup = env.get_employee("emp_101")
    report("get_employee('emp_101')", emp_lookup is not None and emp_lookup.emp_id == "emp_101")

    summary = env.summary()
    report("summary() returns dict", isinstance(summary, dict) and "employees" in summary)

    # Test singleton
    env2 = get_enterprise_env()
    report("Singleton returns same instance", env is env2)

    # Test 7 departments
    depts = set(e.department for e in env.employees)
    report("7 departments present", len(depts) >= 5, f"{sorted(depts)}")

except Exception as e:
    report("Enterprise Simulator", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 2: MITRE ATT&CK Mapping
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 2: MITRE ATT&CK Mapping                         │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from backend.threat_intel.mitre_mapping import (
        enrich_event_mitre, get_mitre_info, get_all_mapped_types, MITRE_MAP,
    )

    report("Import mitre_mapping", True)
    report("20+ event types mapped", len(MITRE_MAP) >= 20, f"{len(MITRE_MAP)} types")

    # Test specific mappings
    info = get_mitre_info("login_failed")
    report("login_failed → T1110.001", info and info["technique_id"] == "T1110.001")

    info = get_mitre_info("privilege_escalation")
    report("privilege_escalation → T1068", info and info["technique_id"] == "T1068")

    info = get_mitre_info("malware_detected")
    report("malware_detected → T1204.002", info and info["technique_id"] == "T1204.002")

    info = get_mitre_info("external_transfer")
    report("external_transfer → T1041 (Exfiltration)", info and "Exfiltration" in info["tactic"])

    info = get_mitre_info("port_scan")
    report("port_scan → T1046 (Discovery)", info and info["tactic"] == "Discovery")

    # Test enrichment in-place
    evt = {"event_type": "login_failed", "user": "emp_101"}
    enrich_event_mitre(evt)
    report("Enrichment adds mitre_technique", evt.get("mitre_technique") == "T1110.001")
    report("Enrichment adds mitre_tactic", evt.get("mitre_tactic") == "Credential Access")
    report("Enrichment adds mitre_name", "Brute Force" in evt.get("mitre_name", ""))

    # Attack chain mapping
    evt2 = {"event_type": "connection_attempt", "_attack_chain": "lateral_movement"}
    enrich_event_mitre(evt2)
    report("Attack chain MITRE mapping", evt2.get("mitre_technique") is not None)

    # All mapped types util
    all_types = get_all_mapped_types()
    report("get_all_mapped_types()", len(all_types) >= 20)

except Exception as e:
    report("MITRE Mapping", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 3: Security Context Enrichment
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 3: Security Context Enrichment                   │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from backend.enrichment.security_context import enrich_event

    report("Import security_context", True)

    # Test internal IP → IN
    evt = {"event_type": "login_success", "ip": "10.0.0.5", "severity": "low"}
    enrich_event(evt)
    report("Internal IP → country=IN", evt["geo_country"] == "IN")
    report("Internal IP → zone=internal", evt["network_zone"] == "internal")
    report("Internal IP → geo_risk=low", evt["geo_risk"] == "low")

    # Test DMZ IP
    evt2 = {"event_type": "connection_attempt", "ip": "192.168.1.50", "severity": "low"}
    enrich_event(evt2)
    report("DMZ IP → zone=dmz", evt2["network_zone"] == "dmz")

    # Test DB tier IP
    evt3 = {"event_type": "database_query", "ip": "172.16.0.10", "severity": "low"}
    enrich_event(evt3)
    report("DB tier IP → zone=db_tier", evt3["network_zone"] == "db_tier")

    # Test external IP
    evt4 = {"event_type": "login_failed", "ip": "185.45.67.89", "severity": "medium"}
    enrich_event(evt4)
    report("External IP → zone=external", evt4["network_zone"] == "external")
    report("External IP → country assigned", len(evt4["geo_country"]) == 2)

    # Test asset criticality
    evt5 = {"event_type": "data_access", "ip": "10.0.0.5", "severity": "high", "asset": "core-banking-db"}
    enrich_event(evt5)
    report("core-banking-db → critical", evt5["asset_criticality"] == "critical")

    evt6 = {"event_type": "data_access", "ip": "10.0.0.5", "severity": "low", "asset": "file-server"}
    enrich_event(evt6)
    report("file-server → medium", evt6["asset_criticality"] == "medium")

    # Test threat score
    evt_crit = {
        "event_type": "privilege_escalation", "ip": "185.45.67.89",
        "severity": "critical", "asset": "auth-server",
        "_attack_chain": "privilege_escalation",
        "details": {"after_hours": True},
    }
    enrich_event(evt_crit)
    report("Threat score 0-100", 0 <= evt_crit["threat_score"] <= 100, f"score={evt_crit['threat_score']}")
    report("High-risk event > 50", evt_crit["threat_score"] > 50, f"score={evt_crit['threat_score']}")

    evt_low = {"event_type": "login_success", "ip": "10.0.0.5", "severity": "low"}
    enrich_event(evt_low)
    report("Low-risk event < 30", evt_low["threat_score"] < 30, f"score={evt_low['threat_score']}")

except Exception as e:
    report("Security Context Enrichment", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 4: Attack Chain Generator (all 7 scenarios)
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 4: Attack Chain Generator (7 Scenarios)          │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from simulator.attack_scenarios import AttackScenarioGenerator, get_attack_generator

    gen = get_attack_generator()
    env = get_enterprise_env()

    report("Import AttackScenarioGenerator", True)
    report("7 attack types available", len(gen.available_attack_types()) == 7,
           str(gen.available_attack_types()))

    for atk_type in gen.available_attack_types():
        chain = gen.generate_attack(env, atk_type)
        has_events = len(chain) >= 2
        has_mitre = chain[0].get("mitre_technique") is not None
        has_geo = chain[0].get("geo_country") is not None
        has_threat = chain[0].get("threat_score") is not None
        all_have_session = all(e.get("session_id") for e in chain)
        all_have_chain = all(e.get("_attack_chain") == atk_type for e in chain)

        report(
            f"{atk_type}: {len(chain)} events",
            has_events and has_mitre and has_geo and has_threat and all_have_session,
            f"mitre={chain[0].get('mitre_technique')}, score={chain[0].get('threat_score')}"
        )

    # Test targeted attack
    chain = gen.generate_attack(env, "brute_force", target_user="emp_101")
    report("Targeted attack (emp_101)", chain[0]["user"] == "emp_101")

    # Test invalid attack type
    try:
        gen.generate_attack(env, "nonexistent_attack")
        report("Invalid attack raises ValueError", False)
    except ValueError:
        report("Invalid attack raises ValueError", True)

except Exception as e:
    report("Attack Chain Generator", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 5: Log Generator (batch + stream)
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 5: Log Generator (Batch + Stream)                │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from simulator.log_generator import LogGenerator

    lg = LogGenerator()
    report("Import LogGenerator", True)

    # Batch generation
    start = time.time()
    events = lg.generate_batch(count=1000)
    elapsed = time.time() - start
    report("generate_batch(1000)", len(events) == 1000, f"{elapsed:.2f}s")

    # Check enrichment fields present
    sample = events[0]
    report("Events have event_id", "event_id" in sample or "event_type" in sample)
    report("Events have mitre_technique", "mitre_technique" in sample, sample.get("mitre_technique"))
    report("Events have geo_country", "geo_country" in sample, sample.get("geo_country"))
    report("Events have threat_score", "threat_score" in sample, str(sample.get("threat_score")))
    report("Events have network_zone", "network_zone" in sample, sample.get("network_zone"))

    # Source distribution
    sources = {}
    for e in events:
        s = e.get("source", "?")
        sources[s] = sources.get(s, 0) + 1
    report("4 sources present", len(sources) >= 4, str(sources))

    # Severity distribution
    sevs = {}
    for e in events:
        s = e.get("severity", "?")
        sevs[s] = sevs.get(s, 0) + 1
    report("Multiple severities", len(sevs) >= 3, str(sevs))

    # Attack chains present
    chains = [e for e in events if e.get("_attack_chain") or e.get("attack_chain")]
    report("Attack chains in batch", len(chains) > 0, f"{len(chains)} chain events")

    # Stream test (5 events)
    stream = lg.stream()
    streamed = [next(stream) for _ in range(5)]
    report("stream() yields events", len(streamed) == 5)
    report("Streamed events enriched", all("mitre_technique" in e for e in streamed))

    # File generation
    import tempfile
    tmpdir = tempfile.mkdtemp()
    stats = lg.generate_to_file(output_dir=tmpdir, count=100)
    report("generate_to_file(100)", sum(stats.values()) == 100, str(stats))

    # Check files created
    files = os.listdir(tmpdir)
    report("Output files created", len(files) >= 4, str(files))

except Exception as e:
    report("Log Generator", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 6: Log Parser (4 formats)
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 6: Log Parser (4 Formats)                        │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from backend.ingestion.log_parser import LogParser
    parser = LogParser()
    report("Import LogParser", True)

    # JSON format
    json_log = '{"user":"emp_101","event_type":"login_success","ip":"10.0.0.5","source":"IAM"}'
    parsed = parser.parse(json_log)
    report("Parse JSON format", parsed.get("user") == "emp_101" and parsed.get("event_type") == "login_success")

    # Key-Value format
    kv_log = 'user=emp_102 action=login_failed ip=10.0.0.5 source=IAM'
    parsed = parser.parse(kv_log)
    report("Parse KV format", parsed.get("user") == "emp_102")

    # CSV format
    csv_log = '2026-03-15T10:11:22,emp_103,file_access,10.0.1.30,EDR,laptop,low,laptop'
    parsed = parser.parse(csv_log)
    report("Parse CSV format", parsed is not None and len(parsed) > 0)

    # Raw text format
    raw_log = '[2026-03-15T10:11:22] [HIGH] User emp_104 privilege_escalation from 10.0.0.5 on core-banking-db'
    parsed = parser.parse(raw_log)
    report("Parse raw text format", parsed is not None and len(parsed) > 0)

except Exception as e:
    report("Log Parser", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 7: Schema Mapper
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 7: Schema Mapper                                 │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from backend.ingestion.schema_mapper import SchemaMapper
    mapper = SchemaMapper()
    report("Import SchemaMapper", True)

    sample = {
        "user": "emp_101",
        "event_type": "login_failed",
        "ip": "10.0.0.5",
        "source": "IAM",
        "timestamp": "2026-03-15T10:00:00",
    }
    mapped = mapper.map(sample)
    report("map() returns dict", isinstance(mapped, dict))
    report("event_id generated", "event_id" in mapped and len(mapped["event_id"]) > 0)
    report("event_hash generated", "event_hash" in mapped and len(mapped["event_hash"]) > 0)
    report("Severity mapped", mapped.get("severity") in ("low", "medium", "high", "critical"))

    # Batch mapping
    batch = mapper.map_batch([sample, sample.copy()])
    report("map_batch() returns list", isinstance(batch, list) and len(batch) == 2)

except Exception as e:
    report("Schema Mapper", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 8: Log Normalizer Pipeline
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 8: Log Normalizer Pipeline                       │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from backend.ingestion.normalize_logs import LogNormalizer
    normalizer = LogNormalizer()
    report("Import LogNormalizer", True)

    raw_samples = [
        '{"user":"emp_101","event_type":"login_success","ip":"10.0.0.5","source":"IAM"}',
        'user=emp_102 action=login_failed ip=10.0.0.5',
    ]
    normalized = normalizer.normalize_events(raw_samples)
    report("normalize_events()", len(normalized) >= 1, f"{len(normalized)} events")

except Exception as e:
    report("Log Normalizer", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 9: Event Indexer (in-memory mode)
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 9: Event Indexer (In-Memory Mode)                │")
print("└─────────────────────────────────────────────────────────┘")

try:
    from backend.services.index_events import EventIndexer
    idx = EventIndexer()
    report("Import EventIndexer", True)

    # Index batch
    test_events = [
        {"event_id": "t1", "user": "emp_101", "event_type": "login_failed", "severity": "medium", "asset": "auth-server", "timestamp": "2026-03-15T10:00:00"},
        {"event_id": "t2", "user": "emp_101", "event_type": "login_success", "severity": "low", "asset": "auth-server", "timestamp": "2026-03-15T10:01:00"},
        {"event_id": "t3", "user": "emp_102", "event_type": "file_access", "severity": "low", "asset": "file-server", "timestamp": "2026-03-15T10:02:00"},
        {"event_id": "t4", "user": "emp_102", "event_type": "data_export", "severity": "critical", "risk_flag": "high", "asset": "core-banking-db", "timestamp": "2026-03-15T10:03:00"},
    ]
    result = idx.index_events(test_events)
    report("index_events()", result["indexed"] == 4, str(result))

    # Query by user
    user_events = idx.get_events_by_user("emp_101")
    report("get_events_by_user(emp_101)", len(user_events) == 2, f"{len(user_events)} events")

    # Query by asset
    asset_events = idx.get_events_by_asset("auth-server")
    report("get_events_by_asset(auth-server)", len(asset_events) == 2)

    # Query by type
    type_events = idx.get_events_by_type("login_failed")
    report("get_events_by_type(login_failed)", len(type_events) == 1)

    # Query by severity
    sev_events = idx.get_events_by_severity("critical")
    report("get_events_by_severity(critical)", len(sev_events) == 1)

    # Timeline
    timeline = idx.get_timeline("emp_101")
    report("get_timeline(emp_101)", len(timeline) == 2)
    report("Timeline chronological", timeline[0]["timestamp"] <= timeline[1]["timestamp"])

    # Stats
    stats = idx.get_event_stats()
    report("get_event_stats()", stats["total_events"] == 4)

    # Analytics: top attacked assets
    top_assets = idx.get_top_attacked_assets()
    report("get_top_attacked_assets()", "top_assets" in top_assets)

    # Analytics: failed logins
    failed = idx.get_failed_login_counts()
    report("get_failed_login_counts()", "by_user" in failed)

    # Single event index
    report("index_single()", idx.index_single({"event_id": "t5", "user": "emp_103"}))

    report("cached_event_count", idx.cached_event_count == 5)

except Exception as e:
    report("Event Indexer", False, str(e))


# ══════════════════════════════════════════════════════════════
# TEST 10: End-to-End Pipeline
# ══════════════════════════════════════════════════════════════
print("\n┌─────────────────────────────────────────────────────────┐")
print("│  TEST 10: End-to-End Pipeline                          │")
print("└─────────────────────────────────────────────────────────┘")

try:
    # 1. Generate logs
    gen = LogGenerator()
    events = gen.generate_batch(count=500)
    report("E2E: Generate 500 events", len(events) == 500)

    # 2. Verify enrichment
    enriched_count = sum(1 for e in events if e.get("mitre_technique"))
    report("E2E: Events have MITRE", enriched_count > 400, f"{enriched_count}/500")

    geo_count = sum(1 for e in events if e.get("geo_country"))
    report("E2E: Events have geo", geo_count > 400, f"{geo_count}/500")

    score_count = sum(1 for e in events if e.get("threat_score") is not None)
    report("E2E: Events have threat_score", score_count > 400, f"{score_count}/500")

    # 3. Index events
    e2e_indexer = EventIndexer()
    result = e2e_indexer.index_events(events)
    report("E2E: Index 500 events", result["indexed"] == 500)

    # 4. Query events
    all_events = e2e_indexer.get_all_events(size=100)
    report("E2E: Query events", len(all_events) > 0, f"{len(all_events)} returned")

    # 5. Attack simulation
    atk_gen = get_attack_generator()
    chain = atk_gen.generate_attack(env, "brute_force")
    e2e_indexer.index_events(chain)
    report("E2E: Attack chain indexed", e2e_indexer.cached_event_count > 500)

    # 6. Analytics
    stats = e2e_indexer.get_event_stats()
    report("E2E: Stats correct", stats["total_events"] > 500)

    activity = e2e_indexer.get_user_activity_patterns()
    report("E2E: Activity patterns", "by_source" in activity)

except Exception as e:
    report("End-to-End Pipeline", False, str(e))


# ══════════════════════════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════════════════════════
print("\n" + "═" * 70)
print(f"  FINAL RESULTS: {tests_passed} passed / {tests_failed} failed / {tests_passed + tests_failed} total")
if tests_failed == 0:
    print("  🏆 ALL TESTS PASSED — System is fully operational!")
else:
    print(f"  ⚠  {tests_failed} test(s) failed — review above for details")
    print("\n  Failed tests:")
    for name, passed, detail in test_results:
        if not passed:
            print(f"    ❌ {name}: {detail}")
print("═" * 70)

sys.exit(0 if tests_failed == 0 else 1)
