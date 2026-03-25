"""
Garud-Drishti SOC — Multi-Format Log Parser
=============================================
Parses heterogeneous security logs from four formats:
  - JSON
  - CSV
  - Key-Value (key=value pairs)
  - Raw Text (human-readable log lines)

Outputs a unified Python dictionary for downstream schema mapping.
"""

import json
import re
import csv
from io import StringIO
from typing import Dict, Optional, List


class LogParser:
    """
    Universal log parser for SOC telemetry ingestion.
    Automatically detects format and parses into a structured dict.
    """

    # ─────────────────────────────────────────
    # MAIN PARSE ENTRY POINT
    # ─────────────────────────────────────────

    def parse(self, raw_log) -> Optional[Dict]:
        """
        Parse a single raw log entry of any supported format.

        Args:
            raw_log: str or dict — the raw log data

        Returns:
            Parsed dictionary or None if unparseable
        """
        # Already a dict — pass through
        if isinstance(raw_log, dict):
            return self._normalize_keys(raw_log)

        if not isinstance(raw_log, str):
            return None

        raw_log = raw_log.strip()
        if not raw_log:
            return None

        # Try each parser in order of specificity
        result = None

        # 1. JSON
        result = self._try_json(raw_log)
        if result:
            return self._normalize_keys(result)

        # 2. Key-Value (has = without being JSON)
        result = self._try_kv(raw_log)
        if result:
            return self._normalize_keys(result)

        # 3. CSV (has commas, no = signs, no brackets)
        result = self._try_csv(raw_log)
        if result:
            return self._normalize_keys(result)

        # 4. Raw text (structured log line)
        result = self._try_raw_text(raw_log)
        if result:
            return self._normalize_keys(result)

        # 5. Fallback: store as-is
        return {"event_type": "raw_text", "details": raw_log}

    def parse_batch(self, raw_logs: List) -> List[Dict]:
        """Parse a batch of raw logs."""
        results = []
        for log in raw_logs:
            parsed = self.parse(log)
            if parsed:
                results.append(parsed)
        return results

    # ─────────────────────────────────────────
    # JSON PARSER
    # ─────────────────────────────────────────

    def _try_json(self, text: str) -> Optional[Dict]:
        """Try to parse as JSON."""
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, ValueError):
            pass
        return None

    # ─────────────────────────────────────────
    # KEY-VALUE PARSER
    # ─────────────────────────────────────────

    def _try_kv(self, text: str) -> Optional[Dict]:
        """
        Try to parse key=value format.
        Handles: key=value key2=value2 key3="value with spaces"
        """
        if "=" not in text:
            return None

        # Match key=value with optional quoted values
        pattern = r'(\w+)=(?:"([^"]*)"|([\S]+))'
        matches = re.findall(pattern, text)

        if len(matches) < 2:
            # Also try simpler pattern
            simple_pattern = r'(\w+)=(\S+)'
            matches = re.findall(simple_pattern, text)
            if len(matches) < 2:
                return None
            return {k: v for k, v in matches}

        result = {}
        for key, quoted_val, unquoted_val in matches:
            result[key] = quoted_val if quoted_val else unquoted_val

        return result if result else None

    # ─────────────────────────────────────────
    # CSV PARSER
    # ─────────────────────────────────────────

    CSV_FIELDS = [
        "timestamp", "user", "event_type", "ip",
        "source", "asset", "severity", "device"
    ]

    def _try_csv(self, text: str) -> Optional[Dict]:
        """
        Try to parse as a CSV line.
        Assumes standard field order from our generator.
        """
        if "," not in text or "=" in text:
            return None

        # Skip header lines
        if text.lower().startswith("timestamp,"):
            return None

        try:
            reader = csv.reader(StringIO(text))
            row = next(reader)

            if len(row) < 3:
                return None

            # Map to known fields
            result = {}
            for i, field in enumerate(self.CSV_FIELDS):
                if i < len(row) and row[i]:
                    result[field] = row[i]

            if result:
                result["_format"] = "csv"
                return result

        except (csv.Error, StopIteration):
            pass

        return None

    # ─────────────────────────────────────────
    # RAW TEXT PARSER
    # ─────────────────────────────────────────

    def _try_raw_text(self, text: str) -> Optional[Dict]:
        """
        Parse structured raw text log lines.
        Expected format: [timestamp] [SEVERITY] User user_id event_type from ip on asset
        """
        # Pattern: [timestamp] [SEVERITY] User <user> <event_type> from <ip> on <asset>
        pattern = (
            r'\[([^\]]+)\]\s+'            # [timestamp]
            r'\[([A-Z]+)\]\s+'            # [SEVERITY]
            r'User\s+(\S+)\s+'            # User emp_xxx
            r'(\S+)\s+'                   # event_type
            r'from\s+(\S+)\s+'            # from ip
            r'on\s+(\S+)'                 # on asset
        )

        match = re.match(pattern, text)
        if match:
            return {
                "timestamp": match.group(1),
                "severity": match.group(2).lower(),
                "user": match.group(3),
                "event_type": match.group(4),
                "ip": match.group(5),
                "asset": match.group(6),
                "_format": "raw_text",
            }

        # Simpler patterns
        # Pattern: "User <user> <action> from <ip>"
        simple = re.match(
            r'User\s+(\S+)\s+(.+?)\s+from\s+(\S+)',
            text
        )
        if simple:
            return {
                "user": simple.group(1),
                "event_type": simple.group(2).replace(" ", "_").lower(),
                "ip": simple.group(3),
                "_format": "raw_text",
            }

        return None

    # ─────────────────────────────────────────
    # UTILITIES
    # ─────────────────────────────────────────

    def _normalize_keys(self, data: Dict) -> Dict:
        """Normalize all keys to lowercase."""
        return {k.lower(): v for k, v in data.items()}


# ═══════════════════════════════════════════════
# STANDALONE TEST
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    parser = LogParser()

    test_inputs = [
        # JSON
        '{"user":"emp_101","event_type":"login_success","ip":"10.0.0.5","source":"IAM"}',
        # Key-Value
        'user=emp_102 action=login_failed ip=10.0.0.5 source=IAM',
        # CSV
        '2026-03-15T10:11:22,emp_103,file_access,10.0.1.30,EDR,finance-laptop-001,low,finance-laptop-001',
        # Raw text
        '[2026-03-15T10:11:22] [HIGH] User emp_104 privilege_escalation from 10.0.0.5 on core-banking-db',
        # Dict
        {"user": "emp_105", "event_type": "login_success"},
    ]

    for inp in test_inputs:
        result = parser.parse(inp)
        print(f"Input type: {type(inp).__name__}")
        print(f"Parsed: {json.dumps(result, indent=2, default=str)}\n")
