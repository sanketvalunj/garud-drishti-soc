#!/usr/bin/env python3
"""
CRYPTIX — GARUD-DRISHTI
run_ingestion.py

Standalone pipeline runner.
Reads all files from data/raw_logs/, normalises them,
writes data/normalized_events/normalized_events.json
and data/normalized_events/ingestion_health_report.json
"""

import json
import os
import sys
import time
from pathlib import Path

# ── Project root resolution ────────────────────────────────────────
PROJ      = Path(__file__).resolve().parent            # cryptix/
INPUT_DIR = PROJ / "garud_drishti" / "data" / "raw_logs"
OUT_DIR   = PROJ / "garud_drishti" / "data" / "normalized_events"
OUT_FILE  = OUT_DIR / "normalized_events.json"
REPORT    = OUT_DIR / "ingestion_health_report.json"

sys.path.insert(0, str(PROJ))
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Imports ────────────────────────────────────────────────────────
from garud_drishti.ingestion.log_parser      import parse_file
from garud_drishti.ingestion.safe_mapper     import safe_map
from garud_drishti.ingestion.schema_validator import validate, reset_trackers

reset_trackers()


def _sep(char="═", n=62):
    print(char * n, flush=True)


_sep()
print("  CRYPTIX — GARUD-DRISHTI  |  Ingestion Pipeline v2")
_sep()
print(f"\n  Input  : {INPUT_DIR}")
print(f"  Output : {OUT_FILE}\n")

# ── Discover input files ───────────────────────────────────────────
EXTS  = {".json", ".jsonl", ".csv", ".txt", ".log"}
files = sorted([f for f in INPUT_DIR.iterdir() if f.is_file() and f.suffix in EXTS])

if not files:
    print(f"❌  No log files found in {INPUT_DIR}")
    sys.exit(1)

print(f"  Found {len(files)} file(s):\n")
for f in files:
    size_mb = f.stat().st_size / (1024 * 1024)
    print(f"    📄 {f.name:<35} ({size_mb:.2f} MB)")
print()

# ── Pipeline state ────────────────────────────────────────────────
seen_ids    : set  = set()
seen_hashes : set  = set()
all_events         = []
total_start        = time.perf_counter()

stats = {
    "total": 0, "valid": 0, "repaired": 0,
    "fallback": 0, "duplicates": 0,
    "unknown_types": 0, "missing_users": 0,
    "by_source": {}, "by_severity": {}, "by_category": {},
    "parsing_sec": 0.0, "mapping_sec": 0.0, "validation_sec": 0.0,
}

# ── Process each file ─────────────────────────────────────────────
for f in files:
    print(f"  📂 {f.name} ...", flush=True)

    # Stage 1: Parse ───────────────────────────────────────────────
    t0 = time.perf_counter()
    try:
        parsed = parse_file(str(f), use_ollama=False)
    except Exception as exc:
        print(f"     ❌ Parser failed: {exc}")
        continue
    stats["parsing_sec"] += time.perf_counter() - t0
    print(f"     parsed   : {len(parsed):>8,} events", flush=True)

    # Stage 2/3 + 4: safe_map → validate ──────────────────────────
    t1 = time.perf_counter()
    file_events = []

    for raw in parsed:
        if raw is None:
            continue
        try:
            # Stage 2/3: safe_map (crash-proof mapper)
            tm = time.perf_counter()
            mapped = safe_map(raw)
            stats["mapping_sec"] += time.perf_counter() - tm

            # Stage 4: validate + repair
            tv = time.perf_counter()
            result = validate(mapped, seen_ids=seen_ids)
            stats["validation_sec"] += time.perf_counter() - tv

            event = result["event"]

            # Fix #5: dedup hash check
            h = event.get("_event_hash", "")
            if h and h in seen_hashes:
                event["_duplicate_detected"] = True
                stats["duplicates"] += 1
            elif h:
                seen_hashes.add(h)

            # Stats
            stats["total"] += 1
            if event.get("_safe_fallback"):
                stats["fallback"] += 1
            elif result.get("warnings"):
                stats["repaired"] += 1
            else:
                stats["valid"] += 1

            et  = str(event.get("event_type", "unknown")).lower()
            usr = str(event.get("user") or event.get("resolved_user") or "")
            if et == "unknown":
                stats["unknown_types"] += 1
            if not usr or usr.strip().lower() in ("", "unknown", "none", "null"):
                stats["missing_users"] += 1

            src = str(event.get("source", "UNKNOWN"))
            sev = str(event.get("severity", "unknown"))
            cat = str(event.get("event_category", "unknown"))
            stats["by_source"][src]   = stats["by_source"].get(src, 0) + 1
            stats["by_severity"][sev] = stats["by_severity"].get(sev, 0) + 1
            stats["by_category"][cat] = stats["by_category"].get(cat, 0) + 1

            file_events.append(event)

        except Exception as exc:
            stats["fallback"] += 1
            stats["total"]    += 1

    elapsed = time.perf_counter() - t1
    print(f"     normalised: {len(file_events):>8,} events  ({elapsed:.2f}s)", flush=True)
    all_events.extend(file_events)

# ── Fix #2: Sort by timestamp ──────────────────────────────────────
print(f"\n  ⏱  Sorting {len(all_events):,} events by timestamp …", flush=True)
all_events.sort(key=lambda e: e.get("timestamp") or "")

total_sec = time.perf_counter() - total_start
eps       = round(len(all_events) / total_sec, 1) if total_sec > 0 else 0.0

# ── Write normalised output ────────────────────────────────────────
print(f"  💾 Writing {len(all_events):,} events to {OUT_FILE} …", flush=True)
with open(OUT_FILE, "w", encoding="utf-8") as fh:
    json.dump(all_events, fh, indent=2, default=str)

size_mb = OUT_FILE.stat().st_size / (1024 * 1024)
print(f"     ✅ Done  — {size_mb:.2f} MB written", flush=True)

# ── Sample event ──────────────────────────────────────────────────
if all_events:
    sample = all_events[0]
    print("\n  📋 SAMPLE EVENT (first after chronological sort):")
    for field in [
        "event_id", "timestamp", "entity_id", "user", "session_id",
        "event_type", "event_category", "source", "severity",
        "_source_file", "_ingestion_time",
    ]:
        print(f"     {field:<24} = {sample.get(field, '(missing)')}")
    if isinstance(sample.get("geo_location"), dict):
        print(f"     {'geo_location':<24} = {sample['geo_location']}")
    det = sample.get("details")
    if isinstance(det, dict):
        print(f"     {'details keys':<24} = {list(det.keys())[:6]}")

# ── Health report ─────────────────────────────────────────────────
health = {
    "ingestion_health": {
        "generated_at"             : time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "parsing_time_sec"         : round(stats["parsing_sec"],    4),
        "mapping_time_sec"         : round(stats["mapping_sec"],    4),
        "validation_time_sec"      : round(stats["validation_sec"], 4),
        "total_pipeline_time_sec"  : round(total_sec,               4),
        "events_per_second"        : eps,
        "total_events"             : stats["total"],
        "valid_events"             : stats["valid"],
        "repaired_events"          : stats["repaired"],
        "fallback_events"          : stats["fallback"],
        "duplicates_removed"       : stats["duplicates"],
        "unknown_event_types"      : {"count": stats["unknown_types"]},
        "missing_users"            : {"count": stats["missing_users"]},
        "by_source"                : stats["by_source"],
        "by_category"              : stats["by_category"],
        "by_severity"              : stats["by_severity"],
    }
}

with open(REPORT, "w", encoding="utf-8") as fh:
    json.dump(health, fh, indent=2)
print(f"\n  📊 Health report → {REPORT}", flush=True)

# ── Terminal summary ───────────────────────────────────────────────
h = health["ingestion_health"]
_sep()
print("  📊 INGESTION HEALTH REPORT")
_sep()
print(f"  ⏱  Parse time       : {h['parsing_time_sec']:.4f}s")
print(f"  ⏱  Mapping time     : {h['mapping_time_sec']:.4f}s")
print(f"  ⏱  Validation time  : {h['validation_time_sec']:.4f}s")
print(f"  ⏱  Total time       : {h['total_pipeline_time_sec']:.4f}s")
print(f"  🚀 Throughput       : {h['events_per_second']:,.1f} events/sec")
print()
print(f"  📦 Total Events     : {h['total_events']:,}")
print(f"  ✅ Valid            : {h['valid_events']:,}")
print(f"  ⚠️  Repaired         : {h['repaired_events']:,}")
print(f"  ❌ Fallback         : {h['fallback_events']:,}")
print(f"  🔁 Duplicates       : {h['duplicates_removed']:,}")
print(f"  ❓ Unknown Types    : {h['unknown_event_types']['count']:,}")
print(f"  👤 Missing Users    : {h['missing_users']['count']:,}")
print()
print("  By Source:")
for src, cnt in sorted(h["by_source"].items()):
    print(f"    {src:<22} {cnt:>10,}")
print()
print("  By Severity:")
for sev, cnt in sorted(h["by_severity"].items()):
    print(f"    {sev:<16} {cnt:>10,}")
print()
print("  By Category:")
for cat, cnt in sorted(h["by_category"].items()):
    print(f"    {cat:<22} {cnt:>10,}")
_sep()
print()
print("  📁 Output files:")
for fp in [OUT_FILE, REPORT]:
    sz = fp.stat().st_size
    print(f"    {fp.name:<40} {sz/1024/1024:.2f} MB")
_sep()
print("  ✅ Pipeline complete — GARUD-DRISHTI ready for SOC")
_sep()
