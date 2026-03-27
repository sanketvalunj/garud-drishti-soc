
"""Offline, air-gapped correlation pipeline for GARUD-DRISHTI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _bootstrap_site_packages() -> None:
    for candidate in (
        REPO_ROOT / ".venv/Lib/site-packages",
        REPO_ROOT / "venv/Lib/site-packages",
    ):
        if candidate.exists() and str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))


_bootstrap_site_packages()

import pandas as pd
from garud_drishti.correlation_engine.detection.mitre_mapper import MitreMapper
from garud_drishti.correlation_engine.detection.pattern_detector import PatternDetector
from garud_drishti.correlation_engine.graph_engine.attack_graph_builder import AttackGraphBuilder
from garud_drishti.correlation_engine.graph_engine.attack_path_extractor import AttackPathExtractor
from garud_drishti.correlation_engine.loaders.anomaly_loader import AnomalyLoader
from garud_drishti.correlation_engine.loaders.normalized_log_loader import NormalizedLogLoader
from garud_drishti.correlation_engine.outputs.incident_builder import IncidentBuilder
from garud_drishti.correlation_engine.preprocessing.event_normalizer import (
    load_raw_logs,
    normalize_events,
    write_normalized_events,
)
from garud_drishti.correlation_engine.preprocessing.event_sequence_builder import EventSequenceBuilder
from garud_drishti.correlation_engine.scoring.risk_scoring_engine import RiskScoringEngine


DEFAULT_RAW_INPUT = REPO_ROOT / "garud_drishti/data/normalized_events/normalized_events.json"
DEFAULT_NORMALIZED_OUTPUT = REPO_ROOT / "garud_drishti/data/normalized_events/vishvesh_normalized_events.json"
DEFAULT_ANOMALY_INPUT = REPO_ROOT / "garud_drishti/data/processed/anomaly_events.json"
DEFAULT_ENRICHED_OUTPUT = REPO_ROOT / "garud_drishti/data/correlation/enriched_events.json"
DEFAULT_INCIDENT_INDEX = REPO_ROOT / "garud_drishti/data/incidents/correlated_incidents.json"
DEFAULT_BY_INCIDENT_DIR = REPO_ROOT / "garud_drishti/data/incidents/by_incident"
DEFAULT_CORRELATION_CONFIG = REPO_ROOT / "garud_drishti/correlation_engine/config/correlation_config.json"


def _ensure_output_dir(path_value: str | Path) -> Path:
    path = Path(path_value)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _write_json(path_value: str | Path, payload: Any) -> Path:
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, default=str)
    return path


def _load_json(path_value: str | Path) -> dict[str, Any]:
    path = Path(path_value)
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def run_pipeline(
    normalized_input: str | Path = DEFAULT_RAW_INPUT,
    normalized_output: str | Path = DEFAULT_NORMALIZED_OUTPUT,
    anomaly_input: str | Path = DEFAULT_ANOMALY_INPUT,
    mitre_workbook_path: str | Path | None = None,
) -> dict[str, Any]:
    """Run the full offline correlation pipeline end to end."""

    correlation_config = _load_json(DEFAULT_CORRELATION_CONFIG)
    min_incident_risk_score = int(correlation_config.get("min_incident_risk_score", 45))
    max_timeline_events = int(correlation_config.get("max_timeline_events", 50))

    print("\n==============================================")
    print("GARUD-DRISHTI Offline Correlation Engine Start")
    print("==============================================\n")

    print("[1/13] Loading offline MITRE knowledge base...")
    mitre_mapper = MitreMapper(workbook_path=mitre_workbook_path)
    mitre_manifest = mitre_mapper.knowledge_base_status
    knowledge_base_mode = str(mitre_manifest.get("knowledge_base_mode", "unknown")).strip().lower()
    if knowledge_base_mode == "local_cache":
        print("Phase completed: cached MITRE JSON assets loaded from garud_drishti/data/mitre")
    elif knowledge_base_mode == "exported_from_workbook":
        workbook_display = str(mitre_workbook_path) if mitre_workbook_path else "provided workbook"
        print(f"Phase completed: MITRE JSON assets rebuilt from workbook {workbook_display}")
    else:
        print("Phase completed: MITRE knowledge base loaded")
    print(f"MITRE sheets exported: {len(mitre_manifest.get('sheet_exports', {}))}\n")

    print("[2/13] Normalizing Avantika input into canonical Vishvesh events...")
    raw_logs = load_raw_logs(normalized_input)
    normalized_events = normalize_events(raw_logs)
    normalized_output_path = write_normalized_events(normalized_events, normalized_output)
    print(f"Phase completed: canonical normalization written to {normalized_output_path}")
    print(f"Input records : {len(raw_logs)}")
    print(f"Output records: {len(normalized_events)}\n")

    print("[3/13] Loading canonical normalized events...")
    log_loader = NormalizedLogLoader(normalized_output_path)
    normalized_logs = log_loader.get_logs_sorted()
    log_loader.summary()
    print(f"Phase completed: canonical logs loaded from {normalized_output_path}\n")

    print("[4/13] Loading anomaly enrichment feed...")
    anomaly_loader = AnomalyLoader(
        file_path=anomaly_input,
        tolerance_seconds=int(correlation_config.get("anomaly_match_tolerance_seconds", 120)),
    )
    anomaly_loader.summary()
    print(f"Phase completed: anomaly feed loaded from {Path(anomaly_input)}\n")

    print("[5/13] Enriching normalized events with anomaly context...")
    enriched_logs = anomaly_loader.enrich_logs(normalized_logs)
    enriched_output = _write_json(DEFAULT_ENRICHED_OUTPUT, enriched_logs.to_dict("records"))
    match_counts = (
        enriched_logs["anomaly_match_strategy"].value_counts(dropna=False).to_dict()
        if "anomaly_match_strategy" in enriched_logs.columns
        else {}
    )
    print(f"Phase completed: enriched events written to {enriched_output}")
    print(f"Enriched records: {len(enriched_logs)}")
    print(f"Match strategies : {match_counts}\n")

    print("[6/13] Building correlation sequences across all relevant events...")
    sequence_builder = EventSequenceBuilder(enriched_logs)
    sequences = sequence_builder.build_sequences()
    print("Phase completed: event sequences built")
    print(f"Sequence count : {len(sequences)}")
    print(f"Sequenced events: {sum(sequence['event_count'] for sequence in sequences)}\n")

    print("[7/13] Building attack graph...")
    graph_builder = AttackGraphBuilder(sequences)
    graph = graph_builder.build_graph()
    graph_builder.print_graph_summary()
    print("Phase completed: attack graph built\n")

    print("[8/13] Extracting attack paths...")
    path_extractor = AttackPathExtractor(graph)
    attack_paths = path_extractor.get_all_paths()
    print("Phase completed: attack paths extracted")
    print(f"Attack path count: {len(attack_paths)}\n")

    print("[9/13] Detecting multi-stage patterns...")
    pattern_detector = PatternDetector(paths=attack_paths, graph=graph)
    pattern_matches = pattern_detector.detect_patterns()
    pattern_summary = pattern_detector.summarize_patterns(pattern_matches)
    pattern_detector.print_patterns(pattern_matches)
    print("Phase completed: pattern detection finished")
    print(f"Pattern count : {len(pattern_matches)}")
    print(f"Pattern summary: {pattern_summary}\n")

    print("[10/13] Applying event-level MITRE candidate mapping...")
    event_mitre_by_sequence: dict[str, list[dict[str, Any]]] = {}
    for sequence in sequences:
        event_codes = [str(event.get("event_code", "unknown.event")) for event in sequence.get("events", [])]
        event_mitre_by_sequence[str(sequence["sequence_id"])] = mitre_mapper.map_event_codes(event_codes)
    total_event_mitre = sum(len(items) for items in event_mitre_by_sequence.values())
    print("Phase completed: event-level MITRE mapping finished")
    print(f"Event-level mappings: {total_event_mitre}\n")

    print("[11/13] Applying pattern-level MITRE confirmed mapping...")
    patterns_by_sequence: dict[str, list[dict[str, Any]]] = {}
    for pattern in pattern_matches:
        patterns_by_sequence.setdefault(str(pattern["sequence_id"]), []).append(pattern)

    pattern_mitre_by_sequence: dict[str, list[dict[str, Any]]] = {}
    for sequence_id, matches in patterns_by_sequence.items():
        pattern_names = [pattern["pattern_name"] for pattern in matches]
        pattern_mitre_by_sequence[sequence_id] = mitre_mapper.map_pattern_matches(pattern_names)
    total_pattern_mitre = sum(len(items) for items in pattern_mitre_by_sequence.values())
    print("Phase completed: pattern-level MITRE mapping finished")
    print(f"Pattern-level mappings: {total_pattern_mitre}\n")

    print("[12/13] Computing incident-local risk scores...")
    risk_engine = RiskScoringEngine()
    path_by_sequence = {str(path["sequence_id"]): path for path in attack_paths}
    incident_candidates: list[dict[str, Any]] = []

    for sequence in sequences:
        sequence_id = str(sequence["sequence_id"])
        path = path_by_sequence.get(sequence_id)
        if path is None:
            continue

        pattern_list = patterns_by_sequence.get(sequence_id, [])
        event_level_mitre = event_mitre_by_sequence.get(sequence_id, [])
        pattern_level_mitre = pattern_mitre_by_sequence.get(sequence_id, [])
        combined_mitre = MitreMapper.combine_mappings(event_level_mitre, pattern_level_mitre)
        risk = risk_engine.calculate_incident_risk(
            sequence=sequence,
            path=path,
            pattern_matches=pattern_list,
            event_mitre=event_level_mitre,
            pattern_mitre=pattern_level_mitre,
        )

        if risk["risk_score"] >= min_incident_risk_score or pattern_list:
            incident_candidates.append(
                {
                    "sequence": sequence,
                    "path": path,
                    "patterns": pattern_list,
                    "event_level_mitre": event_level_mitre,
                    "pattern_level_mitre": pattern_level_mitre,
                    "combined_mitre": combined_mitre,
                    "risk": risk,
                }
            )

    print("Phase completed: risk scoring finished")
    print(f"Incident candidates above threshold: {len(incident_candidates)}\n")

    print("[13/13] Generating final incident JSON output...")
    incident_builder = IncidentBuilder(
        by_incident_dir=DEFAULT_BY_INCIDENT_DIR,
        index_path=DEFAULT_INCIDENT_INDEX,
    )
    incidents = [
        incident_builder.build_incident(
            sequence=candidate["sequence"],
            path=candidate["path"],
            patterns=candidate["patterns"],
            event_level_mitre=candidate["event_level_mitre"],
            pattern_level_mitre=candidate["pattern_level_mitre"],
            combined_mitre=candidate["combined_mitre"],
            risk=candidate["risk"],
            max_timeline_events=max_timeline_events,
        )
        for candidate in incident_candidates
    ]
    incident_index_path, saved_incident_files = incident_builder.save_incidents(incidents)
    print("Phase completed: incident output generated")
    print(f"Incident count : {len(incidents)}")
    print(f"Incident index : {incident_index_path}")
    print(f"By-incident dir: {DEFAULT_BY_INCIDENT_DIR}\n")

    print("==============================================")
    print("GARUD-DRISHTI Offline Correlation Engine Ended")
    print("==============================================")
    print(f"Normalized events : {len(normalized_events)}")
    print(f"Enriched events   : {len(enriched_logs)}")
    print(f"Sequences         : {len(sequences)}")
    print(f"Paths             : {len(attack_paths)}")
    print(f"Pattern matches   : {len(pattern_matches)}")
    print(f"Incidents         : {len(incidents)}")
    print(f"Outputs written   : {normalized_output_path}, {enriched_output}, {incident_index_path}\n")

    return {
        "normalized_events": len(normalized_events),
        "enriched_events": len(enriched_logs),
        "sequence_count": len(sequences),
        "path_count": len(attack_paths),
        "pattern_match_count": len(pattern_matches),
        "pattern_summary": pattern_summary,
        "incident_count": len(incidents),
        "normalized_output": str(normalized_output_path),
        "enriched_output": str(enriched_output),
        "incident_index": str(incident_index_path),
        "incident_files": [str(path) for path in saved_incident_files],
        "mitre_knowledge_base_mode": knowledge_base_mode,
        "mitre_manifest": str(REPO_ROOT / "garud_drishti/data/mitre/mitre_workbook_manifest.json"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the GARUD-DRISHTI offline correlation pipeline.")
    parser.add_argument("--normalized-input", default=str(DEFAULT_RAW_INPUT), help="Input Avantika JSON path.")
    parser.add_argument(
        "--normalized-output",
        default=str(DEFAULT_NORMALIZED_OUTPUT),
        help="Canonical Vishvesh normalized output path.",
    )
    parser.add_argument("--anomaly-input", default=str(DEFAULT_ANOMALY_INPUT), help="Shreya anomaly JSON path.")
    parser.add_argument(
        "--mitre-workbook",
        default=None,
        help="Optional offline MITRE workbook path used only to rebuild local MITRE JSON assets if needed.",
    )
    args = parser.parse_args()

    run_pipeline(
        normalized_input=args.normalized_input,
        normalized_output=args.normalized_output,
        anomaly_input=args.anomaly_input,
        mitre_workbook_path=args.mitre_workbook,
    )


if __name__ == "__main__":
    main()

