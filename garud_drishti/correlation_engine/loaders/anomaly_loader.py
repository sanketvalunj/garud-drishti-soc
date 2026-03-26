"""Load Shreya's anomaly results and enrich canonical GARUD-DRISHTI events."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from garud_drishti.correlation_engine.preprocessing.event_normalizer import load_catalog


class AnomalyLoader:
    """Read anomaly events and merge them onto normalized logs without filtering."""

    def __init__(
        self,
        file_path: str | Path = r"garud_drishti\data\processed\anomaly_events.json",
        catalog_path: str | Path = r"garud_drishti\correlation_engine\config\normalized_event_catalog.json",
        tolerance_seconds: int = 120,
        anomaly_threshold: float = 0.5,
    ) -> None:
        self.file_path = Path(file_path)
        self.tolerance = pd.Timedelta(seconds=int(tolerance_seconds))
        self.anomaly_threshold = float(anomaly_threshold)
        self.catalog = load_catalog(catalog_path)

        if not self.file_path.exists():
            raise FileNotFoundError(f"Anomaly results file not found: {self.file_path}")

        with open(self.file_path, encoding="utf-8") as handle:
            payload = json.load(handle)

        if not isinstance(payload, list):
            raise ValueError("Anomaly file must contain a JSON array of events.")

        self.df = pd.DataFrame(payload)
        self._normalize_schema()

    @staticmethod
    def _clean_text(series: pd.Series, default: str = "") -> pd.Series:
        cleaned = series.fillna(default).astype(str).str.strip()
        return cleaned.replace({"nan": default, "None": default, "null": default})

    def _normalize_event_code(self, raw_event_type: str) -> str:
        mapping = self.catalog.get(raw_event_type.lower(), self.catalog.get("__default__", {}))
        return str(mapping.get("event_code", "unknown.event")).lower().strip()

    def _normalize_schema(self) -> None:
        if self.df.empty:
            self.df = pd.DataFrame(
                columns=[
                    "entity_id",
                    "timestamp",
                    "session_id",
                    "src_ip",
                    "event_type",
                    "event_code",
                    "event_category",
                    "severity",
                    "risk_score",
                    "anomaly_score",
                    "is_anomaly",
                    "analysis",
                    "flags",
                    "context",
                ]
            )
            return

        required_columns = {"entity_id", "timestamp", "session_id", "src_ip", "event_type", "risk_score"}
        missing_columns = required_columns - set(self.df.columns)
        if missing_columns:
            raise ValueError(f"Missing required columns in anomaly file: {sorted(missing_columns)}")

        self.df["timestamp"] = pd.to_datetime(self.df["timestamp"], errors="coerce")
        self.df = self.df.dropna(subset=["timestamp"]).copy()

        text_columns = ["entity_id", "session_id", "src_ip", "event_type", "event_category", "severity", "analysis"]
        for column in text_columns:
            if column not in self.df.columns:
                self.df[column] = ""
            self.df[column] = self._clean_text(self.df[column], "")

        self.df["event_type"] = self.df["event_type"].str.lower()
        self.df["event_code"] = self.df["event_type"].map(self._normalize_event_code)
        self.df["event_category"] = self.df["event_category"].str.lower()
        self.df["severity"] = self.df["severity"].str.lower()
        self.df["risk_score"] = pd.to_numeric(self.df["risk_score"], errors="coerce").fillna(0.0)
        self.df["anomaly_score"] = self.df["risk_score"]
        self.df["is_anomaly"] = (self.df["anomaly_score"] >= self.anomaly_threshold).astype(int)
        if "flags" not in self.df.columns:
            self.df["flags"] = [{} for _ in range(len(self.df))]
        else:
            self.df["flags"] = self.df["flags"].apply(lambda value: value if isinstance(value, dict) else {})

        if "context" not in self.df.columns:
            self.df["context"] = [{} for _ in range(len(self.df))]
        else:
            self.df["context"] = self.df["context"].apply(lambda value: value if isinstance(value, dict) else {})

        self.df = self.df.sort_values("timestamp").reset_index(drop=True)

    def get_all_records(self) -> pd.DataFrame:
        """Return the full anomaly dataframe."""

        return self.df.copy()

    def _prepare_left_frame(self, logs_df: pd.DataFrame) -> pd.DataFrame:
        enriched = logs_df.copy().reset_index(drop=True)
        if "timestamp" not in enriched.columns:
            raise ValueError("Normalized logs must include a timestamp column before anomaly enrichment.")

        enriched["_row_id"] = enriched.index
        enriched["timestamp"] = pd.to_datetime(enriched["timestamp"], errors="coerce")
        enriched = enriched.dropna(subset=["timestamp"]).copy()

        for column, default in {
            "entity_id": "",
            "session_id": "",
            "src_ip": "",
            "raw_event_type": "unknown",
            "event_code": "unknown.event",
        }.items():
            if column not in enriched.columns:
                enriched[column] = default
            enriched[column] = self._clean_text(enriched[column], default)

        enriched["raw_event_type"] = enriched["raw_event_type"].str.lower()
        enriched["event_code"] = enriched["event_code"].str.lower()
        return enriched

    def _match_exact(self, left: pd.DataFrame) -> pd.DataFrame:
        right = self.df[
            [
                "entity_id",
                "session_id",
                "src_ip",
                "event_code",
                "timestamp",
                "risk_score",
                "anomaly_score",
                "is_anomaly",
                "analysis",
                "severity",
                "event_category",
                "flags",
                "context",
            ]
        ].copy()
        right = right.rename(
            columns={
                "risk_score": "matched_risk_score",
                "anomaly_score": "matched_anomaly_score",
                "is_anomaly": "matched_is_anomaly",
                "analysis": "matched_analysis",
                "severity": "matched_severity",
                "event_category": "matched_event_category",
                "flags": "matched_flags",
                "context": "matched_context",
            }
        )
        right = right.sort_values("matched_risk_score", ascending=False).drop_duplicates(
            subset=["entity_id", "session_id", "src_ip", "event_code", "timestamp"],
            keep="first",
        )

        merged = left.merge(
            right,
            on=["entity_id", "session_id", "src_ip", "event_code", "timestamp"],
            how="left",
        )
        merged["anomaly_match_strategy"] = merged["matched_anomaly_score"].notna().map({True: "exact", False: ""})
        return merged

    def _match_asof(self, left: pd.DataFrame, by_columns: list[str], strategy: str) -> pd.DataFrame:
        left_sorted = left.sort_values("timestamp").copy()
        right_sorted = self.df[
            by_columns
            + [
                "timestamp",
                "risk_score",
                "anomaly_score",
                "is_anomaly",
                "analysis",
                "severity",
                "event_category",
                "flags",
                "context",
            ]
        ].sort_values("timestamp")
        right_sorted = right_sorted.rename(
            columns={
                "risk_score": "matched_risk_score",
                "anomaly_score": "matched_anomaly_score",
                "is_anomaly": "matched_is_anomaly",
                "analysis": "matched_analysis",
                "severity": "matched_severity",
                "event_category": "matched_event_category",
                "flags": "matched_flags",
                "context": "matched_context",
            }
        )

        matched = pd.merge_asof(
            left_sorted,
            right_sorted,
            on="timestamp",
            by=by_columns,
            direction="nearest",
            tolerance=self.tolerance,
        )
        matched["anomaly_match_strategy"] = matched["matched_anomaly_score"].notna().map({True: strategy, False: ""})
        return matched

    def enrich_logs(self, logs_df: pd.DataFrame) -> pd.DataFrame:
        """
        Merge anomaly data onto normalized logs without dropping unmatched events.

        Matching strategy:
        1. Exact event match on entity_id + session_id + src_ip + event_code + timestamp
        2. Nearest timestamp within tolerance on entity_id + session_id + event_code
        3. Nearest timestamp within tolerance on entity_id + event_code
        4. Nearest timestamp within tolerance on src_ip + event_code
        """

        if logs_df.empty:
            return logs_df.copy()

        enriched = self._prepare_left_frame(logs_df)
        exact = self._match_exact(enriched)
        result = exact.copy()

        fallback_stages = [
            (["entity_id", "session_id", "event_code"], "entity_session_event_nearest"),
            (["entity_id", "event_code"], "entity_event_nearest"),
            (["src_ip", "event_code"], "ip_event_nearest"),
        ]

        for by_columns, strategy in fallback_stages:
            unmatched_ids = result.loc[result["anomaly_match_strategy"] == "", "_row_id"]
            if unmatched_ids.empty:
                break

            left_unmatched = enriched[enriched["_row_id"].isin(unmatched_ids)].copy()
            fallback = self._match_asof(left_unmatched, by_columns=by_columns, strategy=strategy)
            fallback = fallback.set_index("_row_id")

            for column in [
                "matched_risk_score",
                "matched_anomaly_score",
                "matched_is_anomaly",
                "matched_analysis",
                "matched_severity",
                "matched_event_category",
                "matched_flags",
                "matched_context",
                "anomaly_match_strategy",
            ]:
                if column not in fallback.columns:
                    continue
                result.loc[result["_row_id"].isin(fallback.index), column] = result.loc[
                    result["_row_id"].isin(fallback.index), column
                ].where(
                    result.loc[result["_row_id"].isin(fallback.index), "anomaly_match_strategy"] != "",
                    fallback.loc[result.loc[result["_row_id"].isin(fallback.index), "_row_id"], column].to_numpy(),
                )

        base_anomaly_score = pd.to_numeric(result.get("anomaly_score", 0.0), errors="coerce").fillna(0.0)
        result["anomaly_score"] = pd.to_numeric(result.get("matched_anomaly_score", base_anomaly_score), errors="coerce").fillna(
            base_anomaly_score
        )
        result["anomaly_risk_score"] = pd.to_numeric(
            result.get("matched_risk_score", result["anomaly_score"]),
            errors="coerce",
        ).fillna(result["anomaly_score"])
        result["is_anomaly"] = pd.to_numeric(result.get("matched_is_anomaly", 0), errors="coerce").fillna(0).astype(int)
        result["analysis"] = result.get("matched_analysis", "").fillna("").astype(str)
        result["anomaly_severity"] = result.get("matched_severity", "").fillna("").astype(str)
        result["anomaly_event_category"] = result.get("matched_event_category", "").fillna("").astype(str)
        result["confidence"] = pd.to_numeric(result.get("confidence", 0.0), errors="coerce").fillna(0.0)
        result["confidence"] = result["confidence"].mask(
            (result["confidence"] <= 0.0) & (result["anomaly_score"] > 0.0),
            result["anomaly_score"],
        )
        if "matched_flags" not in result.columns:
            result["matched_flags"] = [{} for _ in range(len(result))]
        if "matched_context" not in result.columns:
            result["matched_context"] = [{} for _ in range(len(result))]
        result["anomaly_flags"] = result["matched_flags"].apply(lambda value: value if isinstance(value, dict) else {})
        result["anomaly_context"] = result["matched_context"].apply(lambda value: value if isinstance(value, dict) else {})
        result["anomaly_match_strategy"] = result["anomaly_match_strategy"].replace({"": "unmatched"})

        drop_columns = [
            "_row_id",
            "matched_risk_score",
            "matched_anomaly_score",
            "matched_is_anomaly",
            "matched_analysis",
            "matched_severity",
            "matched_event_category",
            "matched_flags",
            "matched_context",
            "risk_score",
        ]
        for column in drop_columns:
            if column in result.columns:
                result = result.drop(columns=column)

        return result.sort_values(["timestamp", "event_id"]).reset_index(drop=True)

    def summary(self) -> dict[str, int]:
        """Print and return anomaly dataset statistics."""

        total_records = len(self.df)
        anomalous_records = int((self.df["is_anomaly"] == 1).sum()) if not self.df.empty else 0
        unique_entities = int(self.df["entity_id"].nunique()) if "entity_id" in self.df.columns else 0

        print(f"Total anomaly records loaded: {total_records}")
        print(f"Anomalous records          : {anomalous_records}")
        print(f"Unique anomalous entities  : {unique_entities}")

        return {
            "total_records": total_records,
            "anomalous_records": anomalous_records,
            "unique_entities": unique_entities,
        }
