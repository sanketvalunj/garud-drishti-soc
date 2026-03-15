"""
Garud-Drishti — AI SOC Platform
Enterprise Environment Simulator

Simulates a realistic banking enterprise network: employees, devices,
servers, databases, and network segments.

Edge cases fixed:
  - Thread-safe singleton via threading.Lock
  - External IP pool filtered to exclude private/RFC-1918 addresses
  - Guard clauses on all random selectors (no IndexError on empty lists)
"""

import random
import ipaddress
import threading
from dataclasses import dataclass
from typing import List, Dict, Optional


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class Employee:
    emp_id: str
    name: str
    department: str
    role: str
    device: str
    risk_score: float  # 0.0 – 1.0; higher = riskier user


@dataclass
class Device:
    device_id: str
    hostname: str
    os: str
    department: str
    ip: str


@dataclass
class Server:
    server_id: str
    hostname: str
    role: str
    ip: str
    criticality: str  # low | medium | high | critical


@dataclass
class Database:
    db_id: str
    name: str
    server: str
    sensitivity: str  # internal | confidential | restricted


@dataclass
class NetworkSegment:
    name: str
    cidr: str
    description: str


# ---------------------------------------------------------------------------
# Enterprise Environment
# ---------------------------------------------------------------------------

class EnterpriseEnvironment:
    """
    Simulates the full internal network of a banking organisation.
    All entities are generated once and reused across log generators.
    """

    DEPARTMENTS = ["finance", "trading", "hr", "risk", "security", "ops", "compliance"]

    ROLES_BY_DEPT: Dict[str, List[str]] = {
        "finance":    ["analyst", "senior_analyst", "manager"],
        "trading":    ["trader", "quant", "desk_head"],
        "hr":         ["recruiter", "hr_manager", "payroll_officer"],
        "risk":       ["risk_analyst", "chief_risk_officer", "model_validator"],
        "security":   ["soc_analyst", "threat_hunter", "ciso"],
        "ops":        ["sysadmin", "devops_engineer", "infra_lead"],
        "compliance": ["compliance_officer", "auditor", "legal_counsel"],
    }

    OS_POOL = ["Windows 11", "Windows 10", "macOS 14", "Ubuntu 22.04", "RHEL 9"]

    def __init__(self, num_employees: int = 50, external_pool_size: int = 500):
        if num_employees <= 0:
            raise ValueError(f"num_employees must be > 0, got {num_employees}")

        self.num_employees = num_employees
        self.employees:  List[Employee]       = []
        self.devices:    List[Device]         = []
        self.servers:    List[Server]         = []
        self.databases:  List[Database]       = []
        self.segments:   List[NetworkSegment] = []

        # Internal IP pools
        self._internal_pool = list(ipaddress.IPv4Network("10.0.0.0/16").hosts())
        self._db_pool        = list(ipaddress.IPv4Network("172.16.0.0/24").hosts())
        self._ip_counter     = 0
        self._db_ip_counter  = 0

        # External IP pool — filtered to exclude any private/RFC-1918 ranges
        # EC-07 fix: randint can produce 10.x, 172.16.x, 192.168.x — exclude those
        raw_pool: List[str] = []
        attempts = 0
        while len(raw_pool) < external_pool_size and attempts < external_pool_size * 10:
            attempts += 1
            ip_str = (
                f"{random.randint(1,254)}.{random.randint(1,254)}."
                f"{random.randint(1,254)}.{random.randint(1,254)}"
            )
            try:
                if not ipaddress.ip_address(ip_str).is_private:
                    raw_pool.append(ip_str)
            except ValueError:
                continue
        self._external_pool = raw_pool

        self._build()

    # ------------------------------------------------------------------
    def _next_internal_ip(self) -> str:
        ip = str(self._internal_pool[self._ip_counter % len(self._internal_pool)])
        self._ip_counter += 1
        return ip

    def random_external_ip(self) -> str:
        if not self._external_pool:
            raise RuntimeError("External IP pool is empty")
        return random.choice(self._external_pool)

    # ------------------------------------------------------------------
    def _build(self):
        self._build_segments()
        self._build_employees()
        self._build_servers()
        self._build_databases()

    def _build_segments(self):
        self.segments = [
            NetworkSegment("internal-network",  "10.0.0.0/16",   "Corporate LAN"),
            NetworkSegment("secure-db-network", "172.16.0.0/24", "Isolated DB tier"),
            NetworkSegment("external-internet", "0.0.0.0/0",     "Internet-facing zone"),
            NetworkSegment("dmz",               "192.168.1.0/24","DMZ / perimeter"),
        ]

    def _build_employees(self):
        first_names = [
            "Amit","Priya","Rahul","Neha","Vikram","Sunita","Arjun","Kavya",
            "Ravi","Deepa","Suresh","Anita","Manoj","Pooja","Kiran","Sanjay",
            "Meera","Arun","Nisha","Vijay","Lakshmi","Rajesh","Divya","Sunil",
            "Rekha","Nikhil","Smita","Pranav","Swati","Gaurav","Shruti","Vivek",
            "Pallavi","Ashish","Sneha","Santosh","Varsha","Dinesh","Preeti","Alok",
            "Jyoti","Hemant","Madhuri","Yogesh","Shweta","Pankaj","Tanya","Sachin",
            "Bhavana","Rohan",
        ]
        last_names = [
            "Sharma","Patel","Singh","Verma","Kumar","Gupta","Shah","Rao",
            "Joshi","Nair","Reddy","Iyer","Menon","Pillai","Desai","Bhat",
            "Chopra","Malhotra","Kapoor","Mehta","Sinha","Bose","Das","Ghosh",
            "Sen","Mukherjee","Chatterjee","Roy","Banerjee","Dutta",
        ]

        for i in range(self.num_employees):
            emp_id   = f"emp_{101 + i}"
            dept     = random.choice(self.DEPARTMENTS)
            role     = random.choice(self.ROLES_BY_DEPT[dept])
            fname    = first_names[i % len(first_names)]
            lname    = random.choice(last_names)
            hostname = f"{dept}-{'laptop' if dept in ('finance','hr') else 'workstation'}-{i+1:03d}"

            self.employees.append(Employee(
                emp_id=emp_id, name=f"{fname} {lname}",
                department=dept, role=role, device=hostname,
                risk_score=round(random.uniform(0.05, 0.95), 2),
            ))
            self.devices.append(Device(
                device_id=f"dev_{i+1:03d}", hostname=hostname,
                os=random.choice(self.OS_POOL), department=dept,
                ip=self._next_internal_ip(),
            ))

    def _build_servers(self):
        defs = [
            ("auth-server",     "authentication",    "critical"),
            ("payments-server", "payment_processing","critical"),
            ("internal-api",    "api_gateway",       "high"),
            ("trading-engine",  "trading_platform",  "critical"),
            ("email-server",    "email",             "medium"),
            ("file-server",     "file_storage",      "medium"),
            ("vpn-gateway",     "vpn",               "high"),
            ("siem-server",     "siem",              "high"),
            ("backup-server",   "backup",            "medium"),
            ("monitoring-srv",  "monitoring",        "low"),
        ]
        for sid, (hostname, role, criticality) in enumerate(defs):
            self.servers.append(Server(
                server_id=f"srv_{sid+1:02d}", hostname=hostname,
                role=role, ip=self._next_internal_ip(), criticality=criticality,
            ))

    def _build_databases(self):
        defs = [
            ("core-banking-db", "payments-server", "restricted"),
            ("payments-db",     "payments-server", "restricted"),
            ("customer-db",     "internal-api",    "confidential"),
            ("risk-db",         "internal-api",    "confidential"),
            ("audit-db",        "auth-server",     "restricted"),
            ("trading-db",      "trading-engine",  "restricted"),
            ("hr-db",           "internal-api",    "confidential"),
            ("archive-db",      "backup-server",   "internal"),
        ]
        for did, (name, server, sensitivity) in enumerate(defs):
            self.databases.append(Database(
                db_id=f"db_{did+1:02d}", name=name,
                server=server, sensitivity=sensitivity,
            ))

    # ------------------------------------------------------------------
    # Accessors — all with empty-list guards (EC-15)
    # ------------------------------------------------------------------

    def get_employee(self, emp_id: str) -> Optional[Employee]:
        return next((e for e in self.employees if e.emp_id == emp_id), None)

    def random_employee(self) -> Employee:
        if not self.employees:
            raise ValueError("No employees in environment — was _build() called?")
        return random.choice(self.employees)

    def random_server(self) -> Server:
        if not self.servers:
            raise ValueError("No servers in environment — was _build() called?")
        return random.choice(self.servers)

    def random_database(self) -> Database:
        if not self.databases:
            raise ValueError("No databases in environment — was _build() called?")
        return random.choice(self.databases)

    def random_device_for_employee(self, emp: Employee) -> Device:
        match = [d for d in self.devices if d.hostname == emp.device]
        if match:
            return match[0]
        if not self.devices:
            raise ValueError("No devices in environment — was _build() called?")
        return random.choice(self.devices)

    def summary(self) -> Dict:
        return {
            "employees": len(self.employees),
            "devices":   len(self.devices),
            "servers":   len(self.servers),
            "databases": len(self.databases),
            "segments":  len(self.segments),
        }


# ---------------------------------------------------------------------------
# Thread-safe singleton factory (EC-02 fix)
# ---------------------------------------------------------------------------

_env_instance: Optional[EnterpriseEnvironment] = None
_env_lock = threading.Lock()


def get_enterprise_env(num_employees: int = 50) -> EnterpriseEnvironment:
    """Return a cached singleton EnterpriseEnvironment. Thread-safe."""
    global _env_instance
    if _env_instance is None:
        with _env_lock:
            if _env_instance is None:          # double-checked locking
                _env_instance = EnterpriseEnvironment(num_employees)
    return _env_instance


def reset_enterprise_env() -> None:
    """Reset the singleton — useful in tests."""
    global _env_instance
    with _env_lock:
        _env_instance = None


if __name__ == "__main__":
    env = get_enterprise_env()
    print("Summary:", env.summary())
    print("Sample employee:", env.random_employee())
    print("External pool sample (all public):", env._external_pool[:5])