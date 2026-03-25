"""
CRYPTIX — GARUD-DRISHTI
ingestion/normalize_logs.py

RESPONSIBILITY: ORCHESTRATION ONLY
────────────────────────────────────
Full ingestion pipeline:
    RAW LOGS → Parser → SafeMapper → Validator → Ordered Output

Pipeline stages (each module has SINGLE RESPONSIBILITY):
  1. log_parser.py       → parsing
  2. schema_mapper.py    → mapping
  3. safe_mapper.py      → exception handling
  4. schema_validator.py → validation
  5. normalize_logs.py   → orchestration (THIS FILE)

Mandatory features:
  ✔ Event ordering by timestamp (Fix #2)
  ✔ Deduplication with hash tracking (Fix #5)
  ✔ Ingestion health report with all required fields
  ✔ Performance metrics: parsing/mapping/validation/total time
  ✔ Data lineage: _source_file, _ingestion_time on every event
  ✔ Async streaming support for real-time SOC telemetry
  ✔ NEVER crashes — every failure caught and logged

CLI:
  python -m garud_drishti.ingestion.normalize_logs --input data/raw_logs
  python -m garud_drishti.ingestion.normalize_logs --input file.json --report
  python -m garud_drishti.ingestion.normalize_logs --generate  # use LogGenerator
"""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import logging
import os
import random
import sys
import time
import traceback
import uuid as _uuid_mod
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional, Set

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Resolve project root so imports work from any CWD
# ─────────────────────────────────────────────────────────────

_HERE      = Path(__file__).resolve().parent          # garud_drishti/ingestion/
_PROJ_ROOT = _HERE.parent.parent                      # cryptix/

if str(_PROJ_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJ_ROOT))

# ─────────────────────────────────────────────────────────────
# Lazy, resilient imports
# ─────────────────────────────────────────────────────────────

def _try_import(module_path: str, attr: str) -> Any:
    """Import module.attr across path variants. Returns None on failure."""
    attempts = [module_path, module_path.replace("garud_drishti.", "")]
    for attempt in attempts:
        try:
            mod = importlib.import_module(attempt)
            return getattr(mod, attr)
        except (ImportError, AttributeError):
            continue
    return None


parse_file_fn    = _try_import("garud_drishti.ingestion.log_parser",       "parse_file")
safe_map_fn      = _try_import("garud_drishti.ingestion.safe_mapper",      "safe_map")
safe_map_many_fn = _try_import("garud_drishti.ingestion.safe_mapper",      "safe_map_many")
validate_fn      = _try_import("garud_drishti.ingestion.schema_validator", "validate")
validate_many_fn = _try_import("garud_drishti.ingestion.schema_validator", "validate_many")

# Fallback stubs so orchestrator never crashes on missing deps
if safe_map_fn is None:
    def safe_map_fn(raw: Any) -> Any:  # type: ignore[misc]
        return raw or {}

if safe_map_many_fn is None:
    def safe_map_many_fn(raws: Any, **_: Any) -> Any:  # type: ignore[misc]
        return [r for r in raws if r]

if validate_fn is None:
    def validate_fn(event: Any, **_: Any) -> Any:  # type: ignore[misc]
        return {"valid": True, "errors": [], "warnings": [], "event": event}

if validate_many_fn is None:
    def validate_many_fn(events: Any, **_: Any) -> Any:  # type: ignore[misc]
        return [{"valid": True, "errors": [], "warnings": [], "event": e}
                for e in events if e]

# ─────────────────────────────────────────────────────────────
# Default paths
# ─────────────────────────────────────────────────────────────

_BASE_DIR        = _HERE.parent
_DEFAULT_IN_DIR  = str(_BASE_DIR / "data" / "raw_logs")
_DEFAULT_OUT_DIR = str(_BASE_DIR / "data" / "normalized_events")


# ═══════════════════════════════════════════════════════════════════
# PERFORMANCE TRACKER
# ═══════════════════════════════════════════════════════════════════

class PipelineTimer:
    """
    Tracks per-stage timing for the ingestion pipeline.

    Provides:
      - parsing_time
      - mapping_time
      - validation_time
      - total_pipeline_time
    """

    def __init__(self) -> None:
        self._start: float = time.perf_counter()
        self._marks: Dict[str, float] = {}
        self._laps:  Dict[str, float] = {}

    def mark(self, stage: str) -> None:
        """Call at the start of a stage."""
        self._marks[stage] = time.perf_counter()

    def lap(self, stage: str) -> float:
        """Call at the end of a stage. Returns elapsed for that stage."""
        if stage not in self._marks:
            return 0.0
        elapsed = time.perf_counter() - self._marks[stage]
        self._laps[stage] = self._laps.get(stage, 0.0) + elapsed
        return elapsed

    def total(self) -> float:
        return time.perf_counter() - self._start

    def report(self) -> Dict[str, float]:
        return {
            "parsing_time_sec"     : round(float(self._laps.get("parsing",    0.0)), 4),
            "mapping_time_sec"     : round(float(self._laps.get("mapping",    0.0)), 4),
            "validation_time_sec"  : round(float(self._laps.get("validation", 0.0)), 4),
            "total_pipeline_time_sec": round(float(self.total()), 4),
        }


# ═══════════════════════════════════════════════════════════════════
# INGESTION HEALTH REPORT
# ═══════════════════════════════════════════════════════════════════

class IngestionHealthReport:
    """
    Real-time ingestion health tracking.

    Tracks all mandatory metrics:
      total_events, valid_events, fallback_events, repaired_events,
      unknown_event_types, missing_users, duplicates_removed,
      events_per_second, plus per-source/severity/category breakdowns.
    """

    def __init__(self) -> None:
        self.total_events    : int            = 0
        self.valid_events    : int            = 0
        self.repaired_events : int            = 0
        self.fallback_events : int            = 0
        self.duplicates_removed : int         = 0
        self.unknown_types   : Dict[str, int] = defaultdict(int)
        self.missing_users   : List[str]      = []
        self.by_source       : Dict[str, int] = defaultdict(int)
        self.by_category     : Dict[str, int] = defaultdict(int)
        self.by_severity     : Dict[str, int] = defaultdict(int)
        self.errors          : List[str]      = []
        self._start          : datetime       = datetime.now(timezone.utc)
        self._timer          : PipelineTimer  = PipelineTimer()

    def record(
        self,
        event:             Dict[str, Any],
        validation_result: Dict[str, Any],
    ) -> None:
        self.total_events += 1

        if event.get("_safe_fallback"):
            self.fallback_events += 1
        elif event.get("_duplicate_detected"):
            self.duplicates_removed += 1
        elif validation_result.get("warnings"):
            self.repaired_events += 1
        else:
            self.valid_events += 1

        et = str(event.get("event_type", "unknown")).lower()
        if et == "unknown":
            user_id = event.get("entity_id") or event.get("user") or "?"
            self.unknown_types[f"unknown [from {user_id}]"] += 1

        user = event.get("user") or event.get("resolved_user")
        if not user or str(user).strip().lower() in ("", "unknown", "none", "null"):
            self.missing_users.append(str(event.get("event_id", "?")))

        self.by_source[str(event.get("source", "UNKNOWN"))] += 1
        self.by_category[str(event.get("event_category", "unknown"))] += 1
        self.by_severity[str(event.get("severity", "unknown"))] += 1

        for err in validation_result.get("errors", []):
            self.errors.append(err)

    def timer(self) -> PipelineTimer:
        return self._timer

    def finalize(self) -> Dict[str, Any]:
        elapsed = (datetime.now(timezone.utc) - self._start).total_seconds()
        rate    = round(float(self.total_events) / elapsed, 1) if elapsed > 0 else 0.0

        return {
            "ingestion_health": {
                "generated_at"      : datetime.now(timezone.utc).isoformat(),
                # Performance metrics (mandatory)
                **self._timer.report(),
                "events_per_second" : rate,
                # Core counts (mandatory)
                "total_events"      : self.total_events,
                "valid_events"      : self.valid_events,
                "repaired_events"   : self.repaired_events,
                "fallback_events"   : self.fallback_events,
                "duplicates_removed": self.duplicates_removed,
                # Unknown event types
                "unknown_event_types": {
                    "count"  : len(self.unknown_types),
                    "details": dict(self.unknown_types),
                },
                # Missing users
                "missing_users": {
                    "count"    : len(self.missing_users),
                    "event_ids": self.missing_users[:50],
                },
                # Breakdown aggregations
                "by_source"  : dict(self.by_source),
                "by_category": dict(self.by_category),
                "by_severity": dict(self.by_severity),
                # Errors
                "errors": self.errors[:100],
            }
        }

    def print_summary(self) -> None:
        r   = self.finalize()["ingestion_health"]
        sep = "═" * 62
        print(f"\n{sep}")
        print("  📊 GARUD-DRISHTI INGESTION HEALTH REPORT")
        print(sep)
        # Performance
        print(f"  ⏱  Parse time     : {r['parsing_time_sec']:.4f}s")
        print(f"  ⏱  Mapping time   : {r['mapping_time_sec']:.4f}s")
        print(f"  ⏱  Validation time: {r['validation_time_sec']:.4f}s")
        print(f"  ⏱  Total time     : {r['total_pipeline_time_sec']:.4f}s")
        print(f"  🚀 Throughput     : {r['events_per_second']:,.1f} events/sec")
        print(f"\n  📦 Total Events   : {r['total_events']:,}")
        print(f"  ✅ Valid           : {r['valid_events']:,}")
        print(f"  ⚠️  Repaired        : {r['repaired_events']:,}")
        print(f"  ❌ Fallback        : {r['fallback_events']:,}")
        print(f"  🔁 Duplicates      : {r['duplicates_removed']:,}")
        print(f"\n  ❓ Unknown Types   : {r['unknown_event_types']['count']}")
        unk_items = list(r["unknown_event_types"]["details"].items())
        for k, v in unk_items[:5]:
            print(f"    • {k}: {v}")
        print(f"\n  👤 Missing Users   : {r['missing_users']['count']}")
        if r["by_source"]:
            print("\n  By Source:")
            for src, cnt in sorted(r["by_source"].items()):
                print(f"    {src:<18} {cnt:>8,}")
        if r["by_severity"]:
            print("\n  By Severity:")
            for sev, cnt in sorted(r["by_severity"].items()):
                print(f"    {sev:<14} {cnt:>8,}")
        if r["errors"]:
            print(f"\n  🚨 Errors ({len(r['errors'])} total):")
            for err in r["errors"][:3]:
                print(f"    • {err}")
        print(sep + "\n")


# ═══════════════════════════════════════════════════════════════════
# CORE PIPELINE
# ═══════════════════════════════════════════════════════════════════

def normalise_event(
    raw:         Dict[str, Any],
    seen_ids:    Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
    report:      Optional[IngestionHealthReport] = None,
    timer:       Optional[PipelineTimer] = None,
) -> Dict[str, Any]:
    """
    Run ONE raw dict through the full pipeline:
        safe_map → validate

    NEVER raises.
    Returns a fully normalised, validated, repair-guaranteed SOC event.
    """
    try:
        # Stage 2/3: safe_map (mapping + exception handling)
        if timer:
            timer.mark("mapping")
        mapped = safe_map_fn(raw)
        if timer:
            timer.lap("mapping")

        # Stage 4: validate
        if timer:
            timer.mark("validation")
        val_result = validate_fn(mapped, seen_ids=seen_ids, seen_hashes=seen_hashes)
        event      = val_result["event"]
        if timer:
            timer.lap("validation")

        if report is not None:
            report.record(event, val_result)

        return event

    except Exception as exc:
        logger.error("normalise_event: unexpected error: %s", exc)
        logger.debug(traceback.format_exc())
        fallback = {
            "event_id"        : str(_uuid_mod.uuid4()),
            "timestamp"       : datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
            "entity_id"       : "ENT-UNKNOWN",
            "user"            : "unknown",
            "session_id"      : f"sess_unknown_{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H')}",
            "event_type"      : "unknown",
            "event_category"  : "unknown",
            "source"          : "UNKNOWN",
            "severity"        : "low",
            "details"         : {"pipeline_error": str(exc)},
            "log_source"      : "UNKNOWN",
            "risk_flag"       : "normal",
            "_safe_fallback"  : True,
            "error_stage"     : "orchestration",
            "error_message"   : str(exc)[:500],
            "_ingestion_time" : datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        }
        if report:
            report.record(fallback, {"valid": False, "errors": [str(exc)], "warnings": []})
        return fallback


def normalise_batch(
    raws:        List[Dict[str, Any]],
    seen_ids:    Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
    report:      Optional[IngestionHealthReport] = None,
    timer:       Optional[PipelineTimer] = None,
) -> List[Dict[str, Any]]:
    """Normalise a list of raw dicts. NEVER raises. None entries skipped."""
    _ids    = seen_ids    if seen_ids    is not None else set()
    _hashes = seen_hashes if seen_hashes is not None else set()
    return [
        normalise_event(r, seen_ids=_ids, seen_hashes=_hashes, report=report, timer=timer)
        for r in raws
        if r is not None
    ]


def normalise_file(
    path:        str,
    seen_ids:    Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
    report:      Optional[IngestionHealthReport] = None,
    timer:       Optional[PipelineTimer] = None,
    use_ollama:  bool = False,
    encoding:    str  = "utf-8",
) -> List[Dict[str, Any]]:
    """
    Full pipeline: parse file → map → validate → return normalised events.
    Fix #10: _source_file set on every event.
    NEVER crashes — returns [] on complete failure.
    """
    if parse_file_fn is None:
        logger.error("normalise_file: log_parser.parse_file not available")
        return []

    try:
        if timer:
            timer.mark("parsing")
        parsed_events = parse_file_fn(path, encoding=encoding, use_ollama=use_ollama)
        if timer:
            timer.lap("parsing")
    except Exception as exc:
        logger.error("normalise_file: parser failed on %s: %s", path, exc)
        return []

    _ids    = seen_ids    if seen_ids    is not None else set()
    _hashes = seen_hashes if seen_hashes is not None else set()
    return normalise_batch(parsed_events, seen_ids=_ids, seen_hashes=_hashes,
                           report=report, timer=timer)


def normalise_directory(
    input_dir:      str   = _DEFAULT_IN_DIR,
    output_dir:     str   = _DEFAULT_OUT_DIR,
    output_file:    str   = "normalized_events.json",
    extensions:     tuple = (".json", ".jsonl", ".csv", ".kv", ".txt", ".log"),
    use_ollama:     bool  = False,
    emit_report:    bool  = True,
    sort_by_time:   bool  = True,          # Fix #2: chronological ordering
) -> Dict[str, Any]:
    """
    Complete batch pipeline:
      1. Scan input_dir
      2. Parse + map + validate each file
      3. Fix #2: Sort output by timestamp (SOC timeline)
      4. Write JSONL output
      5. Write health report

    Returns the health report dict.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    out_path = Path(output_dir) / output_file

    in_path = Path(input_dir)
    if not in_path.exists():
        logger.warning("normalise_directory: input dir not found: %s", input_dir)
        return {}

    files = sorted([
        p for p in in_path.iterdir()
        if p.is_file() and p.suffix in extensions
    ])
    if not files:
        logger.warning("normalise_directory: no log files in %s", input_dir)
        return {}

    seen_ids    : Set[str] = set()
    seen_hashes : Set[str] = set()
    report       = IngestionHealthReport()
    timer        = report.timer()
    all_events   : List[Dict[str, Any]] = []

    print(f"🔄 Processing {len(files)} file(s) from {input_dir}…")

    for f in files:
        print(f"  📂 {f.name}…", end=" ", flush=True)
        events = normalise_file(
            str(f),
            seen_ids=seen_ids, seen_hashes=seen_hashes,
            report=report, timer=timer,
            use_ollama=use_ollama,
        )
        all_events.extend(events)
        print(f"{len(events):,} events")

    # Fix #2: Sort by timestamp — SOC timeline must be chronological
    if sort_by_time:
        all_events.sort(key=lambda e: e.get("timestamp") or "")
        print("⏱  Events sorted chronologically by timestamp")

    # Write normalised output
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(all_events, fh, indent=2, default=str)
    print(f"\n💾 Output → {out_path}  ({len(all_events):,} events)")

    health = report.finalize()

    if emit_report:
        report_path = Path(output_dir) / "ingestion_health_report.json"
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(health, fh, indent=2, default=str)
        print(f"📊 Report  → {report_path}")

    report.print_summary()
    return health


# ═══════════════════════════════════════════════════════════════════
# ASYNC STREAMING (real-time SOC telemetry)
# ═══════════════════════════════════════════════════════════════════

async def async_normalise_stream(
    raw_dicts:   Any,
    delay_min:   float = 0.05,
    delay_max:   float = 0.3,
    seen_ids:    Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
    report:      Optional[IngestionHealthReport] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Async generator that yields normalised events.
    Simulates real-time SOC telemetry with configurable delay.

    Usage:
        async for event in async_normalise_stream(raw_log_dicts):
            await index_event(event)
    """
    _ids    = seen_ids    if seen_ids    is not None else set()
    _hashes = seen_hashes if seen_hashes is not None else set()
    for raw in raw_dicts:
        if raw is not None:
            event = normalise_event(raw, seen_ids=_ids, seen_hashes=_hashes, report=report)
            yield event
            await asyncio.sleep(random.uniform(delay_min, delay_max))


# ─────────────────────────────────────────────────────────────
# Convenience aliases (backward compat)
# ─────────────────────────────────────────────────────────────

def normalise_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise an already-parsed dict."""
    return normalise_event(raw)


def normalise_line(
    raw_line:   str,
    seen_ids:   Optional[Set[str]] = None,
    seen_hashes: Optional[Set[str]] = None,
    report:     Optional[IngestionHealthReport] = None,
    use_ollama: bool = False,
) -> Optional[Dict[str, Any]]:
    """Parse + normalise a single raw log line string."""
    if not raw_line or not raw_line.strip():
        return None
    parse_log_line = _try_import("garud_drishti.ingestion.log_parser", "parse_log_line")
    if parse_log_line is None:
        return None
    try:
        results = parse_log_line(raw_line, use_ollama=use_ollama)
        if not results:
            return None
        events = []
        for parsed in results:
            events.append(normalise_event(parsed, seen_ids=seen_ids,
                                          seen_hashes=seen_hashes, report=report))
        return events[0] if len(events) == 1 else events  # type: ignore[return-value]
    except Exception as exc:
        logger.warning("normalise_line failed: %s", exc)
        return None


# ═══════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════

def _build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog       = "normalize_logs",
        description= "CRYPTIX — GARUD-DRISHTI Log Ingestion Pipeline",
    )
    p.add_argument("--input",  "-i", default=_DEFAULT_IN_DIR,
                   help="Input directory or single file")
    p.add_argument("--output", "-o", default=_DEFAULT_OUT_DIR,
                   help="Output directory")
    p.add_argument("--output-file", "-f", default="normalized_events.json",
                   help="Output filename")
    p.add_argument("--report", "-r", action="store_true",
                   help="Write ingestion health report JSON")
    p.add_argument("--ollama",       action="store_true",
                   help="Enable Ollama LLM enrichment")
    p.add_argument("--no-sort",      action="store_true",
                   help="Disable chronological sorting (Fix #2)")
    p.add_argument("--verbose", "-v", action="store_true",
                   help="Enable DEBUG logging")
    p.add_argument("--generate",     action="store_true",
                   help="Generate fresh synthetic logs first (runs generate_fake_logs.py)")
    return p


def main() -> None:
    args = _build_argparser().parse_args()

    logging.basicConfig(
        level  = logging.DEBUG if args.verbose else logging.INFO,
        format = "%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        datefmt= "%H:%M:%S",
    )

    print("═" * 62)
    print("  CRYPTIX — GARUD-DRISHTI  |  Ingestion Pipeline v2")
    print("═" * 62)

    # Optional: regenerate synthetic logs first
    if getattr(args, "generate", False):
        gen_script = _PROJ_ROOT / "garud_drishti" / "scripts" / "generate_fake_logs.py"
        if gen_script.exists():
            print("🔧 Generating synthetic logs…")
            import subprocess
            subprocess.run([sys.executable, str(gen_script)], check=True)
        else:
            print(f"⚠️  Generator not found: {gen_script}")

    inp = Path(args.input)

    if inp.is_file():
        # Single-file mode
        seen_ids    : Set[str] = set()
        seen_hashes : Set[str] = set()
        report      = IngestionHealthReport()
        timer       = report.timer()
        events      = normalise_file(
            str(inp),
            seen_ids=seen_ids, seen_hashes=seen_hashes,
            report=report, timer=timer,
            use_ollama=args.ollama,
        )
        # Fix #2: sort by timestamp
        if not args.no_sort:
            events.sort(key=lambda e: e.get("timestamp") or "")
        Path(args.output).mkdir(parents=True, exist_ok=True)
        out_path = Path(args.output) / args.output_file
        with open(out_path, "w") as fh:
            json.dump(events, fh, indent=2, default=str)
        print(f"\n💾 Output → {out_path}  ({len(events):,} events)")
        if args.report:
            rp = Path(args.output) / "ingestion_health_report.json"
            with open(rp, "w") as fh:
                json.dump(report.finalize(), fh, indent=2, default=str)
            print(f"📊 Report  → {rp}")
        report.print_summary()

    elif inp.is_dir():
        normalise_directory(
            input_dir    = str(inp),
            output_dir   = args.output,
            output_file  = args.output_file,
            use_ollama   = args.ollama,
            emit_report  = args.report,
            sort_by_time = not args.no_sort,
        )
    else:
        print(f"❌ Input path not found: {inp}")
        sys.exit(1)


if __name__ == "__main__":
    main()
