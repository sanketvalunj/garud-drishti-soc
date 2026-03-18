import json
import csv
from pathlib import Path

def _get_project_root() -> Path:
    """Returns the absolute path to the project root directory."""
    return Path(__file__).resolve().parent.parent.parent.parent

def load_events():
    """Loads normalized security events from data/normalized_events/events.json"""
    events_path = _get_project_root() / "data" / "normalized_events" / "events.json"
    if events_path.exists():
        try:
            with open(events_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading events: {e}")
    return []

def load_anomalies():
    """Loads UEBA anomaly results from data/incident_records/anomaly_results.csv"""
    anomalies_path = _get_project_root() / "data" / "incident_records" / "anomaly_results.csv"
    anomalies = []
    if anomalies_path.exists():
        try:
            with open(anomalies_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    anomalies.append(row)
        except Exception as e:
            print(f"Error loading anomalies: {e}")
    return anomalies

def load_incidents():
    """Loads correlation engine incidents from data/incident_records/incidents.json"""
    incidents_path = _get_project_root() / "data" / "incident_records" / "incidents.json"
    if incidents_path.exists():
        try:
            with open(incidents_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading incidents: {e}")
    return []

def build_soc_context():
    """Combines the three signals into a dictionary."""
    events = load_events()
    anomalies = load_anomalies()
    incidents = load_incidents()
    
    context = {
        "events": events,
        "anomalies": anomalies,
        "incidents": incidents,
        "meta": {
            "event_count": len(events),
            "anomaly_count": len(anomalies),
            "incident_count": len(incidents)
        }
    }
    
    print("[SOC CONTEXT LOADED]")
    print(f"Events: {context['meta']['event_count']}")
    print(f"Anomalies: {context['meta']['anomaly_count']}")
    print(f"Incidents: {context['meta']['incident_count']}")
    
    return context