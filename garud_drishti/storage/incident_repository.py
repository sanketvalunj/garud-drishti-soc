from garud_drishti.backend.utils.json_helpers import load_json, save_json
from .elastic_client import ElasticClient


class IncidentRepository:

    INCIDENT_PATH = "data/incident_records/incidents.json"
    PLAYBOOK_PATH = "data/incident_records/playbooks.json"
    AUTOMATION_PATH = "data/incident_records/automation.json"

    INCIDENT_INDEX = "garud_incidents"

    def __init__(self):
        self.es = ElasticClient()

    # -------------------------
    # SAVE INCIDENTS
    # -------------------------
    def save_incidents(self, incidents):
        save_json(self.INCIDENT_PATH, incidents)

        if self.es.is_enabled():
            for inc in incidents:
                self.es.index(self.INCIDENT_INDEX, inc)

    def load_incidents(self):
        if self.es.is_enabled():
            return self.es.search(self.INCIDENT_INDEX)
        return load_json(self.INCIDENT_PATH) or []

    # -------------------------
    # SAVE PLAYBOOKS
    # -------------------------
    def save_playbooks(self, playbooks):
        save_json(self.PLAYBOOK_PATH, playbooks)

    def load_playbooks(self):
        return load_json(self.PLAYBOOK_PATH) or []

    # -------------------------
    # SAVE AUTOMATION
    # -------------------------
    def save_automation(self, reports):
        save_json(self.AUTOMATION_PATH, reports)

    def load_automation(self):
        return load_json(self.AUTOMATION_PATH) or []