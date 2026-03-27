"""
Garud-Drishti SOC — Log Normalization Pipeline
================================================
Orchestrates the full normalization pipeline:
  1. Read raw logs from multiple formats
  2. Parse each log using LogParser
  3. Map to unified schema using SchemaMapper
  4. Output normalized events
"""

import json
import os
from pathlib import Path
from typing import List, Dict

from backend.ingestion.log_parser import LogParser
from backend.ingestion.schema_mapper import SchemaMapper


class LogNormalizer:
    """
    Full normalization pipeline for SOC telemetry.
    Reads raw logs, parses, and maps to unified schema.
    """

    def __init__(self):
        self.parser = LogParser()
        self.mapper = SchemaMapper()

    def normalize_events(self, raw_logs: List) -> List[Dict]:
        """
        Full pipeline: parse → map → return normalized events.

        Args:
            raw_logs: List of raw log entries (str or dict)

        Returns:
            List of normalized event dictionaries
        """
        parsed = self.parser.parse_batch(raw_logs)
        normalized = self.mapper.map_batch(parsed)
        return normalized

    def normalize_from_files(self, data_dir: str = None) -> List[Dict]:
        """
        Read raw logs from data directory and normalize them.

        Args:
            data_dir: Path to data directory (default: project data/)

        Returns:
            List of normalized event dictionaries
        """
        if data_dir is None:
            data_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "data"
            )

        raw_dir = os.path.join(data_dir, "raw_logs")
        all_raw = []

        # Read JSON logs
        json_path = os.path.join(raw_dir, "logs_json.json")
        if os.path.exists(json_path):
            with open(json_path, "r") as f:
                all_raw.extend(json.load(f))

        # Read KV logs
        kv_path = os.path.join(raw_dir, "logs_kv.txt")
        if os.path.exists(kv_path):
            with open(kv_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        all_raw.append(line)

        # Read CSV logs
        csv_path = os.path.join(raw_dir, "logs_csv.csv")
        if os.path.exists(csv_path):
            with open(csv_path, "r") as f:
                lines = f.readlines()
                for line in lines[1:]:  # Skip header
                    line = line.strip()
                    if line:
                        all_raw.append(line)

        # Read raw text logs
        txt_path = os.path.join(raw_dir, "logs_raw.txt")
        if os.path.exists(txt_path):
            with open(txt_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        all_raw.append(line)

        # Read combined file if individual files don't exist
        if not all_raw:
            combined_path = os.path.join(raw_dir, "all_raw_logs.txt")
            if os.path.exists(combined_path):
                with open(combined_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            all_raw.append(line)

        # Also try legacy demo_logs.json
        if not all_raw:
            legacy_path = os.path.join(raw_dir, "demo_logs.json")
            if os.path.exists(legacy_path):
                with open(legacy_path, "r") as f:
                    all_raw.extend(json.load(f))

        return self.normalize_events(all_raw)

    def save_normalized(self, events: List[Dict], data_dir: str = None) -> str:
        """Save normalized events to JSON file."""
        if data_dir is None:
            data_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "data"
            )

        norm_dir = os.path.join(data_dir, "normalized_events")
        os.makedirs(norm_dir, exist_ok=True)

        output_path = os.path.join(norm_dir, "events.json")
        with open(output_path, "w") as f:
            json.dump(events, f, indent=2, default=str)

        return output_path


# ═══════════════════════════════════════════════
# STANDALONE SCRIPT
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    normalizer = LogNormalizer()
    events = normalizer.normalize_from_files()
    print(f"✅ Normalized {len(events)} events")

    if events:
        output = normalizer.save_normalized(events)
        print(f"💾 Saved to: {output}")
        print(f"\nSample event:")
        print(json.dumps(events[0], indent=2, default=str))
