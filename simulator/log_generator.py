"""
Garud-Drishti — AI SOC Platform
Log Generator

Generates 10,000+ realistic security logs across four SOC telemetry
sources: IAM, EDR, FIREWALL, APP.

Behaviour distribution (configurable via env vars):
  ATTACK_CHAIN_PCT  (default 5%)  — full attack chain injected
  SUSPICIOUS_PCT    (default 20%) — single suspicious event
  remainder         (75%)         — normal behaviour

Format distribution:
  40% JSON | 25% KV | 20% CSV | 15% raw text
  (CSV output includes all enrichment fields — EC-04 fix)

Edge cases fixed:
  EC-04: CSV serialiser now includes all enrichment fields
  EC-11: generate_to_file uses write mode with timestamp suffix to avoid append accumulation
  EC-12: KV serialiser recursively flattens nested dicts
"""

import json
import os
import random
import uuid
import csv
import io
from datetime import datetime
from typing import Iterator, Dict, Any, List, Tuple
from pathlib import Path

from simulator.enterprise_simulator import get_enterprise_env, EnterpriseEnvironment
from simulator.attack_scenarios import get_attack_generator
from backend.threat_intel.mitre_mapping import enrich_event_mitre
from backend.enrichment.security_context import enrich_event as _enrich_context

# ---------------------------------------------------------------------------
# Configurable behaviour probabilities
# ---------------------------------------------------------------------------
ATTACK_CHAIN_PCT = float(os.getenv("ATTACK_CHAIN_PCT", "0.05"))
SUSPICIOUS_THRESHOLD = 1.0 - float(os.getenv("SUSPICIOUS_PCT", "0.20"))

# ---------------------------------------------------------------------------
# Severity helpers
# ---------------------------------------------------------------------------

SEVERITY_MAP = {
    "login_success": "low", "login_failed": "medium", "password_change": "low",
    "account_locked": "high", "mfa_attempt": "low", "process_start": "low",
    "file_access": "low", "privilege_escalation": "critical",
    "script_execution": "high", "malware_detected": "critical",
    "connection_attempt": "low", "blocked_ip": "medium", "port_scan": "high",
    "external_transfer": "high", "database_query": "low", "data_access": "medium",
    "file_download": "medium", "data_export": "critical", "mfa_failed": "high",
    "vpn_connect": "low", "vpn_disconnect": "low", "logout": "low",
}

def _severity(event_type: str) -> str:
    return SEVERITY_MAP.get(event_type, "low")

def _uid() -> str:
    return str(uuid.uuid4())

# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

WORK_HOUR_START = int(os.getenv("WORK_HOUR_START", "8"))
WORK_HOUR_END   = int(os.getenv("WORK_HOUR_END",   "17"))

def _work_hour_ts() -> datetime:
    return datetime.now().replace(
        hour=random.randint(WORK_HOUR_START, WORK_HOUR_END),
        minute=random.randint(0, 59), second=random.randint(0, 59), microsecond=0,
    )

def _off_hour_ts() -> datetime:
    hour = random.choice(list(range(22, 24)) + list(range(0, 6)))
    return datetime.now().replace(
        hour=hour, minute=random.randint(0, 59),
        second=random.randint(0, 59), microsecond=0,
    )

# ---------------------------------------------------------------------------
# Per-source generators
# ---------------------------------------------------------------------------

class IAMLogGenerator:
    NORMAL    = ["login_success", "logout", "mfa_attempt", "password_change"]
    SUSPICIOUS = ["login_failed", "login_failed", "login_failed", "mfa_failed"]

    def generate(self, env: EnterpriseEnvironment, suspicious: bool = False) -> Dict:
        emp = env.random_employee()
        if suspicious:
            event_type = random.choice(self.SUSPICIOUS)
            ip, ts = env.random_external_ip(), _off_hour_ts()
        else:
            event_type = random.choice(self.NORMAL)
            ip, ts = env.random_device_for_employee(emp).ip, _work_hour_ts()

        return {
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "user": emp.emp_id, "ip": ip, "device": emp.device,
            "event_type": event_type, "source": "IAM",
            "severity": _severity(event_type),
            "session_id": _uid()[:8],
            "user_risk_score": emp.risk_score,
            "details": {"department": emp.department, "role": emp.role},
        }


class EDRLogGenerator:
    NORMAL     = ["process_start", "file_access", "file_access", "file_download"]
    SUSPICIOUS = ["script_execution", "file_access", "process_start",
                  "privilege_escalation", "malware_detected"]
    NORMAL_PROCS    = ["chrome.exe","outlook.exe","excel.exe","word.exe","teams.exe",
                       "explorer.exe","python.exe","java.exe","notepad.exe","svchost.exe"]
    SUSPICIOUS_PROCS = ["powershell.exe","cmd.exe","wscript.exe","mshta.exe",
                        "regsvr32.exe","certutil.exe","bitsadmin.exe"]

    def generate(self, env: EnterpriseEnvironment, suspicious: bool = False) -> Dict:
        emp = env.random_employee()
        dev = env.random_device_for_employee(emp)
        if suspicious:
            event_type = random.choice(self.SUSPICIOUS)
            process, ts = random.choice(self.SUSPICIOUS_PROCS), _off_hour_ts()
        else:
            event_type = random.choice(self.NORMAL)
            process, ts = random.choice(self.NORMAL_PROCS), _work_hour_ts()

        return {
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "user": emp.emp_id, "device": dev.hostname, "ip": dev.ip,
            "process": process, "event_type": event_type, "source": "EDR",
            "severity": _severity(event_type),
            "session_id": _uid()[:8],
            "user_risk_score": emp.risk_score,
            "details": {"os": dev.os, "pid": random.randint(1000, 65535),
                        "cmdline": f"{process} /run"},
        }


class FirewallLogGenerator:
    NORMAL     = ["connection_attempt", "connection_attempt", "vpn_connect", "vpn_disconnect"]
    SUSPICIOUS = ["blocked_ip", "connection_attempt", "port_scan",
                  "port_scan", "external_transfer"]

    def generate(self, env: EnterpriseEnvironment, suspicious: bool = False) -> Dict:
        emp = env.random_employee()
        dev = env.random_device_for_employee(emp)
        srv = env.random_server()
        if suspicious:
            event_type = random.choice(self.SUSPICIOUS)
            src_ip, dest_ip = env.random_external_ip(), dev.ip
            ts = _off_hour_ts()
            port = random.choice([22, 23, 3389, 445, 1433, 8080])
        else:
            event_type = random.choice(self.NORMAL)
            src_ip, dest_ip = dev.ip, srv.ip
            ts = _work_hour_ts()
            port = random.choice([80, 443, 8443, 8080, 3306])

        return {
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "user": emp.emp_id, "src_ip": src_ip, "dest_ip": dest_ip,
            "port": str(port), "protocol": random.choice(["TCP", "UDP", "HTTPS"]),
            "event_type": event_type, "source": "FIREWALL",
            "severity": _severity(event_type),
            "session_id": _uid()[:8],
            "user_risk_score": emp.risk_score,
            "details": {"bytes_in": random.randint(64, 65535),
                        "bytes_out": random.randint(64, 65535),
                        "action": "deny" if event_type in ("blocked_ip","port_scan") else "allow"},
        }


class AppLogGenerator:
    NORMAL     = ["database_query", "data_access", "file_download", "database_query"]
    SUSPICIOUS = ["data_access", "data_export", "database_query"]

    def generate(self, env: EnterpriseEnvironment, suspicious: bool = False) -> Dict:
        emp = env.random_employee()
        db  = env.random_database()
        dev = env.random_device_for_employee(emp)
        if suspicious:
            event_type = random.choice(self.SUSPICIOUS)
            records, ts = random.randint(5000, 100000), _off_hour_ts()
        else:
            event_type = random.choice(self.NORMAL)
            records, ts = random.randint(1, 500), _work_hour_ts()

        return {
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "user": emp.emp_id, "asset": db.name, "ip": dev.ip,
            "event_type": event_type, "source": "APP",
            "severity": _severity(event_type),
            "session_id": _uid()[:8],
            "user_risk_score": emp.risk_score,
            "details": {"records": records, "db_id": db.db_id,
                        "sensitivity": db.sensitivity},
        }


# ---------------------------------------------------------------------------
# Multi-format serialisers
# ---------------------------------------------------------------------------

# All fields written to CSV/KV (EC-04 fix: includes enrichment fields)
_OUTPUT_FIELDS = [
    "timestamp","user","device","asset","ip","event_type","source","severity",
    "session_id","mitre_technique","mitre_tactic","geo_country","geo_risk",
    "network_zone","asset_criticality","threat_score","user_risk_score",
    "attack_chain",
]

CSV_HEADER = ",".join(_OUTPUT_FIELDS)


def to_json(log: Dict) -> str:
    return json.dumps(log)


def _flatten_value(v: Any, depth: int = 0) -> str:
    """Recursively flatten nested dicts to strings (EC-12 fix)."""
    if isinstance(v, dict) and depth < 3:
        return str({k: _flatten_value(vv, depth+1) for k, vv in v.items()})
    return str(v)


def to_kv(log: Dict) -> str:
    """Key=value serialiser. Flattens details dict; handles nested values."""
    parts = []
    for field in _OUTPUT_FIELDS:
        val = log.get(field, "")
        parts.append(f'{field}="{val}"')
    # Also flatten details
    details = log.get("details", {})
    if isinstance(details, dict):
        for k, v in details.items():
            flat_v = _flatten_value(v)
            parts.append(f'details_{k}="{flat_v}"')
    return " ".join(parts)


def to_csv_line(log: Dict) -> str:
    """CSV serialiser with all enrichment fields (EC-04 fix)."""
    row = [str(log.get(f, "")) for f in _OUTPUT_FIELDS]
    buf = io.StringIO()
    csv.writer(buf).writerow(row)
    return buf.getvalue().strip()


def to_raw_text(log: Dict) -> str:
    event = log.get("event_type", "unknown")
    user  = log.get("user", "unknown")
    ip    = log.get("ip", "unknown")
    ts    = log.get("timestamp", "")
    asset = log.get("asset", log.get("device", "unknown"))
    mitre = log.get("mitre_technique", "")
    score = log.get("threat_score", "")
    return f"[{ts}] User {user} triggered {event} from {ip} on {asset} [mitre={mitre} score={score}]"


FORMAT_FUNCS   = [to_json, to_kv, to_csv_line, to_raw_text]
FORMAT_WEIGHTS = [0.40, 0.25, 0.20, 0.15]


def serialise(log: Dict) -> Tuple[str, str]:
    fn = random.choices(FORMAT_FUNCS, weights=FORMAT_WEIGHTS, k=1)[0]
    name = {to_json:"json", to_kv:"kv", to_csv_line:"csv", to_raw_text:"raw"}[fn]
    return fn(log), name


# ---------------------------------------------------------------------------
# Master Log Generator
# ---------------------------------------------------------------------------

class LogGenerator:
    """
    Generates logs with configurable probability distribution.
    Attack chains are buffered and drained one event per tick to preserve
    chronological streaming order.
    """

    def __init__(self):
        self.env          = get_enterprise_env()
        self.iam_gen      = IAMLogGenerator()
        self.edr_gen      = EDRLogGenerator()
        self.fw_gen       = FirewallLogGenerator()
        self.app_gen      = AppLogGenerator()
        self._source_gens = [self.iam_gen, self.edr_gen, self.fw_gen, self.app_gen]
        self._attack_gen  = get_attack_generator()
        self._attack_queue: List[Dict[str, Any]] = []

    def _enrich(self, log: Dict[str, Any]) -> Dict[str, Any]:
        """Apply MITRE + security context enrichment."""
        emp = self.env.get_employee(log.get("user", ""))
        if emp and "user_risk_score" not in log:
            log["user_risk_score"] = emp.risk_score
        enrich_event_mitre(log)
        _enrich_context(log)
        return log

    def _generate_one(self) -> Dict[str, Any]:
        # Drain buffered attack-chain events first
        if self._attack_queue:
            return self._enrich(self._attack_queue.pop(0))

        roll = random.random()

        # Attack chain injection bucket
        if roll < ATTACK_CHAIN_PCT:
            atk_type = random.choice(self._attack_gen.available_attack_types())
            chain    = self._attack_gen.generate_attack(self.env, atk_type)
            if chain:
                # Enrich whole chain upfront then buffer remainder
                enriched = [self._enrich(e) for e in chain]
                self._attack_queue.extend(enriched[1:])
                return enriched[0]

        # Suspicious single event
        suspicious = roll >= SUSPICIOUS_THRESHOLD

        gen = random.choice(self._source_gens)
        log = gen.generate(self.env, suspicious=suspicious)
        log["event_id"] = _uid()
        return self._enrich(log)

    def generate_batch(self, count: int = 10_000) -> List[Dict[str, Any]]:
        return [self._generate_one() for _ in range(count)]

    def stream(self) -> Iterator[Dict[str, Any]]:
        """Infinite iterator yielding one enriched log at a time."""
        while True:
            yield self._generate_one()

    def generate_to_file(
        self,
        output_dir: str = "data/raw_logs",
        count: int = 10_000,
        mixed_formats: bool = True,
    ) -> Dict[str, int]:
        """
        Write logs to disk. Uses write mode with a run-timestamp suffix
        to avoid accumulation across restarts (EC-11 fix).
        Returns per-format counts.
        """
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        stats: Dict[str, int] = {"json": 0, "kv": 0, "csv": 0, "raw": 0}
        handles = {
            "json": open(f"{output_dir}/logs_{run_ts}.json", "w"),
            "kv":   open(f"{output_dir}/logs_{run_ts}.kv",   "w"),
            "csv":  open(f"{output_dir}/logs_{run_ts}.csv",  "w"),
            "raw":  open(f"{output_dir}/logs_{run_ts}.txt",  "w"),
        }
        handles["csv"].write(CSV_HEADER + "\n")

        try:
            for log in self.generate_batch(count):
                raw_str, fmt = serialise(log) if mixed_formats else (to_json(log), "json")
                handles[fmt].write(raw_str + "\n")
                stats[fmt] += 1
        finally:
            for fh in handles.values():
                fh.close()
        return stats


if __name__ == "__main__":
    gen = LogGenerator()
    stats = gen.generate_to_file(count=200)
    print("Generated per format:", stats)