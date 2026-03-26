"""Extract ordered attack paths from the sequence-aware attack graph."""

from __future__ import annotations

from typing import Any

import networkx as nx


class AttackPathExtractor:
    """Walk sequence paths across the correlation graph."""

    def __init__(self, graph: nx.DiGraph) -> None:
        self.graph = graph

    def get_all_paths(self) -> list[dict[str, Any]]:
        """Return one ordered path object per correlation sequence."""

        paths: list[dict[str, Any]] = []
        sequence_paths: dict[str, list[str]] = self.graph.graph.get("sequence_paths", {})
        sequence_meta: dict[str, dict[str, Any]] = self.graph.graph.get("sequence_meta", {})

        for sequence_id, node_ids in sequence_paths.items():
            if not node_ids:
                continue

            path_events = [self.graph.nodes[node_id] for node_id in node_ids if node_id in self.graph.nodes]
            if not path_events:
                continue

            start_time = path_events[0].get("timestamp")
            end_time = path_events[-1].get("timestamp")
            duration_seconds = 0.0
            if start_time is not None and end_time is not None:
                duration_seconds = float((end_time - start_time).total_seconds())

            meta = sequence_meta.get(sequence_id, {})
            paths.append(
                {
                    "path_id": f"PATH-{sequence_id}",
                    "sequence_id": sequence_id,
                    "entity_key": meta.get("entity_key"),
                    "entity_type": meta.get("entity_type"),
                    "node_ids": node_ids,
                    "event_ids": node_ids,
                    "event_codes": [str(event.get("event_code", "unknown.event")) for event in path_events],
                    "source_systems": sorted({str(event.get("source_system", "unknown")) for event in path_events}),
                    "length": len(node_ids),
                    "duplicate_count": int(meta.get("duplicate_count", 0)),
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration_seconds": duration_seconds,
                }
            )

        return paths

    def print_paths(self, paths: list[dict[str, Any]]) -> None:
        """Print attack paths in a readable canonical event-code chain format."""

        print("\nAttack Paths:\n")
        if not paths:
            print("No attack paths extracted.")
            return

        for path in paths[:15]:
            print(" -> ".join(path["event_codes"]))
