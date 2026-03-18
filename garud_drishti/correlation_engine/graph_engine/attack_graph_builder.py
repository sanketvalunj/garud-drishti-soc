"""
attack_graph_builder.py

Builds a directed attack graph from event sequences.

Nodes = individual events
Edges = chronological event transitions

Uses NetworkX for graph creation.
"""

import networkx as nx


class AttackGraphBuilder:

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