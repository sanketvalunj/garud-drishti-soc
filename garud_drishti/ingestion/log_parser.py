import json
import re
import csv
import xml.etree.ElementTree as ET
from io import StringIO


class LogParser:
    """
    Universal Log Parser for SIEM ingestion.

    Supports:
    - Python dict logs
    - JSON logs
    - key=value logs
    - CSV logs
    - XML logs
    - Syslog style logs
    - Raw text fallback
    """

    def parse(self, raw_log):
        log = None

        # ----------------------------
        # CASE 1: Already dictionary
        # ----------------------------
        if isinstance(raw_log, dict):
            log = raw_log

        # ----------------------------
        # CASE 2: String logs
        # ----------------------------
        elif isinstance(raw_log, str):

            raw_log = raw_log.strip()

            # JSON
            try:
                log = json.loads(raw_log)
            except Exception:
                pass

            # XML
            if log is None and raw_log.startswith("<"):
                try:
                    log = self._parse_xml(raw_log)
                except Exception:
                    pass

            # CSV
            if log is None and "," in raw_log and "=" not in raw_log:
                try:
                    log = self._parse_csv(raw_log)
                except Exception:
                    pass

            # key=value
            if log is None and "=" in raw_log:
                log = self._parse_kv_text(raw_log)

            # Syslog detection
            if log is None and self._is_syslog(raw_log):
                log = {
                    "event_type": "syslog",
                    "details": raw_log
                }

            # Fallback raw
            if log is None:
                log = {
                    "event_type": "raw_text",
                    "details": raw_log
                }

        else:
            return None

        # Normalize keys
        log = {k.lower(): v for k, v in log.items()}

        return self._extract_common_fields(log)

    # ---------------------------------------------------
    # KEY VALUE PARSER
    # ---------------------------------------------------
    def _parse_kv_text(self, text):

        pairs = re.findall(r'(\w+)=([^\s]+)', text)

        log = {k: v for k, v in pairs}

        return log

    # ---------------------------------------------------
    # CSV PARSER
    # ---------------------------------------------------
    def _parse_csv(self, text):

        reader = csv.reader(StringIO(text))

        row = next(reader)

        return {"csv_data": row}

    # ---------------------------------------------------
    # XML PARSER
    # ---------------------------------------------------
    def _parse_xml(self, text):

        root = ET.fromstring(text)

        log = {}

        for child in root:
            log[child.tag] = child.text

        return log

    # ---------------------------------------------------
    # SYSLOG DETECTOR
    # ---------------------------------------------------
    def _is_syslog(self, text):

        pattern = r'^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}'

        return bool(re.match(pattern, text))

    # ---------------------------------------------------
    # NORMALIZATION
    # ---------------------------------------------------
    def _extract_common_fields(self, log):

        parsed = {}

        parsed["timestamp"] = (
            log.get("timestamp")
            or log.get("time")
            or log.get("@timestamp")
        )

        parsed["user"] = (
            log.get("user_id")
            or log.get("username")
            or log.get("user")
        )

        parsed["ip"] = (
            log.get("ip")
            or log.get("src_ip")
            or log.get("source_ip")
        )

        parsed["server"] = (
            log.get("server")
            or log.get("host")
            or log.get("dst_host")
        )

        parsed["device"] = log.get("device")

        parsed["action"] = (
            log.get("action")
            or log.get("event")
            or log.get("event_type")
        )

        parsed["source"] = log.get("source", "unknown")

        parsed["risk_flag"] = log.get("risk_flag", "normal")

        parsed["asset_criticality"] = log.get(
            "asset_criticality", "medium"
        )

        parsed["login_hour"] = log.get("login_hour")

        parsed["night_login"] = log.get("night_login")

        parsed["session_id"] = log.get("session_id")

        parsed["process"] = log.get("process")

        parsed["geo_location"] = log.get("geo_location")

        parsed["raw"] = log

        return parsed