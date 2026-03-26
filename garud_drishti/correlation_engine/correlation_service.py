"""Service wrapper for running the offline correlation pipeline and returning incidents."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class CorrelationService:
    """Thin service layer around the correlation pipeline."""

    def build_incidents(
        self,
        detected: Any = None,
        normalized_input: str | Path = r"garud_drishti\data\normalized_events\normalized_events.json",
        anomaly_input: str | Path = r"garud_drishti\data\processed\anomaly_events.json",
        mitre_workbook_path: str | Path | None = None,
    ) -> list[dict[str, Any]]:
        del detected  # Correlation consumes offline file inputs, not a suspicious-only event subset.

        from .correlation_pipeline import run_pipeline

        run_pipeline(
            normalized_input=normalized_input,
            anomaly_input=anomaly_input,
            mitre_workbook_path=mitre_workbook_path,
        )

        incidents_path = Path(r"garud_drishti\data\incidents\correlated_incidents.json")
        if not incidents_path.exists():
            return []

        with open(incidents_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        return payload if isinstance(payload, list) else []
