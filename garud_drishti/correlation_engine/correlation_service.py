class CorrelationService:
    def build_incidents(self, detected=None):
        try:
            from .correlation_pipeline import run_pipeline
            run_pipeline()
        except Exception as e:
            print("Pipeline error:", e)
        import json
        try:
            with open("data/incident_records/incidents.json", "r") as f:
                return json.load(f)
        except:
            return []
