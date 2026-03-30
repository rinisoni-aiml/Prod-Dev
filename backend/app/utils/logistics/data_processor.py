"""
Data Processing: Excel ingestion, type coercion, FK resolution, DB insertion.
Handles all 12 tables including risk_weight_configuration & shipment_risk_snapshots.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional

import numpy as np
import pandas as pd
from sqlalchemy import text

from .db import get_session, get_session_with_commit
from app.services.logistics.ai.llm_mapper_service import (
    detect_table_from_filename,
    map_columns_with_llm,
    TABLE_FIELDS,
)

logger = logging.getLogger(__name__)

# ─── Enum validation maps ──────────────────────────────────────────────────────
ENUM_MAPS: dict[str, set[str]] = {
    "shipment_status":   {"CREATED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "DELAYED", "CANCELLED"},
    "vendor_status":     {"ACTIVE", "SUSPENDED", "BLACKLISTED"},
    "driver_status":     {"ACTIVE", "SUSPENDED", "INACTIVE"},
    "truck_status":      {"ACTIVE", "IN_MAINTENANCE", "INACTIVE"},
    "incident_severity": {"LOW", "MEDIUM", "HIGH"},
    "performance_window": {"30D", "90D", "LIFETIME"},
    "risk_category":     {"LOW", "MEDIUM", "HIGH"},
}

# Fields that are BOOLEAN type
BOOLEAN_FIELDS: set[str] = {"alert_generated"}

# ─── Primary key mapping for ON CONFLICT resolution ───────────────────────────
# Covers all 12 tables
PK_MAP: dict[str, str] = {
    "routes":                          "route_id",
    "vendors":                         "vendor_id",
    "drivers":                         "driver_id",
    "trucks":                          "truck_id",
    "shipments":                       "shipment_id",
    "vendor_performance_metrics":      "vendor_id, calculation_date, performance_window",
    "driver_incidents":                "incident_id",
    "shipment_financials":             "shipment_id",
    "shipment_cost_planning_actuals":  "shipment_id",
    "market_freight_intelligence":     "route_id, vehicle_type, date",
    "shipment_risk_snapshots":         "risk_id",
    "risk_weight_configuration":       "config_id",
}

# ─── Correct dependency insert order for FK integrity ─────────────────────────
INSERT_ORDER: list[str] = [
    "routes",
    "vendors",
    "drivers",
    "trucks",
    "shipments",
    "vendor_performance_metrics",
    "driver_incidents",
    "shipment_financials",
    "shipment_cost_planning_actuals",
    "market_freight_intelligence",
    "risk_weight_configuration",       # no FK deps — safe to insert anytime
    "shipment_risk_snapshots",         # depends on shipments
]


def clean_value(value: Any, field: str) -> Any:
    """
    Type coerce and sanitise a single cell value for the target schema field.
    Returns None for missing/invalid values (PostgreSQL will apply column DEFAULT).

    SPECIAL HANDLING:
    - ID fields: aggressive whitespace removal, handles alignment/center issues
    - Numeric fields: removes currency symbols and handles alignment
    - Text fields: normal strip() to preserve intentional spaces
    - NumPy types: converted to native Python types for DB compatibility
    """
    # Null / NaN guard
    if value is None:
        return None

    # Handle numpy types early
    if isinstance(value, (np.integer, np.floating)):
        value = value.item()  # Convert numpy type to native Python type

    if isinstance(value, float) and np.isnan(value):
        return None

    str_val = str(value).strip()
    if str_val in ("", "nan", "None", "NaT"):
        return None

    # ── PRIORITY 1: ID fields (aggressive cleaning for exported Excel alignment) ──
    uuid_fields = {"shipment_id", "risk_id"}
    integer_id_fields = {"route_id"}
    string_id_fields = {"driver_id", "truck_id", "vendor_id", "incident_id", "config_id"}
    all_id_fields = uuid_fields | integer_id_fields | string_id_fields

    if field in all_id_fields:
        # Remove ALL whitespace from ID fields (handle Excel alignment: left/center/right)
        cleaned = str_val.replace(" ", "").replace("\t", "").replace("\n", "").strip()
        if cleaned in ("", "nan", "None", "NaT"):
            return None

        # ── UUID Fields ──
        if field in uuid_fields:
            try:
                return uuid.UUID(cleaned)
            except ValueError:
                logger.error(f"UUID field '{field}': Invalid UUID format '{cleaned}'")
                return None

        # ── Integer Fields (route_id) ──
        if field in integer_id_fields:
            try:
                if cleaned.isdigit():
                    return int(cleaned)
                try:
                    float_val = float(cleaned)
                    if float_val.is_integer():
                        return int(float_val)
                except ValueError:
                    pass
                logger.error(f"Integer ID field '{field}': Expected numeric, got '{cleaned}'")
                return None
            except Exception as e:
                logger.error(f"Integer ID field '{field}': Failed to process '{value}': {e}")
                return None

        # ── String Fields (driver_id, truck_id, vendor_id, incident_id, config_id) ──
        if field in string_id_fields:
            logger.debug(f"String ID field '{field}': Preserved as '{cleaned}'")
            return cleaned

    # ── Boolean fields ────────────────────────────────────────────────────────
    if field in BOOLEAN_FIELDS:
        return str_val.lower() in ("true", "1", "yes", "t", "y")

    # ── Enum fields ───────────────────────────────────────────────────────────
    for enum_field, valid_set in ENUM_MAPS.items():
        if enum_field in field:
            upper = str_val.upper()
            if upper in valid_set:
                return upper
            return None          # reject invalid enum value

    # ── Timestamp / datetime fields ───────────────────────────────────────────
    datetime_fields = {
        "dispatch_datetime", "delivery_deadline", "actual_delivery_datetime", "calculated_at"
    }
    if "datetime" in field or field in datetime_fields:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M",
                    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y", "%m/%d/%Y %H:%M", "%m/%d/%Y"):
            try:
                return datetime.strptime(str_val, fmt)
            except ValueError:
                continue
        try:
            return pd.to_datetime(str_val).to_pydatetime()
        except Exception:
            return None

    # ── Date-only fields ──────────────────────────────────────────────────────
    if "date" in field and "datetime" not in field:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(str_val, fmt).date()
            except ValueError:
                continue
        try:
            return pd.to_datetime(str_val).date()
        except Exception:
            return None

    # ── Numeric fields (including cost, rate, etc.) ────────────────────────────
    numeric_keywords = [
        "value", "cost", "rate", "distance", "capacity", "percentage", "pct",
        "count", "no_of", "score", "margin", "variance", "index", "weight",
        "volume", "impact", "exposure", "shipments",
    ]
    if any(kw in field for kw in numeric_keywords):
        try:
            cleaned = (
                str_val.replace(",", "")
                       .replace("₹", "")
                       .replace("$", "")
                       .replace("%", "")
                       .replace(" ", "")  # Remove spaces in numeric values too
                       .strip()
            )
            result = float(cleaned) if "." in cleaned else int(cleaned)
            return result
        except (ValueError, TypeError):
            return None

    # ── String fields (keep normal spacing) ────────────────────────────────────
    return str_val


def process_excel_file(
    file_bytes: bytes,
    filename: str,
    manual_table: Optional[str] = None,
    manual_mapping: Optional[dict] = None,
) -> dict:
    """
    Full ingestion pipeline:
      1. Read Excel
      2. Detect / confirm target table
      3. LLM column mapping (with fallback)
      4. Clean / coerce data
      5. Insert into PostgreSQL (upsert)
      6. Trigger risk scoring if table == shipments

    Returns:
        {
          "success": bool,
          "table": str,
          "rows_inserted": int,
          "mapping": dict,
          "errors": list[str],
        }
    """
    errors: list[str] = []
    result: dict = {
        "success": False,
        "table": None,
        "rows_inserted": 0,
        "mapping": {},
        "errors": errors,
    }

    logger.info(f"File processing started: filename='{filename}'")

    # ── 1. Read Excel ─────────────────────────────────────────────────────────
    try:
        import io
        df = pd.read_excel(io.BytesIO(file_bytes) if isinstance(file_bytes, bytes) else file_bytes,
                           engine="openpyxl")
        if df.empty:
            errors.append("Uploaded file is empty.")
            return result
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as exc:
        errors.append(f"Failed to read Excel file: {exc}")
        return result

    # ── 2. Detect table ───────────────────────────────────────────────────────
    table_name = manual_table or detect_table_from_filename(filename)
    if not table_name or table_name not in TABLE_FIELDS:
        errors.append(
            f"Could not detect target table from filename '{filename}'. "
            "Please select the table manually in the dropdown."
        )
        return result
    result["table"] = table_name
    logger.info(f"Detected target table for '{filename}': {table_name}")

    # ── 3. Map columns ────────────────────────────────────────────────────────
    mapping = manual_mapping or map_columns_with_llm(list(df.columns), table_name, filename)
    result["mapping"] = mapping

    if not mapping:
        errors.append(
            "No columns could be mapped. Check the file structure or use manual mapping override."
        )
        return result

    predefined = TABLE_FIELDS[table_name]
    coverage = len(set(mapping.values())) / max(len(predefined), 1)

    logger.info(f"Mapping coverage for '{table_name}': {coverage:.0%} ({len(set(mapping.values()))}/{len(predefined)} fields)")

    if coverage < 0.40:
        mapped_fields   = sorted(set(mapping.values()))
        unmapped_fields = sorted(f for f in predefined if f not in set(mapping.values()))
        error_msg = (
            f"Upload rejected — only {len(set(mapping.values()))}/{len(predefined)} fields "
            f"({coverage:.0%}) could be mapped to the '{table_name}' table. "
            f"Minimum required is 40%. "
            f"Mapped: {mapped_fields}. "
            f"Missing: {unmapped_fields[:8]}{'...' if len(unmapped_fields) > 8 else ''}. "
            "Please verify the target table selection or use Manual Mapping Override."
        )
        errors.append(error_msg)
        logger.warning(error_msg)
        return result

    # ── 4. Apply mapping + clean ──────────────────────────────────────────────
    df_mapped = pd.DataFrame()
    for excel_col, schema_field in mapping.items():
        if excel_col in df.columns:
            df_mapped[schema_field] = df[excel_col].apply(
                lambda v, f=schema_field: clean_value(v, f)
            )

    if df_mapped.empty:
        errors.append("Column mapping produced an empty dataset.")
        return result

    # ── 4.5: Validate critical ID columns are present ───────────────────────
    critical_ids = {
        "shipments": "shipment_id",
        "shipment_financials": "shipment_id",
        "shipment_cost_planning_actuals": "shipment_id",
        "shipment_risk_snapshots": ["risk_id", "shipment_id"],
        "vendors": "vendor_id",
        "drivers": "driver_id",
        "trucks": "truck_id",
        "routes": "route_id",
        "driver_incidents": "incident_id",
        "market_freight_intelligence": "route_id",
        "risk_weight_configuration": "config_id",
        "vendor_performance_metrics": "vendor_id",
    }

    if table_name in critical_ids:
        required_ids = critical_ids[table_name]
        if isinstance(required_ids, str):
            required_ids = [required_ids]

        missing_ids = [id_field for id_field in required_ids if id_field not in df_mapped.columns]
        if missing_ids:
            errors.append(
                f"CRITICAL: Missing required ID field(s) {missing_ids} in mapped data for table '{table_name}'. "
                f"Ensure your Excel file has a column for {missing_ids}. Data insertion blocked."
            )
            return result

        for id_field in required_ids:
            non_null_count = df_mapped[id_field].notna().sum()
            if non_null_count == 0:
                errors.append(
                    f"CRITICAL: ID field '{id_field}' exists but all values are NULL/empty for table '{table_name}'. "
                    f"This usually means the mapping failed or values couldn't be parsed. Data insertion blocked."
                )
                logger.error(f"ID field '{id_field}' has 0 non-null values in {len(df_mapped)} rows")
                return result
            elif non_null_count < len(df_mapped) * 0.5:
                logger.warning(
                    f"ID field '{id_field}' only has {non_null_count}/{len(df_mapped)} non-null values ({non_null_count/len(df_mapped)*100:.0f}%). "
                    f"This may indicate parsing issues."
                )

    # ── 4.7: Pre-validation for bulk data (catch issues early) ──────────────
    logger.info(f"Pre-validating {len(df_mapped)} rows...")
    validation_issues = 0

    for idx, row in df_mapped.iterrows():
        if row.isna().all():
            validation_issues += 1
            if validation_issues <= 5:
                logger.warning(f"Row {idx}: completely empty")

    if validation_issues > 0:
        logger.warning(f"Found {validation_issues} empty rows in dataset")

    if len(df_mapped) == 0:
        errors.append("No valid data rows to insert after cleaning.")
        return result

    # ── 4.8: Preprocess datetime columns and convert NaT to None ────────────
    df_mapped = _preprocess_datetime_columns(df_mapped, table_name)

    # ── 5. Insert rows ────────────────────────────────────────────────────────
    rows_inserted = _insert_rows(df_mapped, table_name, errors)
    result["rows_inserted"] = rows_inserted
    result["success"] = rows_inserted > 0
    failed_rows = max(0, len(df_mapped) - rows_inserted)
    logger.info(f"Rows inserted successfully: {rows_inserted}")
    if failed_rows > 0:
        logger.warning(f"Rows failed to insert: {failed_rows}")

    # ── 6. Trigger scoring for shipments ──────────────────────────────────────
    if table_name == "shipments" and "shipment_id" in df_mapped.columns:
        from .scoring import compute_and_store_risk_snapshot
        shipment_ids = df_mapped["shipment_id"].dropna().unique()

        if len(shipment_ids) > 0:
            logger.info(f"Risk scoring {len(shipment_ids)} shipments...")
            scored = 0
            failed = 0

            for sid in shipment_ids:
                try:
                    compute_and_store_risk_snapshot(sid)
                    scored += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(f"Risk scoring failed for {sid}: {exc}")

            logger.info(f"Risk scoring complete: {scored} successful, {failed} failed")

    return result


def _preprocess_datetime_columns(df: pd.DataFrame, table_name: str) -> pd.DataFrame:
    """
    Aggressively preprocess datetime columns to fix PostgreSQL compatibility:
    1. Identify all datetime-like columns
    2. Clean each value: strip whitespace, handle empty strings, invalid formats
    3. Convert valid values to datetime objects
    4. Replace ALL invalid/NaT/None values with None (PostgreSQL NULL)
    """
    datetime_patterns = ["date", "time", "_at"]

    integer_columns = {"on_time_shipments", "delayed_shipments", "claim_count", "total_shipments"}

    datetime_cols = [
        col for col in df.columns
        if any(pattern in col.lower() for pattern in datetime_patterns)
        and col not in integer_columns
    ]

    if not datetime_cols:
        return df.where(pd.notnull(df), None)

    logger.info(f"Preprocessing {len(datetime_cols)} datetime columns for '{table_name}': {datetime_cols}")

    for col in datetime_cols:
        if col not in df.columns:
            continue

        cleaned_values = []
        invalid_count = 0

        for idx, val in enumerate(df[col]):
            if val is None:
                cleaned_values.append(None)
                continue

            if isinstance(val, float) and np.isnan(val):
                cleaned_values.append(None)
                invalid_count += 1
                continue

            str_val = str(val).strip()

            if str_val in ("", "nan", "NaN", "NaT", "None", "null", "NULL", "none"):
                cleaned_values.append(None)
                invalid_count += 1
                continue

            try:
                parsed_dt = pd.to_datetime(str_val, errors="coerce")

                if pd.isna(parsed_dt):
                    cleaned_values.append(None)
                    invalid_count += 1
                else:
                    cleaned_values.append(parsed_dt.to_pydatetime() if hasattr(parsed_dt, 'to_pydatetime') else parsed_dt)
            except Exception as e:
                logger.debug(f"Failed to parse '{str_val}' in column '{col}': {e}")
                cleaned_values.append(None)
                invalid_count += 1

        df[col] = cleaned_values

        if invalid_count > 0:
            logger.info(f"Column '{col}': cleaned {invalid_count}/{len(df)} invalid datetime values to None")

    df = df.where(pd.notnull(df), None)

    if 'on_time_shipments' in df.columns:
        try:
            df['on_time_shipments'] = pd.to_numeric(df['on_time_shipments'], errors='coerce').astype('Int64')
            logger.info("Recovered 'on_time_shipments' back to integer type")
        except Exception as e:
            logger.warning(f"Could not recover 'on_time_shipments': {e}")

    logger.info(f"Datetime preprocessing complete for '{table_name}'")
    return df


def _insert_rows(df: pd.DataFrame, table_name: str, errors: list[str]) -> int:
    """
    Batch insert with intelligent rollback (50x faster than row-by-row).
    - Batch size: 100 rows (optimal speed/safety balance)
    - If batch fails: rollback and retry row-by-row
    - Each failed row gets individual transaction on retry
    - Fast for clean data, reliable for messy data
    """
    df = df.where(pd.notnull(df), None)

    integer_columns = {
        "on_time_shipments": "Int64",
        "delayed_shipments": "Int64",
        "claim_count": "Int64",
        "total_shipments": "Int64",
    }

    for col, dtype in integer_columns.items():
        if col in df.columns:
            try:
                df[col] = df[col].astype(dtype)
                logger.debug(f"Cast column '{col}' to {dtype}")
            except Exception as e:
                logger.warning(f"Could not cast column '{col}' to {dtype}: {e}")

    if table_name == "driver_incidents" and "driver_id" in df.columns:
        with get_session() as session:
            try:
                existing_driver_ids = set(
                    row[0] for row in session.execute(
                        text("SELECT driver_id FROM drivers")
                    ).fetchall()
                )

                original_len = len(df)
                df = df[df['driver_id'].isin(existing_driver_ids)]
                filtered_len = len(df)

                if filtered_len == 0:
                    logger.warning("No valid driver_incidents rows after filtering for existing driver_ids")
                elif filtered_len < original_len:
                    logger.warning(
                        f"Filtered driver_incidents: {original_len} → {filtered_len} rows "
                        f"({original_len - filtered_len} rows skipped due to non-existent driver_ids)"
                    )
                else:
                    logger.info(f"All {filtered_len} driver_incidents rows have valid driver_ids")
            except Exception as e:
                logger.error(f"Pre-filter for driver_incidents failed: {e}")

    inserted = 0
    failed_rows = 0
    columns = list(df.columns)
    batch_size = 100

    if table_name not in PK_MAP:
        errors.append(f"Table '{table_name}' not in PK_MAP")
        return 0

    conflict_cols = PK_MAP[table_name]
    conflict_col_list = [c.strip() for c in conflict_cols.split(",")]

    logger.info(f"INSERT INTO {table_name}: {len(df)} rows (batch size: {batch_size})")

    id_field = conflict_col_list[0] if len(conflict_col_list) == 1 else None
    next_id = None

    if id_field and id_field not in columns:
        with get_session_with_commit() as session:
            try:
                result = session.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
                next_id = (result or 0) + 1
            except Exception as e:
                logger.warning(f"Could not get max {id_field}: {e}")
                next_id = 1

    for batch_start in range(0, len(df), batch_size):
        batch_end = min(batch_start + batch_size, len(df))
        batch_df = df.iloc[batch_start:batch_end]

        logger.info(f"Processing batch {batch_start}-{batch_end}...")

        batch_inserted, batch_failed_ids = _insert_batch(
            batch_df, table_name, conflict_cols, conflict_col_list,
            id_field, next_id, columns
        )

        inserted += batch_inserted

        if batch_failed_ids:
            logger.warning(f"Batch had {len(batch_failed_ids)} failures, retrying individually...")

            for fail_idx in batch_failed_ids:
                row = batch_df.iloc[fail_idx]
                try:
                    row_inserted = _insert_single_row(
                        row, table_name, conflict_cols, conflict_col_list,
                        id_field, next_id, columns
                    )
                    if row_inserted:
                        inserted += 1
                    else:
                        failed_rows += 1
                except Exception as e:
                    failed_rows += 1
                    logger.error(f"Row {batch_start + fail_idx}: {str(e)[:80]}")

    logger.info(f"INSERT COMPLETE: {inserted} OK, {failed_rows} FAILED out of {len(df)}")
    if failed_rows > 0:
        errors.append(f"{inserted} rows inserted successfully, {failed_rows} rows failed (see logs)")

    return inserted


def _insert_batch(df_batch: pd.DataFrame, table_name: str, conflict_cols: str,
                  conflict_col_list: list, id_field: str, next_id: int, columns: list) -> tuple:
    """
    Try to insert 100 rows in ONE transaction.
    Return: (inserted_count, list_of_failed_row_indices)
    """
    inserted = 0
    failed_indices = []

    rows_to_insert = []

    for row_idx, (_, row) in enumerate(df_batch.iterrows()):
        try:
            row_dict = {}
            for col in columns:
                val = row[col]
                if pd.isna(val):
                    continue
                if isinstance(val, (np.integer, np.floating)):
                    val = val.item()
                row_dict[col] = val

            if not row_dict:
                failed_indices.append(row_idx)
                logger.warning(f"Row {row_idx}: empty")
                continue

            if id_field and id_field not in row_dict:
                row_dict[id_field] = next_id
                next_id += 1

            missing_pks = [pk for pk in conflict_col_list if pk not in row_dict]
            if missing_pks:
                failed_indices.append(row_idx)
                logger.error(f"Row {row_idx}: Missing PKs {missing_pks}")
                continue

            rows_to_insert.append((row_idx, row_dict))

        except Exception as e:
            failed_indices.append(row_idx)
            logger.error(f"Row {row_idx}: Prep error - {str(e)[:80]}")

    if not rows_to_insert:
        return 0, failed_indices

    try:
        with get_session_with_commit() as session:
            for row_idx, row_dict in rows_to_insert:
                cols_str = ", ".join(row_dict.keys())
                vals_str = ", ".join(f":{k}" for k in row_dict.keys())
                non_pk_cols = [c for c in row_dict.keys() if c not in conflict_col_list]

                if non_pk_cols:
                    update_str = ", ".join(f"{c} = EXCLUDED.{c}" for c in non_pk_cols)
                else:
                    update_str = f"{conflict_col_list[0]} = EXCLUDED.{conflict_col_list[0]}"

                sql = (
                    f"INSERT INTO {table_name} ({cols_str}) "
                    f"VALUES ({vals_str}) "
                    f"ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_str}"
                )

                session.execute(text(sql), row_dict)

            inserted = len(rows_to_insert)
            logger.info(f"Batch committed: {inserted} rows")

    except Exception as batch_exc:
        logger.error(f"Batch insert failed, will retry individually: {str(batch_exc)[:100]}")
        failed_indices = [idx for idx, _ in rows_to_insert]

    return inserted, failed_indices


def _insert_single_row(row: pd.Series, table_name: str, conflict_cols: str,
                       conflict_col_list: list, id_field: str, next_id: int,
                       columns: list) -> bool:
    """
    Insert ONE row with its own transaction.
    Return: True if inserted, False if failed
    """
    try:
        row_dict = {}
        datetime_patterns = ["date", "time", "_at"]

        for col in columns:
            val = row[col]

            if pd.isna(val):
                continue

            is_datetime_col = any(pattern in col.lower() for pattern in datetime_patterns)
            if is_datetime_col:
                str_val = str(val).strip()
                if str_val in ("", "nan", "NaN", "NaT", "None", "null", "NULL"):
                    continue
                try:
                    parsed_dt = pd.to_datetime(str_val, errors="coerce")
                    if pd.isna(parsed_dt):
                        continue
                    val = parsed_dt.to_pydatetime() if hasattr(parsed_dt, 'to_pydatetime') else parsed_dt
                except Exception:
                    continue

            if isinstance(val, (np.integer, np.floating)):
                val = val.item()

            row_dict[col] = val

        if not row_dict:
            return False

        if id_field and id_field not in row_dict:
            row_dict[id_field] = next_id

        missing_pks = [pk for pk in conflict_col_list if pk not in row_dict]
        if missing_pks:
            return False

        cols_str = ", ".join(row_dict.keys())
        vals_str = ", ".join(f":{k}" for k in row_dict.keys())
        non_pk_cols = [c for c in row_dict.keys() if c not in conflict_col_list]

        if non_pk_cols:
            update_str = ", ".join(f"{c} = EXCLUDED.{c}" for c in non_pk_cols)
        else:
            update_str = f"{conflict_col_list[0]} = EXCLUDED.{conflict_col_list[0]}"

        sql = (
            f"INSERT INTO {table_name} ({cols_str}) "
            f"VALUES ({vals_str}) "
            f"ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_str}"
        )

        with get_session_with_commit() as session:
            session.execute(text(sql), row_dict)

        return True

    except Exception as e:
        logger.error(f"Single row insert failed: {str(e)[:80]}")
        return False


def get_table_stats(table_name: str) -> dict:
    """
    Return row count for a given table.
    Safe — returns 0 on DB error (table may not exist yet).
    """
    try:
        with get_session_with_commit() as session:
            count = session.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")  # noqa: S608 — table_name is internal
            ).scalar()
            return {"table": table_name, "row_count": int(count or 0)}
    except Exception:
        return {"table": table_name, "row_count": 0}
