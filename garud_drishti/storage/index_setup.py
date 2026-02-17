from .elastic_client import ElasticClient


def setup_indices():
    """
    Creates indices if Elasticsearch is enabled.
    """
    es = ElasticClient()
    if not es.is_enabled():
        return {"status": "ES disabled"}

    client = es.client

    if not client.indices.exists(index="garud_logs"):
        client.indices.create(index="garud_logs")

    if not client.indices.exists(index="garud_incidents"):
        client.indices.create(index="garud_incidents")

    return {"status": "indices ready"}