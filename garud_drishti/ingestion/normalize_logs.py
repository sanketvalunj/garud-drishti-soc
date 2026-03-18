"""
Garud-Drishti — AI SOC Platform
Normalisation Pipeline

Ties together:
  log_parser  →  schema_mapper  →  normalised event dict

Also provides async streaming support for real-time ingestion.
"""

import asyncio
import json
import logging
import random
from pathlib import Path
from typing import AsyncIterator, Dict, Any, Iterator, List

from backend.ingestion.log_parser   import parse_log_line
from backend.ingestion.schema_mapper import get_mapper

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sync normaliser
# ---------------------------------------------------------------------------

def normalise_line(raw_line: str) -> Dict[str, Any] | None:
    """Parse a single raw log line and map it to canonical schema."""
    parsed = parse_log_line(raw_line)
    if parsed is None:
        return None
    return get_mapper().map(parsed)


def normalise_dict(raw_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise an already-parsed dict (e.g. from the generator)."""
    return get_mapper().map(raw_dict)


def normalise_batch(raw_dicts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalise a list of raw dicts."""
    return [normalise_dict(d) for d in raw_dicts]


def normalise_file(path: str) -> List[Dict[str, Any]]:
    """Read a raw log file and return a list of normalised events."""
    results: List[Dict[str, Any]] = []
    errors = 0
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if not line.strip():
                continue
            event = normalise_line(line)
            if event:
                results.append(event)
            else:
                errors += 1
    logger.info(
        "normalise_file: %s → %d events (%d errors)", path, len(results), errors
    )
    return results


# ---------------------------------------------------------------------------
# Async streaming normaliser
# ---------------------------------------------------------------------------

async def async_normalise_stream(
    generator,
    delay_min: float = 0.3,
    delay_max: float = 0.7,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Async generator that yields normalised events from a LogGenerator.
    Sleeps delay_min–delay_max seconds between events to simulate
    real-time SOC telemetry.

    Usage:
        async for event in async_normalise_stream(log_gen):
            await index_event(event)
    """
    for raw_dict in generator.stream():
        event = normalise_dict(raw_dict)
        yield event
        await asyncio.sleep(random.uniform(delay_min, delay_max))


# ---------------------------------------------------------------------------
# Batch file normaliser (writes to disk)
# ---------------------------------------------------------------------------

def normalise_directory(
    input_dir: str = "data/raw_logs",
    output_dir: str = "data/normalized_events",
    output_file: str = "events.jsonl",
) -> int:
    """
    Normalise all log files in input_dir and write JSONL to output_dir.
    Returns total events written.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    out_path  = Path(output_dir) / output_file
    total     = 0

    extensions = {".json", ".kv", ".csv", ".txt", ".log"}
    log_files  = [
        p for p in Path(input_dir).iterdir()
        if p.is_file() and p.suffix in extensions
    ]

    if not log_files:
        logger.warning("No log files found in %s", input_dir)
        return 0

    with open(out_path, "w", encoding="utf-8") as out:
        for log_file in log_files:
            events = normalise_file(str(log_file))
            for event in events:
                out.write(json.dumps(event) + "\n")
                total += 1

    logger.info("Wrote %d normalised events to %s", total, out_path)
    return total


# ---------------------------------------------------------------------------
# CLI convenience
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from simulator.log_generator import LogGenerator

    mode = sys.argv[1] if len(sys.argv) > 1 else "generate"

    if mode == "generate":
        print("Generating 500 sample logs and normalising…")
        gen   = LogGenerator()
        batch = gen.generate_batch(500)
        events = normalise_batch(batch)
        out_path = "data/normalized_events/sample_events.jsonl"
        Path("data/normalized_events").mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            for e in events:
                f.write(json.dumps(e) + "\n")
        print(f"Wrote {len(events)} normalised events → {out_path}")

    elif mode == "file":
        src = sys.argv[2] if len(sys.argv) > 2 else "data/raw_logs/logs.json"
        events = normalise_file(src)
        print(f"Normalised {len(events)} events from {src}")
        if events:
            print("Sample event:", json.dumps(events[0], indent=2))