import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from garud_drishti.correlation.correlation_service import correlate_events

incidents = correlate_events()

print(f"\nBuilt {len(incidents)} incidents\n")

for inc in incidents:
    print("ID:", inc["incident_id"])
    print("Severity:", inc["severity"])
    print("Fidelity:", inc["fidelity_score"])
    print("Summary:", inc["summary"])
    print("-"*40)