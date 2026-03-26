<<<<<<< HEAD
"""
attack_graph_builder.py

Builds a directed attack graph from event sequences.

Nodes = individual events
Edges = chronological event transitions

Uses NetworkX for graph creation.
"""
=======
"""Build a directed attack graph from correlation sequences."""

from __future__ import annotations

from typing import Any
>>>>>>> 6bd384c36c960584426c4e6347a32d9f9c031e3e

import networkx as nx


class AttackGraphBuilder:
<<<<<<< HEAD

    def __init__(self, sequences):
        """
        sequences: dictionary returned by EventSequenceBuilder

        Example:
        {
            "emp_103": [event1, event2, event3]
        }
        """

        self.sequences = sequences
        self.graph = nx.DiGraph()

    def build_graph(self):
        """
        Convert event sequences into a directed graph.
        """

        for user, events in self.sequences.items():

            for i in range(len(events)):

                event = events[i]

                # Unique node id
                node_id = f"{user}_{i}"

                # Add node with metadata
                self.graph.add_node(
                    node_id,
                    user=user,
                    action=event.get("action"),
                    timestamp=event.get("timestamp"),
                    ip=event.get("ip"),
                    server=event.get("server"),
                    risk_flag=event.get("risk_flag"),
                )

                # Create edge with previous event
                if i > 0:

                    prev_node = f"{user}_{i-1}"

                    self.graph.add_edge(
                        prev_node,
                        node_id,
                        relation="sequence"
                    )

        return self.graph

    def get_graph(self):
        """
        Return constructed graph.
        """

        return self.graph

    def print_graph_summary(self):
        """
        Print graph statistics.
        """

        print("\nAttack Graph Summary")

        print("Total nodes:", self.graph.number_of_nodes())
        print("Total edges:", self.graph.number_of_edges())
=======
    """Convert event sequences into a graph with sequence-aware metadata."""

    def __init__(self, sequences: list[dict[str, Any]]) -> None:
        self.sequences = sequences
        self.graph = nx.DiGraph()

    def build_graph(self) -> nx.DiGraph:
        """Convert correlation sequences into a directed graph."""

        sequence_paths: dict[str, list[str]] = {}
        sequence_meta: dict[str, dict[str, Any]] = {}

        for sequence in self.sequences:
            sequence_id = str(sequence["sequence_id"])
            node_ids: list[str] = []
            previous_node = None
            previous_timestamp = None

            for event in sequence.get("events", []):
                node_id = str(event.get("event_id") or event.get("event_hash") or f"{sequence_id}-{len(node_ids)}")
                node_ids.append(node_id)
                timestamp = event.get("timestamp")

                self.graph.add_node(
                    node_id,
                    sequence_id=sequence_id,
                    entity_key=sequence.get("entity_key"),
                    entity_type=sequence.get("entity_type"),
                    user_id=event.get("user_id"),
                    session_id=event.get("session_id"),
                    src_ip=event.get("src_ip"),
                    device_id=event.get("device_id"),
                    asset_id=event.get("asset_id"),
                    source_system=event.get("source_system"),
                    raw_event_type=event.get("raw_event_type"),
                    event_code=event.get("event_code"),
                    event_category=event.get("event_category"),
                    event_outcome=event.get("event_outcome"),
                    severity=event.get("severity"),
                    severity_score=event.get("severity_score"),
                    risk_flag=event.get("risk_flag"),
                    anomaly_score=event.get("anomaly_score", 0.0),
                    timestamp=timestamp,
                )

                if previous_node is not None:
                    delta_seconds = None
                    if previous_timestamp is not None and timestamp is not None:
                        delta_seconds = float((timestamp - previous_timestamp).total_seconds())
                    self.graph.add_edge(
                        previous_node,
                        node_id,
                        relation="temporal_sequence",
                        sequence_id=sequence_id,
                        delta_seconds=delta_seconds,
                    )

                previous_node = node_id
                previous_timestamp = timestamp

            sequence_paths[sequence_id] = node_ids
            sequence_meta[sequence_id] = {
                "entity_key": sequence.get("entity_key"),
                "entity_type": sequence.get("entity_type"),
                "window_start": sequence.get("window_start"),
                "window_end": sequence.get("window_end"),
                "event_count": sequence.get("event_count"),
                "duplicate_count": sequence.get("duplicate_count", 0),
                "source_systems": sequence.get("source_systems", []),
            }

        self.graph.graph["sequence_paths"] = sequence_paths
        self.graph.graph["sequence_meta"] = sequence_meta
        return self.graph

    def get_graph(self) -> nx.DiGraph:
        """Return the constructed graph."""

        return self.graph

    def print_graph_summary(self) -> None:
        """Print graph statistics."""

        print("\nAttack Graph Summary")
        print(f"Total nodes   : {self.graph.number_of_nodes()}")
        print(f"Total edges   : {self.graph.number_of_edges()}")
        print(f"Total sequences: {len(self.graph.graph.get('sequence_paths', {}))}")
>>>>>>> 6bd384c36c960584426c4e6347a32d9f9c031e3e
