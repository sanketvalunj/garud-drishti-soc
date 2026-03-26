"""
scripts/maintenance_task.py
============================
Cryptix — Autonomous SOC Maintenance Task

Runs every 24 hours and performs the following:
  1. Invokes LearningAgent to analyze decision_log.json for False Positives.
  2. For any threat_type whose FP rate exceeds FP_THRESHOLD (default 15%),
     automatically generates a corrected threat_rules config with lowered
     base_scores and anomaly_weights.
  3. Backs up the existing threat_rules config before overwriting.
  4. Writes the updated config to garud_drishti/data/ai_engine/threat_rules.json
     so ThreatReasoner can hot-load it on next run.

Run once:
    python scripts/maintenance_task.py

Run as daemon (loops every 24 h):
    python scripts/maintenance_task.py --daemon
"""

import argparse
import json
import logging
import shutil
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

_ROOT = Path(__file__).resolve().parent.parent
_DATA_DIR = _ROOT / "garud_drishti" / "data" / "ai_engine"
_DECISION_LOG = _DATA_DIR / "decision_log.json"
_RULES_FILE = _DATA_DIR / "threat_rules.json"
_BACKUP_DIR = _DATA_DIR / "threat_rules_backups"

# ── Config ───────────────────────────────────────────────────────────────────

FP_THRESHOLD = 0.15          # 15 % false-positive rate triggers adjustment
BASE_SCORE_REDUCTION = 1.0   # subtract this from base_score when noisy
WEIGHT_REDUCTION = 0.1       # subtract this from anomaly_weight when noisy
MIN_BASE_SCORE = 1.0         # floor — never go below this
MIN_WEIGHT = 0.05            # floor for anomaly_weight
INTERVAL_SECONDS = 86_400    # 24 hours

# ── Default rules (mirrors ThreatReasoner hardcoded values) ──────────────────

DEFAULT_THREAT_RULES = {
    "privilege":    {"type": "privilege_attack",  "base_score": 6.0, "anomaly_weight": 0.5},
    "exfiltration": {"type": "data_breach",        "base_score": 8.0, "anomaly_weight": 0.8},
    "recon":        {"type": "reconnaissance",     "base_score": 4.0, "anomaly_weight": 0.2},
    "default":      {"type": "unknown_threat",     "base_score": 5.0, "anomaly_weight": 0.3},
}

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(_ROOT / "maintenance.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("MaintenanceTask")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_decision_log() -> list:
    """Load and return all entries from decision_log.json."""
    if not _DECISION_LOG.exists():
        logger.warning("decision_log.json not found at %s — skipping cycle.", _DECISION_LOG)
        return []
    try:
        with open(_DECISION_LOG, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info("Loaded %d log entries from decision_log.json.", len(data))
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to read decision_log.json: %s", e)
        return []


def _load_current_rules() -> dict:
    """Load threat_rules.json if it exists, otherwise return defaults."""
    if _RULES_FILE.exists():
        try:
            with open(_RULES_FILE, "r", encoding="utf-8") as f:
                rules = json.load(f)
            logger.info("Loaded existing threat_rules.json.")
            return rules
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Could not read threat_rules.json (%s). Using defaults.", e)
    return json.loads(json.dumps(DEFAULT_THREAT_RULES))  # deep copy


def _backup_rules() -> None:
    """Copy current threat_rules.json to the backup directory with a timestamp."""
    if not _RULES_FILE.exists():
        return
    _BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    dest = _BACKUP_DIR / f"threat_rules_{timestamp}.json"
    shutil.copy2(_RULES_FILE, dest)
    logger.info("Backed up threat_rules.json → %s", dest.name)


def _save_rules(rules: dict) -> None:
    """Persist updated rules to threat_rules.json."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(_RULES_FILE, "w", encoding="utf-8") as f:
        json.dump(rules, f, indent=2)
    logger.info("Updated threat_rules.json written to %s", _RULES_FILE)


# ─────────────────────────────────────────────────────────────────────────────
# FP Analysis
# ─────────────────────────────────────────────────────────────────────────────

def _compute_fp_rates(logs: list) -> dict[str, float]:
    """
    Returns a dict of {threat_type: fp_rate} for every threat type
    that appears in the log.
    """
    total_by_type: Counter = Counter()
    fp_by_type: Counter = Counter()

    for entry in logs:
        decision = entry.get("decision", {})
        threat_type = decision.get("threat_type")
        feedback = decision.get("feedback", "pending")
        if not threat_type:
            continue
        total_by_type[threat_type] += 1
        if feedback == "False Positive":
            fp_by_type[threat_type] += 1

    rates = {}
    for threat_type, total in total_by_type.items():
        rates[threat_type] = fp_by_type[threat_type] / total

    return rates


# ─────────────────────────────────────────────────────────────────────────────
# Rule Adjustment
# ─────────────────────────────────────────────────────────────────────────────

def _adjust_rules(rules: dict, noisy_types: list[str]) -> tuple[dict, list[str]]:
    """
    For each noisy threat_type, find the matching rule key and lower
    base_score and anomaly_weight within safe bounds.

    Returns the updated rules dict and a list of human-readable change notes.
    """
    changes = []

    for threat_type in noisy_types:
        # Find the rule key whose 'type' value matches the threat_type string
        matched_key = None
        for key, rule in rules.items():
            if rule.get("type") == threat_type or key == threat_type:
                matched_key = key
                break

        if matched_key is None:
            logger.warning(
                "No rule key found for threat_type '%s' — skipping adjustment.",
                threat_type,
            )
            continue

        rule = rules[matched_key]
        old_base = rule["base_score"]
        old_weight = rule["anomaly_weight"]

        rule["base_score"] = max(
            round(old_base - BASE_SCORE_REDUCTION, 2), MIN_BASE_SCORE
        )
        rule["anomaly_weight"] = max(
            round(old_weight - WEIGHT_REDUCTION, 3), MIN_WEIGHT
        )

        note = (
            f"[{matched_key}] base_score {old_base} → {rule['base_score']}, "
            f"anomaly_weight {old_weight} → {rule['anomaly_weight']}"
        )
        changes.append(note)
        logger.info("Adjusted rule: %s", note)

    return rules, changes


# ─────────────────────────────────────────────────────────────────────────────
# Main cycle
# ─────────────────────────────────────────────────────────────────────────────

def run_maintenance_cycle() -> None:
    """Execute one full maintenance cycle."""
    logger.info("=" * 60)
    logger.info("Maintenance cycle started.")

    # 1. Load logs
    logs = _load_decision_log()
    if not logs:
        logger.info("No log data — maintenance cycle complete (nothing to do).")
        return

    # 2. Compute FP rates per threat type
    fp_rates = _compute_fp_rates(logs)
    logger.info("FP rates by threat type: %s", {k: f"{v:.1%}" for k, v in fp_rates.items()})

    # 3. Identify noisy threat types above threshold
    noisy = [t for t, rate in fp_rates.items() if rate > FP_THRESHOLD]

    if not noisy:
        logger.info(
            "All threat types are within the %.0f%% FP threshold. No adjustments needed.",
            FP_THRESHOLD * 100,
        )
        logger.info("Maintenance cycle complete.")
        return

    logger.warning(
        "%d threat type(s) exceed FP threshold (%.0f%%): %s",
        len(noisy), FP_THRESHOLD * 100, noisy,
    )

    # 4. Load current rules, back up, adjust, save
    rules = _load_current_rules()
    _backup_rules()
    updated_rules, changes = _adjust_rules(rules, noisy)

    if changes:
        _save_rules(updated_rules)
        logger.info("Rule adjustments applied:")
        for c in changes:
            logger.info("  • %s", c)
    else:
        logger.warning("No rule keys matched noisy threat types — rules unchanged.")

    logger.info("Maintenance cycle complete.")
    logger.info("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Cryptix SOC Maintenance Task")
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuously, repeating every 24 hours.",
    )
    args = parser.parse_args()

    if args.daemon:
        logger.info("Daemon mode — running every %d seconds (%d hours).", INTERVAL_SECONDS, INTERVAL_SECONDS // 3600)
        while True:
            run_maintenance_cycle()
            logger.info("Sleeping for %d hours...", INTERVAL_SECONDS // 3600)
            time.sleep(INTERVAL_SECONDS)
    else:
        run_maintenance_cycle()


if __name__ == "__main__":
    main()
