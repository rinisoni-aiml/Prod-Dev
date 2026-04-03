"""
Excel processor for logistics data upload.
Reads Excel/CSV files, detects the target table from the filename,
maps columns using simple fuzzy matching, and upserts into Supabase lg_* tables.
No LLM or SQLAlchemy dependency — uses pandas + Supabase client only.
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from io import BytesIO
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ─── Table Detection ──────────────────────────────────────────────────────────

TABLE_KEYWORDS: dict[str, list[str]] = {
    "routes": ["route"],
    "vendors": ["vendor", "suppliers"],
    "drivers": ["driver"],
    "trucks": ["truck", "vehicle", "fleet"],
    "shipments": ["shipment", "shipments"],
    "vendor_performance_metrics": ["vendor_performance", "performance_metric"],
    "driver_incidents": ["incident", "driver_incident"],
    "shipment_financials": ["shipment_financial", "financial"],
    "shipment_cost_planning_actuals": ["cost_planning", "cost_actual", "planning_actual"],
    "market_freight_intelligence": ["market_freight", "freight_intelligence", "market_intel"],
    "shipment_risk_snapshots": ["risk_snapshot", "risk_score"],
    "risk_weight_configuration": ["risk_weight", "weight_config"],
}


def detect_table_from_filename(filename: str) -> Optional[str]:
    """Return the matching lg_* table name from the filename, or None."""
    name = filename.lower().replace(" ", "_").replace("-", "_")
    # Remove extension
    name = re.sub(r"\.(xlsx?|csv)$", "", name)
    for table, keywords in TABLE_KEYWORDS.items():
        for kw in keywords:
            if kw.replace("_", "") in name.replace("_", ""):
                return table
    return None


# ─── Column Mapping ───────────────────────────────────────────────────────────

# Expected columns for each table (target_col → list of source aliases)
COLUMN_ALIASES: dict[str, dict[str, list[str]]] = {
    "routes": {
        "route_id": ["route_id", "routeid", "id", "route id"],
        "origin_city": ["origin_city", "origin city", "from_city", "source_city", "from city"],
        "origin_state": ["origin_state", "origin state", "from_state", "source_state"],
        "destination_city": ["destination_city", "dest_city", "to_city", "destination city", "to city"],
        "destination_state": ["destination_state", "dest_state", "to_state"],
        "distance_km": ["distance_km", "distance", "dist_km", "km"],
    },
    "vendors": {
        "vendor_id": ["vendor_id", "vendorid", "id", "vendor id"],
        "vendor_name": ["vendor_name", "name", "vendor name", "company_name"],
        "vendor_status": ["vendor_status", "status"],
        "contract_start_date": ["contract_start_date", "start_date", "contract start"],
        "contract_end_date": ["contract_end_date", "end_date", "contract end", "expiry_date"],
    },
    "drivers": {
        "driver_id": ["driver_id", "driverid", "id", "driver id"],
        "driver_name": ["driver_name", "name", "driver name"],
        "license_number": ["license_number", "license_no", "licence_number", "dl_number"],
        "license_expiry_date": ["license_expiry_date", "license_expiry", "dl_expiry", "expiry_date"],
        "driver_status": ["driver_status", "status"],
    },
    "trucks": {
        "truck_id": ["truck_id", "truckid", "id", "truck id"],
        "truck_number": ["truck_number", "truck_no", "vehicle_number", "reg_number", "registration"],
        "insurance_expiry_date": ["insurance_expiry_date", "insurance_expiry", "insurance expiry"],
        "fitness_expiry_date": ["fitness_expiry_date", "fitness_expiry", "fitness expiry"],
        "registration_expiry_date": ["registration_expiry_date", "registration_expiry", "reg_expiry"],
        "vehicle_type": ["vehicle_type", "type", "truck_type"],
        "truck_capacity_weight": ["truck_capacity_weight", "capacity_weight", "weight_capacity", "capacity_kg"],
        "truck_capacity_volume": ["truck_capacity_volume", "capacity_volume", "volume_capacity"],
        "truck_status": ["truck_status", "status"],
    },
    "shipments": {
        "shipment_id": ["shipment_id", "id", "shipmentid", "shipment id"],
        "route_id": ["route_id", "routeid", "route id"],
        "origin_city": ["origin_city", "from_city", "origin city", "source city"],
        "origin_state": ["origin_state", "from_state", "origin state"],
        "origin_pincode": ["origin_pincode", "origin_pin", "from_pincode"],
        "destination_city": ["destination_city", "to_city", "dest_city", "destination city"],
        "destination_state": ["destination_state", "to_state", "dest_state"],
        "destination_pincode": ["destination_pincode", "dest_pin", "to_pincode"],
        "shipment_value": ["shipment_value", "value", "cargo_value", "shipment value"],
        "currency_code": ["currency_code", "currency"],
        "dispatch_datetime": ["dispatch_datetime", "dispatch_date", "dispatch date", "dispatched_at"],
        "delivery_deadline": ["delivery_deadline", "deadline", "expected_delivery", "delivery date"],
        "actual_delivery_datetime": ["actual_delivery_datetime", "actual_delivery", "delivered_at"],
        "vendor_id": ["vendor_id", "carrier_id", "carrier id"],
        "vendor_name": ["vendor_name", "carrier_name", "carrier name"],
        "driver_id": ["driver_id", "driver id"],
        "truck_id": ["truck_id", "vehicle_id", "truck id"],
        "shipment_status": ["shipment_status", "status"],
    },
    "vendor_performance_metrics": {
        "vendor_id": ["vendor_id", "id", "vendor id"],
        "calculation_date": ["calculation_date", "date", "calc_date"],
        "total_shipments": ["total_shipments", "total_deliveries", "total shipments"],
        "on_time_shipments": ["on_time_shipments", "on_time", "ontime_shipments"],
        "delayed_shipments": ["delayed_shipments", "delayed", "delay_count"],
        "claim_count": ["claim_count", "claims", "dispute_count"],
        "on_time_percentage": ["on_time_percentage", "on_time_pct", "otp", "on time %"],
        "delay_rate_percentage": ["delay_rate_percentage", "delay_rate", "delay %"],
        "claim_ratio_percentage": ["claim_ratio_percentage", "claim_ratio", "claim %"],
        "performance_window": ["performance_window", "window", "period"],
    },
    "driver_incidents": {
        "incident_id": ["incident_id", "id", "incident id"],
        "driver_id": ["driver_id", "driver id"],
        "incident_type": ["incident_type", "type", "incident type"],
        "incident_severity": ["incident_severity", "severity"],
        "incident_date": ["incident_date", "date", "incident date"],
        "shipment_id": ["shipment_id", "shipment id"],
    },
    "shipment_financials": {
        "shipment_id": ["shipment_id", "id", "shipment id"],
        "declared_value": ["declared_value", "declared value", "cargo_value"],
        "insurance_coverage_value": ["insurance_coverage_value", "insurance_value", "insurance coverage"],
        "expected_margin": ["expected_margin", "margin", "profit_margin"],
    },
    "shipment_cost_planning_actuals": {
        "shipment_id": ["shipment_id", "id", "shipment id"],
        "planned_transport_cost": ["planned_transport_cost", "planned_cost", "planned cost"],
        "planned_rate_per_km": ["planned_rate_per_km", "planned_rate", "plan_rate_km"],
        "planned_no_of_trucks": ["planned_no_of_trucks", "planned_trucks", "plan_trucks"],
        "actual_transport_cost": ["actual_transport_cost", "actual_cost", "actual cost"],
        "actual_rate_per_km": ["actual_rate_per_km", "actual_rate", "act_rate_km"],
        "actual_no_of_trucks": ["actual_no_of_trucks", "actual_trucks", "act_trucks"],
        "distance_km": ["distance_km", "distance", "km"],
        "detention_cost": ["detention_cost", "detention"],
        "penalty_cost": ["penalty_cost", "penalty"],
        "fuel_surcharge_cost": ["fuel_surcharge_cost", "fuel_surcharge", "fuel"],
        "toll_cost": ["toll_cost", "toll"],
        "total_actual_cost": ["total_actual_cost", "total_cost", "total cost"],
        "cost_variance": ["cost_variance", "variance"],
        "cost_variance_percentage": ["cost_variance_percentage", "variance_pct", "variance %"],
    },
    "market_freight_intelligence": {
        "route_id": ["route_id", "route id"],
        "vehicle_type": ["vehicle_type", "type"],
        "date": ["date"],
        "average_market_rate_per_km": ["average_market_rate_per_km", "avg_rate", "market_rate"],
        "high_market_rate_per_km": ["high_market_rate_per_km", "high_rate"],
        "low_market_rate_per_km": ["low_market_rate_per_km", "low_rate"],
        "volatility_index": ["volatility_index", "volatility"],
        "capacity_shortage_index": ["capacity_shortage_index", "capacity_shortage", "shortage_index"],
    },
    "shipment_risk_snapshots": {
        "shipment_id": ["shipment_id", "id", "shipment id"],
        "compliance_risk_score": ["compliance_risk_score", "compliance_score", "compliance risk"],
        "vendor_risk_score": ["vendor_risk_score", "vendor_score", "vendor risk"],
        "operational_risk_score": ["operational_risk_score", "operational_score", "operational risk"],
        "financial_exposure_score": ["financial_exposure_score", "financial_score", "financial risk"],
        "overall_risk_score": ["overall_risk_score", "overall_score", "risk_score", "overall risk"],
        "risk_category": ["risk_category", "risk_level", "category"],
        "alert_generated": ["alert_generated", "alert"],
        "alert_severity": ["alert_severity", "severity"],
        "alert_type": ["alert_type", "type"],
        "explanation": ["explanation", "reason", "description"],
        "recommendation": ["recommendation", "action", "mitigation"],
        "category": ["category"],
    },
    "risk_weight_configuration": {
        "config_id": ["config_id", "id"],
        "compliance_weight": ["compliance_weight", "compliance"],
        "vendor_weight": ["vendor_weight", "vendor"],
        "operational_weight": ["operational_weight", "operational"],
        "financial_weight": ["financial_weight", "financial"],
        "effective_from": ["effective_from", "from_date", "start_date"],
        "effective_to": ["effective_to", "to_date", "end_date"],
    },
}


def _normalise(s: str) -> str:
    """Lowercase, strip, replace spaces/hyphens with underscores."""
    return re.sub(r"[\s\-]+", "_", str(s).strip().lower())


def map_columns(df_columns: list[str], table: str) -> dict[str, str]:
    """
    Return {source_col: target_col} mapping for the given DataFrame columns.
    Only includes columns that have a match.
    """
    aliases = COLUMN_ALIASES.get(table, {})
    norm_source = {_normalise(c): c for c in df_columns}
    result: dict[str, str] = {}

    for target_col, alias_list in aliases.items():
        for alias in alias_list:
            norm_alias = _normalise(alias)
            if norm_alias in norm_source:
                result[norm_source[norm_alias]] = target_col
                break

    return result


# ─── Value Cleaning ───────────────────────────────────────────────────────────

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d %b %Y", "%Y/%m/%d"]

NUMERIC_FIELDS = {
    "distance_km", "shipment_value", "truck_capacity_weight", "truck_capacity_volume",
    "declared_value", "insurance_coverage_value", "expected_margin",
    "planned_transport_cost", "planned_rate_per_km", "actual_transport_cost",
    "actual_rate_per_km", "total_actual_cost", "cost_variance", "cost_variance_percentage",
    "detention_cost", "penalty_cost", "fuel_surcharge_cost", "toll_cost",
    "average_market_rate_per_km", "high_market_rate_per_km", "low_market_rate_per_km",
    "volatility_index", "capacity_shortage_index",
    "compliance_risk_score", "vendor_risk_score", "operational_risk_score",
    "financial_exposure_score", "overall_risk_score",
    "on_time_percentage", "delay_rate_percentage", "claim_ratio_percentage",
    "compliance_weight", "vendor_weight", "operational_weight", "financial_weight",
    "total_shipments", "on_time_shipments", "delayed_shipments", "claim_count",
    "planned_no_of_trucks", "actual_no_of_trucks",
}

DATE_FIELDS = {
    "contract_start_date", "contract_end_date", "license_expiry_date",
    "insurance_expiry_date", "fitness_expiry_date", "registration_expiry_date",
    "incident_date", "effective_from", "effective_to", "calculation_date", "date",
}

DATETIME_FIELDS = {
    "dispatch_datetime", "delivery_deadline", "actual_delivery_datetime",
    "calculated_at", "resolved_at",
}

BOOLEAN_FIELDS = {"alert_generated"}

INT_FIELDS = {
    "route_id", "total_shipments", "on_time_shipments", "delayed_shipments",
    "claim_count", "planned_no_of_trucks", "actual_no_of_trucks",
}

TEXT_UPPER_FIELDS = {
    "shipment_status", "vendor_status", "driver_status", "truck_status",
    "incident_severity", "risk_category", "performance_window", "alert_severity",
}


def _clean_value(value: Any, field: str) -> Any:
    """Coerce a raw cell value to the correct Python type for the target DB column."""
    # Null guard
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    if isinstance(value, (np.integer, np.floating)):
        value = value.item()

    str_val = str(value).strip()
    if str_val in ("", "nan", "None", "NaT", "NaN"):
        return None

    if field in BOOLEAN_FIELDS:
        return str_val.lower() in ("true", "1", "yes", "y")

    if field in INT_FIELDS:
        try:
            return int(float(re.sub(r"[^\d.\-]", "", str_val)))
        except (ValueError, TypeError):
            return None

    if field in NUMERIC_FIELDS:
        try:
            cleaned = re.sub(r"[₹$€£,\s]", "", str_val)
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    if field in DATE_FIELDS:
        if isinstance(value, (date, datetime)):
            return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(str_val[:10], fmt).date().isoformat()
            except ValueError:
                continue
        return None

    if field in DATETIME_FIELDS:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date):
            return datetime(value.year, value.month, value.day).isoformat()
        try:
            # Try pandas parsing
            ts = pd.Timestamp(str_val)
            if ts is not pd.NaT:
                return ts.isoformat()
        except Exception:
            pass
        return None

    if field in TEXT_UPPER_FIELDS:
        return str_val.upper()

    return str_val


# ─── Main Processing Function ─────────────────────────────────────────────────

def _build_rows_vectorized(df: pd.DataFrame, col_map: dict, uid: str) -> list[dict]:
    """
    Build cleaned rows using vectorised pandas operations.
    ~20-50x faster than iterrows() for large DataFrames.
    """
    # Select and rename only the columns we care about
    src_cols = [c for c in col_map.keys() if c in df.columns]
    working = df[src_cols].rename(columns=col_map).copy()

    for col in working.columns:
        s = working[col]
        if col in BOOLEAN_FIELDS:
            working[col] = s.astype(str).str.strip().str.lower().isin(["true", "1", "yes", "y"])
        elif col in INT_FIELDS or col in NUMERIC_FIELDS:
            cleaned = s.astype(str).str.replace(r"[₹$€£,\s]", "", regex=True)
            working[col] = pd.to_numeric(cleaned, errors="coerce")
        elif col in DATE_FIELDS:
            parsed = pd.to_datetime(s, infer_datetime_format=True, errors="coerce")
            working[col] = parsed.dt.strftime("%Y-%m-%d").where(parsed.notna(), other=None)
        elif col in DATETIME_FIELDS:
            parsed = pd.to_datetime(s, infer_datetime_format=True, errors="coerce")
            working[col] = parsed.dt.strftime("%Y-%m-%dT%H:%M:%S").where(parsed.notna(), other=None)
        elif col in TEXT_UPPER_FIELDS:
            working[col] = s.astype(str).str.strip().str.upper().replace({"NAN": None, "NONE": None, "": None})
        else:
            working[col] = s.astype(str).str.strip().replace({"nan": None, "None": None, "NaT": None, "NaN": None, "": None})

    working["user_id"] = uid

    records = working.to_dict("records")
    # Convert remaining float NaN / pd.NA to None for JSON safety
    for rec in records:
        for k, v in rec.items():
            if v is pd.NA:
                rec[k] = None
            elif isinstance(v, float) and np.isnan(v):
                rec[k] = None
    return records


def process_file(
    file_bytes: bytes,
    filename: str,
    uid: str,
    supabase_client,
    manual_table: str | None = None,
    max_rows: int | None = None,
    skip_auto_risk: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Process an uploaded Excel/CSV file and insert rows into the matching lg_* Supabase table.
    Returns a summary dict with rows_processed, rows_inserted, table, errors.

    max_rows: if set, read at most this many rows from the file (uses nrows= on read,
              so large files are never fully loaded into memory).
    skip_auto_risk: if True, skip the auto risk snapshot computation after shipments insert.
    """
    table = manual_table or detect_table_from_filename(filename)
    if not table:
        return {"success": False, "error": f"Could not detect table type from filename '{filename}'. Supported: {list(TABLE_KEYWORDS.keys())}"}

    # Read file — pass nrows so we never parse more than needed
    try:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext in ("xlsx", "xls"):
            df = pd.read_excel(BytesIO(file_bytes), nrows=max_rows)
        elif ext == "csv":
            df = pd.read_csv(BytesIO(file_bytes), nrows=max_rows)
        else:
            return {"success": False, "error": f"Unsupported file type: {ext}"}
    except Exception as e:
        return {"success": False, "error": f"Failed to read file: {e}"}

    if df.empty:
        return {"success": False, "error": "File is empty"}

    # Map columns
    col_map = map_columns(list(df.columns), table)
    if not col_map:
        return {"success": False, "error": f"No recognisable columns found for table '{table}'. File columns: {list(df.columns)[:10]}"}

    # Build all rows at once using vectorised pandas — much faster than iterrows
    rows = _build_rows_vectorized(df, col_map, uid)
    rows_processed = len(rows)

    # dry_run: return processed rows without touching the database
    if dry_run:
        return {
            "success": True,
            "table": f"lg_{table}",
            "rows_processed": rows_processed,
            "rows_inserted": 0,
            "rows": rows,
            "errors": [],
        }

    rows_inserted = 0
    errors: list[str] = []

    BATCH = 500
    for i in range(0, len(rows), BATCH):
        inserted, errs = _upsert_batch(supabase_client, table, rows[i : i + BATCH])
        rows_inserted += inserted
        errors.extend(errs)

    # After inserting shipments, auto-compute risk snapshots (unless skipped)
    if table == "shipments" and rows_inserted > 0 and not skip_auto_risk:
        try:
            _auto_compute_risk_snapshots(supabase_client, uid)
        except Exception as e:
            logger.warning("Auto risk computation failed: %s", e)

    return {
        "success": True,
        "table": f"lg_{table}",
        "rows_processed": rows_processed,
        "rows_inserted": rows_inserted,
        "errors": errors[:10],
    }


def _upsert_batch(supabase_client, table: str, batch: list[dict]) -> tuple[int, list[str]]:
    """Upsert a batch of rows into a Supabase lg_* table. Returns (count_inserted, errors)."""
    full_table = f"lg_{table}"
    errors: list[str] = []
    try:
        supabase_client.table(full_table).upsert(batch, on_conflict=_conflict_cols(table)).execute()
        return len(batch), errors
    except Exception as e:
        err_msg = str(e)
        errors.append(err_msg)
        logger.error("Batch upsert failed for %s: %s", full_table, err_msg)
        # Try row-by-row fallback
        inserted = 0
        for row in batch:
            try:
                supabase_client.table(full_table).upsert([row], on_conflict=_conflict_cols(table)).execute()
                inserted += 1
            except Exception as row_err:
                errors.append(f"Row error: {row_err}")
        return inserted, errors


def _conflict_cols(table: str) -> str:
    """Return the conflict resolution columns for upsert, based on UNIQUE constraints."""
    conflict_map = {
        "routes": "user_id,route_id",
        "vendors": "user_id,vendor_id",
        "drivers": "user_id,driver_id",
        "trucks": "user_id,truck_id",
        "shipments": "user_id,shipment_id",
        "vendor_performance_metrics": "user_id,vendor_id,calculation_date,performance_window",
        "driver_incidents": "user_id,incident_id",
        "shipment_financials": "user_id,shipment_id",
        "shipment_cost_planning_actuals": "user_id,shipment_id",
        "market_freight_intelligence": "user_id,route_id,vehicle_type,date",
        "shipment_risk_snapshots": "user_id,shipment_id",
        "risk_weight_configuration": "user_id",
    }
    return conflict_map.get(table, "id")


# ─── Auto Risk Computation ────────────────────────────────────────────────────

def _auto_compute_risk_snapshots(supabase_client, uid: str) -> None:
    """
    Compute/update risk snapshots for all shipments belonging to this user
    that don't already have a recent snapshot.
    """
    # Fetch shipments without risk snapshot
    ships_resp = supabase_client.table("lg_shipments").select("shipment_id, shipment_status, shipment_value, dispatch_datetime, delivery_deadline, vendor_id, route_id").eq("user_id", uid).execute()
    shipments = ships_resp.data or []
    if not shipments:
        return

    # Fetch existing snapshots
    existing_resp = supabase_client.table("lg_shipment_risk_snapshots").select("shipment_id").eq("user_id", uid).execute()
    existing_ids = {r["shipment_id"] for r in (existing_resp.data or [])}

    # Fetch vendor performance
    vendor_resp = supabase_client.table("lg_vendor_performance_metrics").select("vendor_id, on_time_percentage, delay_rate_percentage").eq("user_id", uid).execute()
    vendor_perf: dict[str, dict] = {}
    for v in (vendor_resp.data or []):
        vid = v.get("vendor_id")
        if vid:
            vendor_perf[vid] = v

    # Fetch incidents per driver
    incidents_resp = supabase_client.table("lg_driver_incidents").select("driver_id").eq("user_id", uid).execute()

    snapshots_to_upsert = []
    for ship in shipments:
        sid = str(ship.get("shipment_id", ""))
        if not sid:
            continue

        # Skip if already has snapshot and not in_transit
        if sid in existing_ids and ship.get("shipment_status") not in ("IN_TRANSIT", "DELAYED"):
            continue

        snapshot = _compute_risk(ship, vendor_perf)
        snapshot["user_id"] = uid
        snapshot["shipment_id"] = sid
        snapshots_to_upsert.append(snapshot)

    if snapshots_to_upsert:
        supabase_client.table("lg_shipment_risk_snapshots").upsert(snapshots_to_upsert, on_conflict="user_id,shipment_id").execute()


def _compute_risk(shipment: dict, vendor_perf: dict) -> dict:
    """Compute a risk snapshot dict for a single shipment."""
    from datetime import datetime as dt, timezone

    # Operational risk — based on status and delivery deadline
    op_score = 20.0
    status = (shipment.get("shipment_status") or "CREATED").upper()
    if status == "DELAYED":
        op_score = 85.0
    elif status == "IN_TRANSIT":
        deadline_str = shipment.get("delivery_deadline")
        if deadline_str:
            try:
                deadline = pd.Timestamp(deadline_str)
                now = pd.Timestamp.now()
                if deadline < now:
                    op_score = 90.0
                elif (deadline - now).days <= 1:
                    op_score = 75.0
                elif (deadline - now).days <= 3:
                    op_score = 55.0
                else:
                    op_score = 30.0
            except Exception:
                op_score = 40.0
        else:
            op_score = 35.0
    elif status == "CREATED":
        op_score = 15.0
    elif status in ("DELIVERED", "CANCELLED"):
        op_score = 5.0

    # Vendor risk — based on performance metrics
    vendor_score = 30.0
    vendor_id = shipment.get("vendor_id")
    if vendor_id and vendor_id in vendor_perf:
        perf = vendor_perf[vendor_id]
        otp = float(perf.get("on_time_percentage") or 75)
        if otp < 60:
            vendor_score = 80.0
        elif otp < 75:
            vendor_score = 60.0
        elif otp < 90:
            vendor_score = 35.0
        else:
            vendor_score = 15.0

    # Financial risk — based on shipment value
    fin_score = 20.0
    value = shipment.get("shipment_value")
    if value:
        try:
            v = float(value)
            if v > 1_000_000:
                fin_score = 70.0
            elif v > 500_000:
                fin_score = 50.0
            elif v > 100_000:
                fin_score = 30.0
        except (TypeError, ValueError):
            pass

    # Compliance risk — base level, improved by actual doc data
    comp_score = 25.0

    # Overall weighted average
    overall = round((op_score + vendor_score + fin_score + comp_score) / 4, 2)

    risk_cat = "HIGH" if overall >= 70 else ("MEDIUM" if overall >= 45 else "LOW")
    alert = overall >= 50
    severity = "critical" if overall >= 85 else ("high" if overall >= 70 else ("medium" if overall >= 50 else "low"))
    category = "Operational" if op_score >= max(vendor_score, fin_score, comp_score) else (
        "Vendor" if vendor_score >= max(fin_score, comp_score) else (
            "Financial" if fin_score >= comp_score else "Compliance"
        )
    )

    return {
        "compliance_risk_score": round(comp_score, 2),
        "vendor_risk_score": round(vendor_score, 2),
        "operational_risk_score": round(op_score, 2),
        "financial_exposure_score": round(fin_score, 2),
        "overall_risk_score": overall,
        "risk_category": risk_cat,
        "alert_generated": alert,
        "alert_severity": severity,
        "alert_type": f"{category} Risk",
        "category": category,
        "explanation": f"{category} risk is the primary driver with a score of {overall:.0f}/100.",
        "recommendation": _recommendation(risk_cat, category),
        "model_version": "v1.0",
    }


def _recommendation(risk_cat: str, category: str) -> str:
    recs = {
        ("HIGH", "Operational"): "Escalate to operations team immediately. Evaluate reroute options and contact carrier for status update.",
        ("HIGH", "Vendor"): "Flag carrier for performance review. Initiate backup carrier engagement to protect SLA.",
        ("HIGH", "Financial"): "Verify insurance coverage. Assess exposure limit and consider increasing coverage or partial hedging.",
        ("HIGH", "Compliance"): "Check all expiring permits and licenses immediately. Halt dispatch until documents are renewed.",
        ("MEDIUM", "Operational"): "Monitor shipment closely. Prepare contingency if delivery window tightens.",
        ("MEDIUM", "Vendor"): "Request performance update from carrier. Flag for contract review at next cycle.",
        ("MEDIUM", "Financial"): "Review shipment insurance and financial exposure at next weekly audit.",
        ("MEDIUM", "Compliance"): "Schedule document renewals within the next 30 days to avoid operational disruption.",
        ("LOW", "Operational"): "Shipment is on track. Continue standard monitoring protocols.",
        ("LOW", "Vendor"): "Carrier performing within acceptable parameters. No action required.",
        ("LOW", "Financial"): "Financial exposure is within normal bounds. No additional hedging needed.",
        ("LOW", "Compliance"): "All compliance documents are valid. Next review at standard schedule.",
    }
    return recs.get((risk_cat, category), "Review shipment details and take appropriate action based on risk level.")
