from .log_parser import LogParser
from .schema_mapper import SchemaMapper


class IngestionService:
    """
    Full ingestion pipeline:
    raw logs → parsed logs → normalized events
    """

    def __init__(self):
        self.parser = LogParser()
        self.mapper = SchemaMapper()

    def ingest(self, raw_logs: list):
        """
        Convert raw logs into normalized SOC events.
        """

        normalized = []

        for raw in raw_logs:
            parsed = self.parser.parse(raw)
            if not parsed:
                continue

            mapped = self.mapper.map(parsed)
            normalized.append(mapped)

        return normalized