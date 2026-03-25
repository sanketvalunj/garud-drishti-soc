"""
correlation_pipeline.py

Main execution pipeline for the Correlation Engine.

Pipeline Steps
--------------
1. Load anomaly results from UEBA engine
2. Identify suspicious users
3. Load normalized logs
4. Build event sequences
5. Build attack graph
6. Extract attack paths
7. Detect attack patterns
8. Map MITRE ATT&CK techniques
9. Compute risk score
10. Generate incident JSON
"""

from loaders.anomaly_loader import AnomalyLoader
from loaders.normalized_log_loader import NormalizedLogLoader

from preprocessing.event_sequence_builder import EventSequenceBuilder

from graph_engine.attack_graph_builder import AttackGraphBuilder
from graph_engine.attack_path_extractor import AttackPathExtractor

from detection.pattern_detector import PatternDetector
from detection.mitre_mapper import MitreMapper

from scoring.risk_scoring_engine import RiskScoringEngine
from outputs.incident_builder import IncidentBuilder


def run_pipeline():

    print("\n==============================")
    print("Correlation Engine Started")
    print("==============================\n")

    # --------------------------------------------------
    # STEP 1 : Load anomaly results
    # --------------------------------------------------

    anomaly_loader = AnomalyLoader()

    suspicious_users = anomaly_loader.get_anomalous_users()

    print("Suspicious users detected by UEBA:")
    print(suspicious_users)

    if len(suspicious_users) == 0:
        print("\nNo suspicious users detected. Exiting pipeline.")
        return

    # Get anomaly score of the most suspicious user
    user = suspicious_users[0]

    anomaly_score = anomaly_loader.get_anomaly_score(user)

    print(f"\nAnomaly Score: {anomaly_score}")

    # --------------------------------------------------
    # STEP 2 : Load normalized logs
    # --------------------------------------------------

    log_loader = NormalizedLogLoader()

    logs = log_loader.get_logs_for_users(suspicious_users)

    logs = log_loader.get_logs_sorted(logs)

    print("\nLogs for suspicious users:")
    print(logs.head())

    # --------------------------------------------------
    # STEP 3 : Build event sequences
    # --------------------------------------------------

    sequence_builder = EventSequenceBuilder(logs)

    event_sequences = sequence_builder.build_sequences()

    print("\nEvent Sequences:\n")

    sequence_builder.print_sequences(event_sequences)

    print("\nEvent Sequence Stage Completed\n")

    # --------------------------------------------------
    # STEP 4 : Build Attack Graph
    # --------------------------------------------------

    graph_builder = AttackGraphBuilder(event_sequences)

    graph = graph_builder.build_graph()

    graph_builder.print_graph_summary()

    print("\nAttack Graph Built Successfully\n")

    # --------------------------------------------------
    # STEP 5 : Extract Attack Paths
    # --------------------------------------------------

    path_extractor = AttackPathExtractor(graph)

    paths = path_extractor.get_all_paths()

    path_extractor.print_paths(paths)

    print("\nAttack Path Extraction Completed\n")

    # --------------------------------------------------
    # STEP 6 : Detect Attack Patterns
    # --------------------------------------------------

    pattern_detector = PatternDetector(paths, graph)

    patterns = pattern_detector.detect_patterns()

    pattern_detector.print_patterns(patterns)

    print("\nPattern Detection Completed\n")

    # --------------------------------------------------
    # STEP 7 : MITRE ATT&CK Mapping
    # --------------------------------------------------

    mitre_mapper = MitreMapper()

    techniques = mitre_mapper.map_graph(graph)

    mitre_mapper.print_mitre(techniques)

    print("\nMITRE Mapping Completed\n")

    # --------------------------------------------------
    # STEP 8 : Risk Scoring
    # --------------------------------------------------

    risk_engine = RiskScoringEngine()

    risk_score = risk_engine.calculate_risk_score(
        anomaly_score,
        patterns,
        techniques,
        paths
    )

    risk_level = risk_engine.classify_risk(risk_score)

    print("\n==============================")
    print("RISK ASSESSMENT")
    print("==============================")

    print(f"Risk Score : {risk_score}")
    print(f"Risk Level : {risk_level}")

    # --------------------------------------------------
    # STEP 9 : Build Final Incident
    # --------------------------------------------------

    incident_builder = IncidentBuilder(
        user=user,
        anomaly_score=anomaly_score,
        patterns=patterns,
        mitre_techniques=techniques,
        attack_paths=paths,
        event_sequences=event_sequences,
        risk_score=risk_score,
        risk_level=risk_level
    )

    incident = incident_builder.build_incident()

    incident_builder.save_incident(incident)

    print("\n==============================")
    print("Incident JSON Generated")
    print("==============================")

    print("\nCorrelation Engine Finished\n")


if __name__ == "__main__":
    run_pipeline()