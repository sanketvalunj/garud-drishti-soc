#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# GARUD-DRISHTI — Ingestion Pipeline Runner
# Usage: bash run_ingestion.sh
# ──────────────────────────────────────────────────────────────

set -euo pipefail

PROJ="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJ"

INPUT_DIR="$PROJ/garud_drishti/data/raw_logs"
OUTPUT_DIR="$PROJ/garud_drishti/data/normalized_events"
OUTPUT_FILE="normalized_events.json"
REPORT_FILE="ingestion_health_report.json"

echo "══════════════════════════════════════════════════════════"
echo "  CRYPTIX — GARUD-DRISHTI  |  Ingestion Pipeline"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  Input  : $INPUT_DIR"
echo "  Output : $OUTPUT_DIR/$OUTPUT_FILE"
echo ""

# Create output dir
mkdir -p "$OUTPUT_DIR"

# Count input files
NUM_FILES=$(ls "$INPUT_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "  Found $NUM_FILES JSON file(s) in raw_logs/"
echo ""

# Run pipeline directly as a Python script (bypasses module stdout issues)
python3 - <<'PYEOF'
import sys, json, time, os
from pathlib import Path

PROJ = Path(__file__).parent if '__file__' in dir() else Path(os.getcwd())
sys.path.insert(0, str(PROJ))

from garud_drishti.ingestion.log_parser       import parse_file
from garud_drishti.ingestion.safe_mapper       import safe_map
from garud_drishti.ingestion.schema_validator  import validate, reset_trackers

reset_trackers()

INPUT_DIR  = PROJ / "garud_drishti" / "data" / "raw_logs"
OUTPUT_DIR = PROJ / "garud_drishti" / "data" / "normalized_events"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

extensions = {".json", ".jsonl", ".csv", ".txt", ".log"}
files = sorted([f for f in INPUT_DIR.iterdir() if f.is_file() and f.suffix in extensions])

seen_ids    = set()
seen_hashes = set()
all_events  = []

total_start = time.perf_counter()

# ── Per-file stats ────────────────────────────────────────────
stats = {
    "total": 0, "valid": 0, "repaired": 0,
    "fallback": 0, "duplicates": 0,
    "by_source": {}, "by_severity": {}, "by_category": {},
    "unknown_types": 0, "missing_users": 0,
}

for f in files:
    t0 = time.perf_counter()
    print(f"  📂 Parsing  : {f.name} ...", flush=True)

    try:
        parsed = parse_file(str(f), use_ollama=False)
    except Exception as exc:
        print(f"     ❌ Parse error: {exc}")
        continue

    print(f"     → {len(parsed):,} raw events parsed in {time.perf_counter()-t0:.2f}s")

    t1 = time.perf_counter()
    file_events = []
    for raw in parsed:
        if raw is None:
            continue
        try:
            mapped = safe_map(raw)
            result = validate(mapped, seen_ids=seen_ids)
            event  = result["event"]

            # Dedup via event_hash
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

            et = str(event.get("event_type", "unknown")).lower()
            if et == "unknown":
                stats["unknown_types"] += 1

            user = event.get("user") or event.get("resolved_user") or ""
            if not user or user.strip().lower() in ("", "unknown", "none", "null"):
                stats["missing_users"] += 1

            src = str(event.get("source", "UNKNOWN"))
            sev = str(event.get("severity", "unknown"))
            cat = str(event.get("event_category", "unknown"))
            stats["by_source"][src]    = stats["by_source"].get(src, 0) + 1
            stats["by_severity"][sev]  = stats["by_severity"].get(sev, 0) + 1
            stats["by_category"][cat]  = stats["by_category"].get(cat, 0) + 1

            file_events.append(event)
        except Exception as exc:
            stats["fallback"] += 1
            stats["total"] += 1

    t2 = time.perf_counter()
    print(f"     → {len(file_events):,} events normalised in {t2-t1:.2f}s")
    all_events.extend(file_events)

# ── Fix #2: Sort by timestamp ──────────────────────────────────
print(f"\n  ⏱  Sorting {len(all_events):,} events by timestamp...", flush=True)
all_events.sort(key=lambda e: e.get("timestamp") or "")

total_elapsed = time.perf_counter() - total_start
eps = round(len(all_events) / total_elapsed, 1) if total_elapsed > 0 else 0

# ── Write JSONL output ─────────────────────────────────────────
out_path = OUTPUT_DIR / "normalized_events.json"
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(all_events, fh, indent=2, default=str)
print(f"\n  💾 Output  → {out_path}", flush=True)
print(f"     Size   : {out_path.stat().st_size / (1024*1024):.2f} MB", flush=True)
print(f"     Events : {len(all_events):,}", flush=True)

# ── Sample first event (verification) ─────────────────────────
if all_events:
    sample = all_events[0]
    print(f"\n  📋 SAMPLE EVENT (first after sort):", flush=True)
    for field in ["event_id","timestamp","entity_id","user","session_id",
                  "event_type","event_category","source","severity","_source_file","_ingestion_time"]:
        print(f"     {field:<22} = {sample.get(field,'(missing)')}", flush=True)
    print(f"     geo_location         = {sample.get('geo_location')}", flush=True)
    det = sample.get("details")
    if isinstance(det, dict):
        print(f"     details keys         = {list(det.keys())[:5]}", flush=True)

# ── Write health report ────────────────────────────────────────
health = {
    "ingestion_health": {
        "generated_at"           : time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_pipeline_time_sec": round(total_elapsed, 4),
        "events_per_second"      : eps,
        "total_events"           : stats["total"],
        "valid_events"           : stats["valid"],
        "repaired_events"        : stats["repaired"],
        "fallback_events"        : stats["fallback"],
        "duplicates_removed"     : stats["duplicates"],
        "unknown_event_types"    : {"count": stats["unknown_types"]},
        "missing_users"          : {"count": stats["missing_users"]},
        "by_source"              : stats["by_source"],
        "by_category"            : stats["by_category"],
        "by_severity"            : stats["by_severity"],
    }
}
report_path = OUTPUT_DIR / "ingestion_health_report.json"
with open(report_path, "w", encoding="utf-8") as fh:
    json.dump(health, fh, indent=2)
print(f"\n  📊 Report  → {report_path}", flush=True)

# ── Print health summary ───────────────────────────────────────
h = health["ingestion_health"]
print(f"""
══════════════════════════════════════════════════════════
  📊 INGESTION HEALTH REPORT
══════════════════════════════════════════════════════════
  ⏱  Total time      : {h['total_pipeline_time_sec']:.4f}s
  🚀 Throughput      : {h['events_per_second']:,.1f} events/sec

  📦 Total Events    : {h['total_events']:,}
  ✅ Valid            : {h['valid_events']:,}
  ⚠️  Repaired         : {h['repaired_events']:,}
  ❌ Fallback         : {h['fallback_events']:,}
  🔁 Duplicates       : {h['duplicates_removed']:,}
  ❓ Unknown Types    : {h['unknown_event_types']['count']:,}
  👤 Missing Users    : {h['missing_users']['count']:,}

  By Source:""", flush=True)
for src, cnt in sorted(h["by_source"].items()):
    print(f"    {src:<20} {cnt:>10,}", flush=True)
print(f"\n  By Severity:", flush=True)
for sev, cnt in sorted(h["by_severity"].items()):
    print(f"    {sev:<16} {cnt:>10,}", flush=True)
print(f"\n  By Category:", flush=True)
for cat, cnt in sorted(h["by_category"].items()):
    print(f"    {cat:<20} {cnt:>10,}", flush=True)
print("══════════════════════════════════════════════════════════", flush=True)
PYEOF

echo ""
echo "✅ Pipeline complete."
echo ""
echo "Output files:"
ls -lh "$OUTPUT_DIR/"
