import json
from pathlib import Path

def load_json(path):
    p = Path(path)
    if not p.exists():
        return None
    with open(p, "r") as f:
        return json.load(f)

def save_json(path, data):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(data, f, indent=2)