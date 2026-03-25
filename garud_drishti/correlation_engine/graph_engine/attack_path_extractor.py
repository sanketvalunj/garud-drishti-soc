"""
attack_path_extractor.py

Extracts possible attack paths from the attack graph.
"""

import networkx as nx


class AttackPathExtractor:

    def __init__(self, graph):

        self.graph = graph

    def get_all_paths(self):
        """
        Extract all sequential paths in the graph.
        """

        paths = []

        # nodes with no incoming edges
        start_nodes = [
            node for node in self.graph.nodes
            if self.graph.in_degree(node) == 0
        ]

        # nodes with no outgoing edges
        end_nodes = [
            node for node in self.graph.nodes
            if self.graph.out_degree(node) == 0
        ]

        for start in start_nodes:
            for end in end_nodes:

                try:

                    for path in nx.all_simple_paths(
                        self.graph,
                        source=start,
                        target=end
                    ):

                        paths.append(path)

                except nx.NetworkXNoPath:
                    continue

        return paths

    def print_paths(self, paths):
        """
        Display attack paths in readable format.
        """

        print("\nAttack Paths:\n")

        for path in paths:

            actions = []

            for node in path:

                actions.append(
                    self.graph.nodes[node]["action"]
                )

            print(" → ".join(actions))