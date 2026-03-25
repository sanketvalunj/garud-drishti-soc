"""
backend/utils/file_loader.py
=============================
Utility for loading JSON data files from disk.
Provides a single, consistent interface used by all services that read
from the processed data directory.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("garud_drishti.file_loader")

# Project root is two levels up from this file (backend/utils/ → backend/ → project root)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def load_json_file(relative_path: str) -> Any:
    """
    Load and parse a JSON file relative to the project root.

    Args:
        relative_path: Path relative to the project root,
                       e.g. "garud_drishti/data/processed/anomaly_events.json"

    Returns:
        Parsed JSON content (list or dict).

    Raises:
        FileNotFoundError: If the file does not exist at the resolved path.
        ValueError:        If the file content is not valid JSON.
    """
    full_path = _PROJECT_ROOT / relative_path

    if not full_path.exists():
        raise FileNotFoundError(
            f"Data file not found: {full_path}. "
            f"Resolved from relative path: '{relative_path}'"
        )

    try:
        with open(full_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in '{full_path}': {exc}") from exc
