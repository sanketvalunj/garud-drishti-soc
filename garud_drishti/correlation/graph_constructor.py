def build_graph(group_df):
    """
    Builds a simple entity graph from events.
    """

    graph = {
        "users": set(),
        "devices": set(),
        "ips": set(),
        "event_types": set()
    }

    for _, row in group_df.iterrows():

        if "user" in row and row["user"]:
            graph["users"].add(row["user"])

        if "device" in row and row["device"]:
            graph["devices"].add(row["device"])

        if "ip" in row and row["ip"]:
            graph["ips"].add(row["ip"])

        if "event_type" in row:
            graph["event_types"].add(row["event_type"])

    # convert sets → list (important for JSON later)
    for k in graph:
        graph[k] = list(graph[k])

    return graph