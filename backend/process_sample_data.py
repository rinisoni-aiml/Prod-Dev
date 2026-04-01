"""
process_sample_data.py — One-time script to pre-compute FMCG sample ML results
and store them in Supabase under run_id = 'sample_demo'.

Run this once from the backend/ directory:
    cd backend
    source venv/bin/activate       # Windows: venv\\Scripts\\activate
    python process_sample_data.py

After this runs, every user who clicks "Load Sample Data" gets instant results
from the cache — no ML reprocessing on each button click.

Re-run whenever the BIG sample files are updated.
"""

import sys
import os
import io
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Path setup ────────────────────────────────────────────────────────────────
# Allow imports from the app package (this script lives in backend/)
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
import pandas as pd

from app.config import settings
from app.utils.supabase_client import supabase
from app.services.fmcg.forecast_service import (
    parse_file_to_dataframe,
    run_all_skus_forecast,
)
from app.services.fmcg.inventory_optimizer import (
    parse_file_for_optimization,
    run_inventory_optimization,
)

# ── Constants ─────────────────────────────────────────────────────────────────
_SAMPLE_DATA_DIR = Path(__file__).resolve().parent / "app" / "industries" / "fmcg" / "data"
_SALES_FILENAME  = "fmcg_sales_BIG.csv"
_INV_FILENAME    = "fmcg_inventory_BIG.csv"
_CACHE_RUN_ID    = "sample_demo"

_SALES_CM = {
    "date":       "date",
    "units_sold": "quantity",
    "sku":        "product_name",
    "unit_price": "price",
    "region":     "region",
    "warehouse":  "warehouse",
}

_INV_CM = {
    "sku":         "product_id",
    "warehouse":   "warehouse",
    "stock_level": "stock",
}


def _flatten_demand_rows(results: dict) -> list:
    """
    Convert run_all_skus_forecast() results dict into flat rows suitable for
    inserting into demand_history (without user_id — added at load time).
    """
    rows = []

    for sku_name, result in results.items():
        if result.get("error"):
            continue

        for point in result.get("historical", []):
            date   = point.get("date")
            actual = point.get("actual")
            if date and actual is not None:
                rows.append({"date": date, "sku": sku_name, "units": int(actual)})

        # Future forecast — only for the "All Products" aggregate
        if sku_name == "All Products":
            for point in result.get("forecast", []):
                date = point.get("date")
                fc   = point.get("forecast")
                if date and fc is not None:
                    rows.append({"date": date, "sku": "All Products", "units": 0, "forecast": int(fc)})

    return rows


def _merge_stock_levels(df_inv: pd.DataFrame) -> pd.DataFrame:
    """Inject stock_level values from fmcg_inventory_BIG.csv into df_inv."""
    inv_path = _SAMPLE_DATA_DIR / _INV_FILENAME
    if not inv_path.exists():
        logger.warning("  %s not found — skipping stock merge", _INV_FILENAME)
        return df_inv

    inv_raw = pd.read_csv(inv_path)
    inv_raw.columns = [str(c).strip() for c in inv_raw.columns]

    if "product_id" not in inv_raw.columns or "stock" not in inv_raw.columns:
        logger.warning("  %s missing expected columns — skipping stock merge", _INV_FILENAME)
        return df_inv

    stock_lookup: dict = {}
    for _, row in inv_raw.iterrows():
        sku_key = str(row.get("product_id", "")).strip()
        wh_key  = str(row.get("warehouse", "")).strip() if "warehouse" in inv_raw.columns else None
        try:
            stk = float(str(row["stock"]).replace(",", ""))
            stock_lookup[(sku_key, wh_key)] = stk
        except (ValueError, TypeError):
            pass

    def _lookup(row):
        sku = str(row.get("sku", "")).strip()
        wh  = str(row.get("warehouse", "")).strip() if row.get("warehouse") else None
        v = stock_lookup.get((sku, wh)) or stock_lookup.get((sku, None))
        return float(v) if v is not None else np.nan

    df_inv = df_inv.copy()
    df_inv["stock_level"] = df_inv.apply(_lookup, axis=1)
    filled = int(df_inv["stock_level"].notna().sum())
    logger.info("  Stock merge: %d / %d rows filled", filled, len(df_inv))
    return df_inv


def main():
    sales_path = _SAMPLE_DATA_DIR / _SALES_FILENAME
    if not sales_path.exists():
        logger.error("Sales file not found: %s", sales_path)
        sys.exit(1)

    logger.info("Reading %s …", _SALES_FILENAME)
    raw_bytes = sales_path.read_bytes()

    # ── Demand forecasting ────────────────────────────────────────────────────
    logger.info("Parsing sales data …")
    df = parse_file_to_dataframe(raw_bytes, _SALES_FILENAME, _SALES_CM)
    logger.info("  %d rows, %d unique SKUs", len(df), df["sku"].nunique())

    logger.info("Running XGBoost forecast (horizon=30) — this may take a minute …")
    run_result = run_all_skus_forecast(df, 30)
    demand_rows = _flatten_demand_rows(run_result.get("results", {}))
    logger.info("  %d demand rows generated", len(demand_rows))

    # ── Inventory optimisation ────────────────────────────────────────────────
    logger.info("Parsing inventory data for optimisation …")
    df_inv = parse_file_for_optimization(raw_bytes, _SALES_FILENAME, _SALES_CM)
    df_inv = _merge_stock_levels(df_inv)

    logger.info("Running inventory optimisation …")
    inv_result = run_inventory_optimization(
        df=df_inv, lead_time_days=7, service_level=0.95,
        order_cost=0, holding_cost_pct=0,
    )
    logger.info(
        "  %d SKUs optimised, %d warehouses",
        len(inv_result.get("by_sku", [])),
        len(inv_result.get("by_warehouse", [])),
    )

    # ── Serialise to JSON-safe dicts ──────────────────────────────────────────
    # numpy types are not JSON-serialisable — convert to native Python
    def _to_json(obj):
        return json.loads(json.dumps(obj, default=lambda x: (
            int(x) if isinstance(x, (np.integer,)) else
            float(x) if isinstance(x, (np.floating,)) else
            bool(x) if isinstance(x, (np.bool_,)) else
            str(x)
        )))

    demand_data_json   = _to_json(demand_rows)
    inv_result_payload = _to_json({
        "by_sku":       inv_result.get("by_sku", []),
        "by_warehouse": inv_result.get("by_warehouse", []),
        "summary":      inv_result.get("summary", {}),
    })

    # ── Upsert into Supabase fmcg_sample_cache ────────────────────────────────
    logger.info("Upserting cache row (run_id='%s') …", _CACHE_RUN_ID)
    payload = {
        "run_id":           _CACHE_RUN_ID,
        "demand_data":      demand_data_json,
        "inventory_result": inv_result_payload,
    }
    supabase.table("fmcg_sample_cache").upsert(payload, on_conflict="run_id").execute()
    logger.info("Done. Sample cache seeded with %d demand rows.", len(demand_data_json))
    logger.info(
        "Next time any user clicks 'Load Sample Data', results load instantly from cache."
    )


if __name__ == "__main__":
    main()
