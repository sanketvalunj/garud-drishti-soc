class GraphConstructor:
    """
    Builds simple relationship graph between events/assets.
    """

    def build(self, events: list):
        nodes = []
        edges = []

        for e in events:
            asset = e.get("asset", "unknown")
            nodes.append(asset)

        nodes = list(set(nodes))

        # connect events sequentially
        for i in range(len(events) - 1):
            edges.append({
                "from": events[i].get("asset", "unknown"),
                "to": events[i+1].get("asset", "unknown")
            })

        return {
            "nodes": nodes,
            "edges": edges
        }