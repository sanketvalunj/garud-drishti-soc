"""
Garud-Drishti — AI SOC Platform
Attack Chain Simulator  (simulator/attack_scenarios.py)

Two public surfaces:

  AttackScenarioGenerator  — primary class
    .generate_bruteforce_attack(env)
    .generate_privilege_escalation(env)
    .generate_insider_data_theft(env)
    .generate_data_exfiltration(env)
    .generate_lateral_movement(env)
    .generate_suspicious_night_login(env)
    .generate_malware_infection(env)
    .generate_attack(env, attack_type)     master dispatcher

  AttackScenarios  — backward-compat legacy class
    .run(scenario_type, target_user)

Every event is fully schema-compliant with event_id, MITRE fields,
geo context, threat score, and attack_chain label populated.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from simulator.enterprise_simulator import EnterpriseEnvironment, get_enterprise_env


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uid() -> str:
    return str(uuid.uuid4())

def _sid() -> str:
    return _uid()[:8]

def _ts(base: datetime, delta_seconds: int = 0) -> str:
    return (base + timedelta(seconds=delta_seconds)).strftime("%Y-%m-%dT%H:%M:%S")

def _off_hour_base() -> datetime:
    return datetime.now().replace(
        hour=random.randint(1, 4), minute=random.randint(0, 59),
        second=0, microsecond=0,
    )

def _work_hour_base() -> datetime:
    return datetime.now().replace(
        hour=random.randint(9, 17), minute=random.randint(0, 59),
        second=0, microsecond=0,
    )

_ESCALATION = {0: "low", 1: "medium", 2: "high", 3: "critical"}

def _escalating_severity(step: int, max_steps: int) -> str:
    if max_steps <= 0:
        return "low"
    return _ESCALATION[min(3, int(step / max_steps * 4))]

_SEVERITY_BASE: Dict[str, str] = {
    "login_success": "low", "login_failed": "medium", "account_locked": "high",
    "mfa_attempt": "low", "mfa_failed": "high", "process_start": "low",
    "file_access": "low", "file_download": "medium", "script_execution": "high",
    "privilege_escalation": "critical", "malware_detected": "critical",
    "connection_attempt": "low", "blocked_ip": "medium", "port_scan": "high",
    "external_transfer": "high", "database_query": "low", "data_access": "medium",
    "data_export": "critical", "vpn_connect": "low", "logout": "low",
}

def _sev(event_type: str) -> str:
    return _SEVERITY_BASE.get(event_type, "low")


# Lazy enrichment imports to avoid circular deps
def _get_mitre_enrich():
    from backend.threat_intel.mitre_mapping import enrich_event_mitre
    return enrich_event_mitre

def _get_ctx_enrich():
    from backend.enrichment.security_context import enrich_event as _ctx
    return _ctx


def _event(
    *, timestamp: str, user: str, event_type: str, source: str,
    session_id: str, attack_chain: str, severity: Optional[str] = None,
    device: str = "", asset: str = "", ip: str = "", src_ip: str = "",
    dest_ip: str = "", port: str = "", protocol: str = "", process: str = "",
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a fully schema-compliant event dict and enrich it in-place."""
    doc = {
        "event_id":      _uid(),
        "timestamp":     timestamp,
        "user":          user,
        "device":        device,
        "asset":         asset,
        "ip":            ip or src_ip,
        "src_ip":        src_ip or ip,
        "dest_ip":       dest_ip,
        "port":          port,
        "protocol":      protocol,
        "process":       process,
        "event_type":    event_type,
        "source":        source,
        "severity":      severity if severity else _sev(event_type),
        "session_id":    session_id,
        "details":       details or {},
        "_attack_chain": attack_chain,
    }
    _get_mitre_enrich()(doc)
    _get_ctx_enrich()(doc)
    return doc


# ---------------------------------------------------------------------------
# AttackScenarioGenerator
# ---------------------------------------------------------------------------

class AttackScenarioGenerator:
    """Generates correlated multi-stage cyber-attack chains."""

    SCENARIO_MAP: Dict[str, str] = {
        "brute_force":            "generate_bruteforce_attack",
        "privilege_escalation":   "generate_privilege_escalation",
        "insider_data_theft":     "generate_insider_data_theft",
        "data_exfiltration":      "generate_data_exfiltration",
        "lateral_movement":       "generate_lateral_movement",
        "suspicious_night_login": "generate_suspicious_night_login",
        "malware_infection":      "generate_malware_infection",
    }

    # High-risk attacker origin countries
    HIGH_RISK_COUNTRIES = ["RU", "CN", "KP", "IR", "NG"]

    # ------------------------------------------------------------------
    def generate_bruteforce_attack(self, env: EnterpriseEnvironment,
                                   target_user: Optional[str] = None) -> List[Dict]:
        emp      = env.get_employee(target_user) if target_user else env.random_employee()
        src_ip   = env.random_external_ip()
        base     = _off_hour_base()
        sid      = _sid()
        chain    = "brute_force"
        attempts = random.randint(5, 15)
        events   = []

        for i in range(attempts):
            events.append(_event(
                timestamp=_ts(base, i * 8), user=emp.emp_id, event_type="login_failed",
                source="IAM", session_id=sid, attack_chain=chain,
                severity=_escalating_severity(i, attempts),
                device=emp.device, ip=src_ip,
                details={"attempt": i+1, "reason": "invalid_password",
                         "department": emp.department, "after_hours": True},
            ))

        events.append(_event(
            timestamp=_ts(base, attempts*8+5), user=emp.emp_id,
            event_type="account_locked", source="IAM", session_id=sid,
            attack_chain=chain, device=emp.device, ip=src_ip,
            details={"reason": "max_failed_attempts", "threshold": attempts},
        ))
        events.append(_event(
            timestamp=_ts(base, attempts*8+120), user=emp.emp_id,
            event_type="login_success", source="IAM", session_id=_sid(),
            attack_chain=chain, device=emp.device, ip=src_ip,
            details={"mfa_bypassed": True, "geo_anomaly": True, "after_hours": True},
        ))
        return events

    # ------------------------------------------------------------------
    def generate_privilege_escalation(self, env: EnterpriseEnvironment,
                                      target_user: Optional[str] = None) -> List[Dict]:
        emp  = env.get_employee(target_user) if target_user else env.random_employee()
        dev  = env.random_device_for_employee(emp)
        srv  = env.random_server()
        src  = env.random_external_ip()
        base = _off_hour_base()
        sid  = _sid()
        chain = "privilege_escalation"

        return [
            _event(timestamp=_ts(base, 0), user=emp.emp_id, event_type="login_success",
                   source="IAM", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=src,
                   details={"department": emp.department, "after_hours": True,
                            "geo_country": random.choice(self.HIGH_RISK_COUNTRIES)}),
            _event(timestamp=_ts(base, 60), user=emp.emp_id, event_type="script_execution",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip, process="powershell.exe",
                   details={"script": "Invoke-TokenManipulation.ps1", "encoded": True,
                            "os": dev.os, "pid": random.randint(1000, 65535)}),
            _event(timestamp=_ts(base, 90), user=emp.emp_id, event_type="privilege_escalation",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip, asset=srv.hostname, process="lsass.exe",
                   details={"method": "token_impersonation", "target_role": "SYSTEM",
                            "technique": "T1134", "os": dev.os}),
            _event(timestamp=_ts(base, 105), user=emp.emp_id, event_type="process_start",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip, process="cmd.exe",
                   details={"parent_process": "lsass.exe", "integrity": "SYSTEM",
                            "cmdline": "cmd.exe /c whoami /all",
                            "pid": random.randint(1000, 65535), "os": dev.os}),
        ]

    # ------------------------------------------------------------------
    def generate_insider_data_theft(self, env: EnterpriseEnvironment,
                                    target_user: Optional[str] = None) -> List[Dict]:
        emp   = env.get_employee(target_user) if target_user else env.random_employee()
        db    = env.random_database()
        dev   = env.random_device_for_employee(emp)
        base  = datetime.now().replace(hour=23, minute=random.randint(45, 59),
                                       second=0, microsecond=0)
        sid   = _sid()
        chain = "insider_data_theft"
        rows  = random.randint(30_000, 150_000)

        return [
            _event(timestamp=_ts(base, 0), user=emp.emp_id, event_type="login_success",
                   source="IAM", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip,
                   details={"after_hours": True, "department": emp.department,
                            "risk_score": emp.risk_score}),
            _event(timestamp=_ts(base, 45), user=emp.emp_id, event_type="database_query",
                   source="APP", session_id=sid, attack_chain=chain,
                   asset=db.name, ip=dev.ip,
                   details={"query": f"SELECT * FROM customers LIMIT {rows}",
                            "rows_returned": rows, "anomaly": "unusually_large_result_set",
                            "sensitivity": db.sensitivity}),
            _event(timestamp=_ts(base, 90), user=emp.emp_id, event_type="data_access",
                   source="APP", session_id=sid, attack_chain=chain,
                   asset=db.name, ip=dev.ip,
                   details={"records": rows, "classification": "restricted",
                            "sensitivity": db.sensitivity}),
            _event(timestamp=_ts(base, 150), user=emp.emp_id, event_type="data_export",
                   source="APP", session_id=sid, attack_chain=chain,
                   asset=db.name, ip=dev.ip,
                   details={"file": "customer_dump.csv", "size_mb": round(rows*0.004, 1),
                            "destination": "external_usb", "records": rows}),
        ]

    # ------------------------------------------------------------------
    def generate_data_exfiltration(self, env: EnterpriseEnvironment,
                                   target_user: Optional[str] = None) -> List[Dict]:
        emp   = env.get_employee(target_user) if target_user else env.random_employee()
        dev   = env.random_device_for_employee(emp)
        ext   = env.random_external_ip()
        src   = dev.ip
        base  = _work_hour_base()
        sid   = _sid()
        chain = "data_exfiltration"
        bytes_ = random.randint(50_000_000, 500_000_000)

        return [
            _event(timestamp=_ts(base, 0), user=emp.emp_id, event_type="file_access",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=src, asset="file-server",
                   details={"path": "/shares/finance/q1_report.pdf",
                            "operation": "read", "size_mb": random.randint(5, 80)}),
            _event(timestamp=_ts(base, 30), user=emp.emp_id, event_type="process_start",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=src, process="7z.exe",
                   details={"args": "a -p archive.7z /shares/finance/",
                            "compression": True, "pid": random.randint(1000, 65535)}),
            _event(timestamp=_ts(base, 60), user=emp.emp_id, event_type="port_scan",
                   source="FIREWALL", session_id=sid, attack_chain=chain,
                   ip=src, src_ip=src, dest_ip=ext,
                   details={"ports_scanned": [21, 22, 443, 8080, 4444],
                            "tool": "nmap_suspected"}),
            _event(timestamp=_ts(base, 120), user=emp.emp_id, event_type="external_transfer",
                   source="FIREWALL", session_id=sid, attack_chain=chain,
                   ip=src, src_ip=src, dest_ip=ext, port="443", protocol="HTTPS",
                   details={"bytes_sent": bytes_,
                            "bytes_sent_mb": round(bytes_/1_048_576, 1),
                            "c2_suspected": True}),
        ]

    # ------------------------------------------------------------------
    def generate_lateral_movement(self, env: EnterpriseEnvironment,
                                  target_user: Optional[str] = None) -> List[Dict]:
        emp         = env.get_employee(target_user) if target_user else env.random_employee()
        dev         = env.random_device_for_employee(emp)
        hop_servers = random.sample(env.servers,
                                    min(random.randint(2, 4), len(env.servers)))
        ext_src     = env.random_external_ip()
        base        = _off_hour_base()
        sid         = _sid()
        chain       = "lateral_movement"
        events: List[Dict] = []

        events.append(_event(
            timestamp=_ts(base, 0), user=emp.emp_id, event_type="login_success",
            source="IAM", session_id=sid, attack_chain=chain,
            device=dev.hostname, ip=ext_src,
            details={"after_hours": True,
                     "geo_country": random.choice(self.HIGH_RISK_COUNTRIES)}))

        offset = 60
        for hop_idx, srv in enumerate(hop_servers):
            events.append(_event(
                timestamp=_ts(base, offset), user=emp.emp_id,
                event_type="connection_attempt", source="FIREWALL",
                session_id=sid, attack_chain=chain,
                ip=dev.ip, src_ip=dev.ip, dest_ip=srv.ip,
                port=str(random.choice([445, 135, 5985, 22, 3389])),
                protocol=random.choice(["SMB", "WMI", "WinRM", "SSH", "RDP"]),
                details={"target_host": srv.hostname, "hop_number": hop_idx+1,
                         "lateral_move": True}))
            offset += 30

            events.append(_event(
                timestamp=_ts(base, offset), user=emp.emp_id,
                event_type="process_start", source="EDR",
                session_id=sid, attack_chain=chain,
                device=srv.hostname, ip=srv.ip, asset=srv.hostname,
                process=random.choice(["wmic.exe", "psexec.exe", "schtasks.exe"]),
                details={"remote_exec": True, "hop_number": hop_idx+1,
                         "pid": random.randint(1000, 65535)}))
            offset += 30

        last_srv = hop_servers[-1]
        events.append(_event(
            timestamp=_ts(base, offset), user=emp.emp_id,
            event_type="privilege_escalation", source="EDR",
            session_id=sid, attack_chain=chain,
            device=last_srv.hostname, ip=last_srv.ip, asset=last_srv.hostname,
            details={"method": random.choice(["pass_the_hash", "kerberoasting",
                                              "token_impersonation"]),
                     "target": "SYSTEM"}))

        if last_srv.criticality in ("critical", "high"):
            db = env.random_database()
            events.append(_event(
                timestamp=_ts(base, offset+30), user=emp.emp_id,
                event_type="data_access", source="APP",
                session_id=sid, attack_chain=chain,
                asset=db.name, ip=last_srv.ip,
                details={"records": random.randint(1000, 50000),
                         "sensitivity": db.sensitivity}))
        return events

    # ------------------------------------------------------------------
    def generate_suspicious_night_login(self, env: EnterpriseEnvironment,
                                        target_user: Optional[str] = None) -> List[Dict]:
        emp   = env.get_employee(target_user) if target_user else env.random_employee()
        dev   = env.random_device_for_employee(emp)
        src   = env.random_external_ip()
        base  = datetime.now().replace(hour=3, minute=random.randint(0, 59),
                                       second=0, microsecond=0)
        sid   = _sid()
        chain = "suspicious_night_login"
        events: List[Dict] = []

        events.append(_event(
            timestamp=_ts(base, 0), user=emp.emp_id, event_type="login_success",
            source="IAM", session_id=sid, attack_chain=chain,
            device=dev.hostname, ip=src,
            details={"new_geo": True, "after_hours": True,
                     "country": random.choice(self.HIGH_RISK_COUNTRIES)}))

        for i, server in enumerate(random.sample(env.servers,
                                                  min(4, len(env.servers)))):
            events.append(_event(
                timestamp=_ts(base, 30+i*15), user=emp.emp_id,
                event_type="data_access", source="APP",
                session_id=sid, attack_chain=chain,
                asset=server.hostname, ip=src,
                details={"lateral_move": True, "hop": i+1,
                         "criticality": server.criticality}))

        events.append(_event(
            timestamp=_ts(base, 120), user=emp.emp_id, event_type="file_download",
            source="APP", session_id=sid, attack_chain=chain,
            asset="file-server", ip=src,
            details={"filename": "payroll_2026.xlsx", "size_mb": 12}))

        events.append(_event(
            timestamp=_ts(base, 135), user=emp.emp_id, event_type="script_execution",
            source="EDR", session_id=sid, attack_chain=chain,
            device=dev.hostname, ip=dev.ip, process="powershell.exe",
            details={"script": "exfil.ps1", "encoded": True, "os": dev.os}))
        return events

    # ------------------------------------------------------------------
    def generate_malware_infection(self, env: EnterpriseEnvironment,
                                   target_user: Optional[str] = None) -> List[Dict]:
        emp   = env.get_employee(target_user) if target_user else env.random_employee()
        dev   = env.random_device_for_employee(emp)
        c2    = env.random_external_ip()
        base  = _work_hour_base()
        sid   = _sid()
        chain = "malware_infection"

        return [
            _event(timestamp=_ts(base, 0), user=emp.emp_id, event_type="file_download",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip,
                   details={"filename": "invoice_2026.exe", "via": "email_attachment",
                            "hash": "d41d8cd98f00b204e9800998ecf8427e", "os": dev.os}),
            _event(timestamp=_ts(base, 15), user=emp.emp_id, event_type="malware_detected",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip,
                   details={"malware_name": "Emotet.B", "action": "quarantine_failed",
                            "os": dev.os}),
            _event(timestamp=_ts(base, 45), user=emp.emp_id, event_type="connection_attempt",
                   source="FIREWALL", session_id=sid, attack_chain=chain,
                   ip=dev.ip, src_ip=dev.ip, dest_ip=c2, port="443", protocol="HTTPS",
                   details={"c2_beacon": True, "interval_seconds": 30}),
            _event(timestamp=_ts(base, 75), user=emp.emp_id, event_type="privilege_escalation",
                   source="EDR", session_id=sid, attack_chain=chain,
                   device=dev.hostname, ip=dev.ip, process="cmd.exe",
                   details={"method": "uac_bypass", "target": "SYSTEM",
                            "technique": "T1548.002", "os": dev.os}),
        ]

    # ------------------------------------------------------------------
    def generate_attack(self, env: EnterpriseEnvironment, attack_type: str,
                        target_user: Optional[str] = None) -> List[Dict]:
        method_name = self.SCENARIO_MAP.get(attack_type)
        if not method_name:
            raise ValueError(
                f"Unknown attack type '{attack_type}'. "
                f"Available: {sorted(self.SCENARIO_MAP)}"
            )
        return getattr(self, method_name)(env=env, target_user=target_user)

    def available_attack_types(self) -> List[str]:
        return sorted(self.SCENARIO_MAP)


# ---------------------------------------------------------------------------
# Legacy backward-compat class
# ---------------------------------------------------------------------------

class AttackScenarios:
    """Legacy wrapper — delegates to AttackScenarioGenerator."""

    SCENARIO_MAP: Dict[str, str] = {
        k: k for k in AttackScenarioGenerator.SCENARIO_MAP
    }

    def __init__(self):
        self._gen = AttackScenarioGenerator()
        self.env  = get_enterprise_env()

    def run(self, scenario_type: str,
            target_user: Optional[str] = None) -> List[Dict]:
        return self._gen.generate_attack(
            env=self.env, attack_type=scenario_type, target_user=target_user)

    def brute_force(self, target_user=None):
        return self.run("brute_force", target_user)
    def insider_data_theft(self, target_user=None):
        return self.run("insider_data_theft", target_user)
    def data_exfiltration(self, target_user=None):
        return self.run("data_exfiltration", target_user)
    def malware_infection(self, target_user=None):
        return self.run("malware_infection", target_user)
    def suspicious_night_login(self, target_user=None):
        return self.run("suspicious_night_login", target_user)


# ---------------------------------------------------------------------------
# Singleton for LogGenerator injection
# ---------------------------------------------------------------------------

_attack_gen_instance: Optional[AttackScenarioGenerator] = None

def get_attack_generator() -> AttackScenarioGenerator:
    global _attack_gen_instance
    if _attack_gen_instance is None:
        _attack_gen_instance = AttackScenarioGenerator()
    return _attack_gen_instance


if __name__ == "__main__":
    import json
    env = get_enterprise_env()
    gen = AttackScenarioGenerator()
    for atk in gen.available_attack_types():
        events = gen.generate_attack(env, atk)
        print(f"{atk}: {len(events)} events, "
              f"mitre={events[0].get('mitre_technique')}, "
              f"geo={events[0].get('geo_country')}, "
              f"threat={events[0].get('threat_score')}")