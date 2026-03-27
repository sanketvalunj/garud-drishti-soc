"""Offline MITRE ATT&CK workbook export and correlation-aware mapping logic."""

from __future__ import annotations

import json
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


class MitreMapper:
    """Offline MITRE mapper for canonical event codes and detected patterns."""

    NS = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }

    SHEET_FILE_MAP = {
        "techniques": "mitre_techniques_sheet.json",
        "tactics": "mitre_tactics_sheet.json",
        "software": "mitre_software_sheet.json",
        "groups": "mitre_groups_sheet.json",
        "campaigns": "mitre_campaigns_sheet.json",
        "mitigations": "mitre_mitigations_sheet.json",
        "Enterprise ATT&CK matrix": "mitre_enterprise_attack_matrix_sheet.json",
        "relationships": "mitre_relationships_sheet.json",
        "datacomponents": "mitre_datacomponents_sheet.json",
        "analytics": "mitre_analytics_sheet.json",
        "detectionstrategies": "mitre_detectionstrategies_sheet.json",
        "citations": "mitre_citations_sheet.json",
    }

    def __init__(
        self,
        # Use POSIX-style paths (forward slashes) so this works on macOS/Linux.
        # Windows also accepts forward slashes, and `Path(...)` normalizes them.
        event_mapping_path: str | Path = "garud_drishti/correlation_engine/config/mitre_event_mapping.json",
        pattern_mapping_path: str | Path = "garud_drishti/correlation_engine/config/mitre_pattern_mapping.json",
        workbook_path: str | Path | None = None,
        output_dir: str | Path = "garud_drishti/data/mitre",
    ) -> None:
        self.event_mapping_path = Path(event_mapping_path)
        self.pattern_mapping_path = Path(pattern_mapping_path)
        self.workbook_path = Path(workbook_path) if workbook_path else None
        self.output_dir = Path(output_dir)

        self.event_mapping = self._load_json(self.event_mapping_path)
        self.pattern_mapping = self._load_json(self.pattern_mapping_path)
        self.knowledge_base_status = self.ensure_local_knowledge_base()

        self.technique_index = self._load_json(self.output_dir / "mitre_techniques_index.json")
        self.tactic_index = self._load_json(self.output_dir / "mitre_tactics_index.json")

    @staticmethod
    def _load_json(path_value: str | Path) -> dict[str, Any]:
        path = Path(path_value)
        if not path.exists():
            raise FileNotFoundError(f"MITRE configuration asset not found: {path}")
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        if not isinstance(payload, dict):
            raise ValueError(f"MITRE configuration asset must be a JSON object: {path}")
        return payload

    @staticmethod
    def _write_json(path_value: str | Path, payload: Any) -> Path:
        path = Path(path_value)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
        return path

    def _local_assets_ready(self) -> bool:
        required_files = [
            "mitre_workbook_manifest.json",
            "mitre_techniques_index.json",
            "mitre_tactics_index.json",
            *self.SHEET_FILE_MAP.values(),
        ]
        return all((self.output_dir / filename).exists() for filename in required_files)

    @classmethod
    def _column_index(cls, cell_reference: str) -> int:
        letters = "".join(character for character in cell_reference if character.isalpha())
        total = 0
        for character in letters:
            total = (total * 26) + ord(character.upper()) - 64
        return max(total - 1, 0)

    @classmethod
    def _load_shared_strings(cls, archive: zipfile.ZipFile) -> list[str]:
        if "xl/sharedStrings.xml" not in archive.namelist():
            return []

        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared_strings: list[str] = []
        for item in root.findall("main:si", cls.NS):
            text = "".join(node.text or "" for node in item.iterfind(".//main:t", cls.NS))
            shared_strings.append(text)
        return shared_strings

    @classmethod
    def _parse_cell_value(cls, cell: ET.Element, shared_strings: list[str]) -> Any:
        cell_type = cell.attrib.get("t", "")
        value_node = cell.find("main:v", cls.NS)

        if cell_type == "inlineStr":
            inline_node = cell.find("main:is/main:t", cls.NS)
            return inline_node.text if inline_node is not None else ""
        if value_node is None:
            return ""

        raw_value = value_node.text or ""
        if cell_type == "s":
            try:
                return shared_strings[int(raw_value)]
            except (ValueError, IndexError):
                return raw_value
        if cell_type == "b":
            return raw_value == "1"

        return raw_value

    @classmethod
    def _sanitize_headers(cls, headers: list[str]) -> list[str]:
        seen: dict[str, int] = defaultdict(int)
        normalized: list[str] = []

        for index, header in enumerate(headers):
            candidate = str(header).strip() or f"column_{index + 1}"
            seen[candidate] += 1
            if seen[candidate] > 1:
                candidate = f"{candidate}_{seen[candidate]}"
            normalized.append(candidate)

        return normalized

    @classmethod
    def _read_sheet_rows(
        cls,
        archive: zipfile.ZipFile,
        target_path: str,
        shared_strings: list[str],
    ) -> tuple[list[str], list[dict[str, Any]]]:
        root = ET.fromstring(archive.read(target_path))
        rows = root.findall(".//main:sheetData/main:row", cls.NS)
        if not rows:
            return [], []

        parsed_rows: list[dict[int, Any]] = []
        max_column = 0

        for row in rows:
            parsed: dict[int, Any] = {}
            for cell in row.findall("main:c", cls.NS):
                cell_reference = cell.attrib.get("r", "A1")
                column_index = cls._column_index(cell_reference)
                parsed[column_index] = cls._parse_cell_value(cell, shared_strings)
                max_column = max(max_column, column_index)
            parsed_rows.append(parsed)

        raw_headers = [str(parsed_rows[0].get(index, "")).strip() for index in range(max_column + 1)]
        headers = cls._sanitize_headers(raw_headers)

        records: list[dict[str, Any]] = []
        for row in parsed_rows[1:]:
            record = {headers[index]: row.get(index, "") for index in range(max_column + 1)}
            if any(str(value).strip() for value in record.values()):
                records.append(record)

        return headers, records

    def ensure_local_knowledge_base(self) -> dict[str, Any]:
        """Load cached MITRE assets or export them from a workbook when required."""

        manifest_path = self.output_dir / "mitre_workbook_manifest.json"
        if self._local_assets_ready():
            with open(manifest_path, encoding="utf-8") as handle:
                manifest = json.load(handle)
            manifest["knowledge_base_mode"] = "local_cache"
            return manifest

        if self.workbook_path is None:
            raise FileNotFoundError(
                "MITRE local JSON assets are missing and no workbook path was provided for rebuild."
            )
        if not self.workbook_path.exists():
            raise FileNotFoundError(f"MITRE workbook not found: {self.workbook_path}")

        workbook_size = self.workbook_path.stat().st_size
        workbook_mtime = self.workbook_path.stat().st_mtime

        self.output_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(self.workbook_path) as archive:
            shared_strings = self._load_shared_strings(archive)

            workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
            rels_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            relationship_map = {
                rel.attrib["Id"]: rel.attrib["Target"]
                for rel in rels_root.findall("pkgrel:Relationship", self.NS)
            }

            exported_sheets: dict[str, Any] = {}
            for sheet in workbook_root.find("main:sheets", self.NS):
                sheet_name = sheet.attrib.get("name", "")
                relationship_id = sheet.attrib.get(f"{{{self.NS['rel']}}}id", "")
                target = relationship_map.get(relationship_id)
                if not target or sheet_name not in self.SHEET_FILE_MAP:
                    continue

                headers, rows = self._read_sheet_rows(
                    archive=archive,
                    target_path=f"xl/{target}",
                    shared_strings=shared_strings,
                )
                output_file = self.output_dir / self.SHEET_FILE_MAP[sheet_name]
                self._write_json(output_file, rows)
                exported_sheets[sheet_name] = {
                    "output_file": str(output_file),
                    "row_count": len(rows),
                    "headers": headers,
                }

        techniques_rows = json.loads((self.output_dir / "mitre_techniques_sheet.json").read_text(encoding="utf-8"))
        tactics_rows = json.loads((self.output_dir / "mitre_tactics_sheet.json").read_text(encoding="utf-8"))

        techniques_index = {}
        for row in techniques_rows:
            technique_id = str(row.get("ID", "")).strip().upper()
            if not technique_id:
                continue
            tactics = [
                item.strip()
                for item in str(row.get("tactics", "")).replace(";", ",").split(",")
                if item.strip()
            ]
            techniques_index[technique_id] = {
                "technique_id": technique_id,
                "stix_id": str(row.get("STIX ID", "")).strip(),
                "name": str(row.get("name", "")).strip(),
                "description": str(row.get("description", "")).strip(),
                "url": str(row.get("url", "")).strip(),
                "domain": str(row.get("domain", "")).strip(),
                "version": str(row.get("version", "")).strip(),
                "tactics": tactics,
                "platforms": [
                    item.strip() for item in str(row.get("platforms", "")).replace(";", ",").split(",") if item.strip()
                ],
            }

        tactics_index = {"by_id": {}, "by_name": {}}
        for row in tactics_rows:
            tactic_id = str(row.get("ID", "")).strip().upper()
            tactic_name = str(row.get("name", "")).strip()
            entry = {
                "tactic_id": tactic_id,
                "name": tactic_name,
                "description": str(row.get("description", "")).strip(),
                "url": str(row.get("url", "")).strip(),
                "domain": str(row.get("domain", "")).strip(),
                "version": str(row.get("version", "")).strip(),
            }
            if tactic_id:
                tactics_index["by_id"][tactic_id] = entry
            if tactic_name:
                tactics_index["by_name"][tactic_name] = entry

        self._write_json(self.output_dir / "mitre_techniques_index.json", techniques_index)
        self._write_json(self.output_dir / "mitre_tactics_index.json", tactics_index)

        manifest = {
            "workbook_path": str(self.workbook_path),
            "workbook_size": workbook_size,
            "workbook_mtime": workbook_mtime,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "knowledge_base_mode": "exported_from_workbook",
            "sheet_exports": exported_sheets,
        }
        self._write_json(manifest_path, manifest)
        return manifest

    def _enrich_mapping(self, technique_id: str, source: str, evidence: str, confidence: str, reason: str) -> dict[str, Any]:
        normalized_id = technique_id.strip().upper()
        metadata = self.technique_index.get(normalized_id, {})
        tactics = metadata.get("tactics", [])
        return {
            "technique_id": normalized_id,
            "technique_name": metadata.get("name", "Unknown Technique"),
            "description": metadata.get("description", ""),
            "url": metadata.get("url", ""),
            "tactics": tactics,
            "primary_tactic": tactics[0] if tactics else "Unknown",
            "confidence": confidence,
            "mapping_source": source,
            "evidence": evidence,
            "reason": reason,
        }

    def map_event_codes(self, event_codes: list[str]) -> list[dict[str, Any]]:
        """Return event-level candidate MITRE mappings for canonical event codes."""

        mapped: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        for event_code in event_codes:
            normalized_code = str(event_code).strip().lower()
            for item in self.event_mapping.get(normalized_code, []):
                technique_id = str(item.get("technique_id", "")).strip().upper()
                if not technique_id:
                    continue
                marker = (normalized_code, technique_id)
                if marker in seen:
                    continue
                mapped.append(
                    self._enrich_mapping(
                        technique_id=technique_id,
                        source="event",
                        evidence=normalized_code,
                        confidence=str(item.get("confidence", "candidate")).strip().lower(),
                        reason=str(item.get("reason", "")).strip(),
                    )
                )
                seen.add(marker)

        return mapped

    def map_pattern_matches(self, pattern_names: list[str]) -> list[dict[str, Any]]:
        """Return stronger pattern-level MITRE mappings for confirmed detections."""

        mapped: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        for pattern_name in pattern_names:
            normalized_pattern = str(pattern_name).strip()
            for item in self.pattern_mapping.get(normalized_pattern, []):
                technique_id = str(item.get("technique_id", "")).strip().upper()
                if not technique_id:
                    continue
                marker = (normalized_pattern, technique_id)
                if marker in seen:
                    continue
                mapped.append(
                    self._enrich_mapping(
                        technique_id=technique_id,
                        source="pattern",
                        evidence=normalized_pattern,
                        confidence=str(item.get("confidence", "confirmed")).strip().lower(),
                        reason=str(item.get("reason", "")).strip(),
                    )
                )
                seen.add(marker)

        return mapped

    @staticmethod
    def combine_mappings(
        event_level: list[dict[str, Any]],
        pattern_level: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Combine event and pattern mappings into a unique technique list."""

        combined: dict[str, dict[str, Any]] = {}
        for item in event_level + pattern_level:
            technique_id = str(item.get("technique_id", "")).strip().upper()
            if not technique_id:
                continue

            entry = combined.setdefault(
                technique_id,
                {
                    "technique_id": technique_id,
                    "technique_name": item.get("technique_name", "Unknown Technique"),
                    "description": item.get("description", ""),
                    "url": item.get("url", ""),
                    "tactics": [],
                    "sources": [],
                    "evidence": [],
                },
            )
            for tactic in item.get("tactics", []):
                if tactic not in entry["tactics"]:
                    entry["tactics"].append(tactic)
            if item.get("mapping_source") and item["mapping_source"] not in entry["sources"]:
                entry["sources"].append(item["mapping_source"])
            if item.get("evidence") and item["evidence"] not in entry["evidence"]:
                entry["evidence"].append(item["evidence"])

        return list(combined.values())

    @staticmethod
    def print_mitre(techniques: list[dict[str, Any]]) -> None:
        """Print a readable MITRE mapping summary."""

        print("\nMITRE ATT&CK Techniques:\n")
        if not techniques:
            print("No MITRE techniques mapped.")
            return
        for tech in techniques:
            tactics = ", ".join(tech.get("tactics", [])) or "Unknown"
            print(f"{tech['technique_id']} - {tech.get('technique_name', 'Unknown Technique')} ({tactics})")

