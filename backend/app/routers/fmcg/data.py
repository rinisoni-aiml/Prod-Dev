import io
import logging

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

# Absolute path to the bundled sample CSVs
_SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "industries" / "fmcg" / "data"

# ── BIG sample files (used for "Load Sample Data") ────────────────────────────
# Columns: fmcg_sales_BIG.csv    → order_id, date, product_name, region, warehouse, quantity, price
#          fmcg_inventory_BIG.csv → product_id, warehouse, stock, reorder_level, safety, updated_on
#          fmcg_po_BIG.csv        → po_number, item, supplier_name, order_dt, delivery_dt, qty_ordered, status
#          fmcg_products_BIG.csv  → sku, product, category, brand
#          fmcg_wh_BIG.csv        → wh_id, name, location, capacity

_SAMPLE_FILES = [
    {
        "filename": "fmcg_sales_BIG.csv",
        "column_mapping": {
            "date": "date",
            "units_sold": "quantity",
            "sku": "product_name",
            "unit_price": "price",
            "region": "region",
            "warehouse": "warehouse",
            "__purpose__": "forecasting",
            "__sample__": True,
        },
    },
    {
        "filename": "fmcg_inventory_BIG.csv",
        "column_mapping": {
            "sku": "product_id",
            "warehouse": "warehouse",
            "stock_level": "stock",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
    {
        "filename": "fmcg_po_BIG.csv",
        "column_mapping": {
            "date": "order_dt",
            "units_sold": "qty_ordered",
            "sku": "item",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
    {
        "filename": "fmcg_products_BIG.csv",
        "column_mapping": {
            "sku": "sku",
            "product_name": "product",
            "category": "category",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
    {
        "filename": "fmcg_wh_BIG.csv",
        "column_mapping": {
            "warehouse": "wh_id",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
]

# Column mapping for the primary sales file (used in inline ML analysis)
_SALES_FILENAME = "fmcg_sales_BIG.csv"
_SALES_CM = {
    "date": "date",
    "units_sold": "quantity",
    "sku": "product_name",
    "unit_price": "price",
    "region": "region",
    "warehouse": "warehouse",
}

# Inventory BIG file mapping (for stock-level merge during inline analysis)
_INV_FILENAME = "fmcg_inventory_BIG.csv"
_INV_CM = {
    "sku": "product_id",
    "warehouse": "warehouse",
    "stock_level": "stock",
}

# Prefix used in storage_path for sample files that live on disk, not in Supabase Storage.
# The forecasting endpoint recognises this prefix and reads from the local filesystem.
_LOCAL_SAMPLE_PREFIX = "_local_sample/fmcg/"

# Supabase cache key for pre-computed sample results
_SAMPLE_CACHE_RUN_ID = "sample_demo"


@router.get("/sources")
async def get_data_sources(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("data_files").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return resp.data or []
    except Exception:
        return []


@router.delete("/sources/{file_id}")
async def delete_data_source(file_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("data_files").select("storage_path").eq("id", file_id).eq("user_id", uid).single().execute()
        if resp.data:
            sp = resp.data.get("storage_path") or ""
            # Only try to remove from Storage if it's a real storage path (not a local sample marker)
            if sp and not sp.startswith("_local_sample/"):
                supabase.storage.from_("data-files").remove([sp])
        supabase.table("data_files").delete().eq("id", file_id).eq("user_id", uid).execute()
        return {"message": "File deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _run_inline_sample_analysis(uid: str) -> None:
    """Background task: run forecast + inventory optimisation for the sample data."""
    sales_filepath = _SAMPLE_DATA_DIR / _SALES_FILENAME
    if not sales_filepath.exists():
        return
    try:
        from app.services.fmcg.forecast_service import parse_file_to_dataframe, run_all_skus_forecast
        from app.services.fmcg.inventory_optimizer import parse_file_for_optimization, run_inventory_optimization
        from app.routers.fmcg.forecasting import _persist_demand_history
        from app.routers.fmcg.inventory import _persist_inventory_items
        import numpy as np

        raw_bytes = sales_filepath.read_bytes()

        df = parse_file_to_dataframe(raw_bytes, _SALES_FILENAME, _SALES_CM)
        run_result = run_all_skus_forecast(df, 30)
        _persist_demand_history(uid, run_result.get("results", {}))

        df_inv = parse_file_for_optimization(raw_bytes, _SALES_FILENAME, _SALES_CM)

        inv_path = _SAMPLE_DATA_DIR / _INV_FILENAME
        if inv_path.exists():
            try:
                inv_raw = pd.read_csv(inv_path)
                inv_raw.columns = [str(c).strip() for c in inv_raw.columns]
                if "product_id" in inv_raw.columns and "stock" in inv_raw.columns:
                    stock_lookup = {}
                    for _, row in inv_raw.iterrows():
                        sku_key = str(row.get("product_id", "")).strip()
                        wh_key = str(row.get("warehouse", "")).strip() if "warehouse" in inv_raw.columns else None
                        try:
                            stk = float(str(row["stock"]).replace(",", ""))
                            stock_lookup[(sku_key, wh_key)] = stk
                        except (ValueError, TypeError):
                            pass

                    def _lookup_stock(row):
                        sku = str(row.get("sku", "")).strip()
                        wh  = str(row.get("warehouse", "")).strip() if row.get("warehouse") else None
                        v = stock_lookup.get((sku, wh))
                        if v is None:
                            v = stock_lookup.get((sku, None))
                        return float(v) if v is not None else np.nan

                    df_inv["stock_level"] = df_inv.apply(_lookup_stock, axis=1)
            except Exception as merge_err:
                logger.warning("Could not merge %s stock levels: %s", _INV_FILENAME, merge_err)

        inv_result = run_inventory_optimization(
            df=df_inv, lead_time_days=7, service_level=0.95,
            order_cost=0, holding_cost_pct=0,
        )
        _persist_inventory_items(uid, inv_result.get("by_sku", []), inv_result.get("by_warehouse", []))
        logger.info("Background sample analysis complete for user %s", uid)
    except Exception as e:
        logger.warning("Background sample analysis failed: %s", e)


@router.post("/load-sample")
async def load_sample_data(background_tasks: BackgroundTasks, current_user=Depends(get_current_user)):
    """
    Register the bundled FMCG BIG sample CSVs for the current user AND populate
    demand_history + inventory_items so the dashboard is fully loaded.

    Loading strategy (fastest-first):
      1. If the user already has sample data → return immediately (idempotent).
      2. If fmcg_sample_cache contains run_id='sample_demo' → copy cached ML
         results to the user's tables instantly (no reprocessing).
      3. Fallback: run forecast + inventory optimisation inline and write results.

    No Supabase Storage uploads — files stay on disk and are read directly.
    The storage_path field uses a '_local_sample/fmcg/' prefix so the
    forecasting endpoint knows to read from the local filesystem.
    """
    uid = str(current_user.id)

    # ── 1. Idempotency ────────────────────────────────────────────────────────
    try:
        all_records = supabase.table("data_files").select("*").eq("user_id", uid).execute().data or []
        sample_records = [f for f in all_records if (f.get("column_mapping") or {}).get("__sample__")]
        if sample_records:
            return sample_records
    except Exception:
        pass

    # ── Register file records (no Storage upload — files live on disk) ─────────
    created = []
    for sf in _SAMPLE_FILES:
        filepath = _SAMPLE_DATA_DIR / sf["filename"]
        if not filepath.exists():
            continue
        try:
            file_size = filepath.stat().st_size
            record = {
                "user_id": uid,
                "file_name": sf["filename"],
                "storage_path": f"{_LOCAL_SAMPLE_PREFIX}{sf['filename']}",
                "file_size": file_size,
                "column_mapping": sf["column_mapping"],
            }
            resp = supabase.table("data_files").insert(record).execute()
            if resp.data:
                created.append(resp.data[0])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to register {sf['filename']}: {e}")

    # ── 2. Load from pre-computed cache (instant — no ML rerun) ───────────────
    try:
        cache_resp = (
            supabase.table("fmcg_sample_cache")
            .select("demand_data,inventory_result")
            .eq("run_id", _SAMPLE_CACHE_RUN_ID)
            .execute()
        )
        cache_rows = cache_resp.data or []
        if cache_rows:
            cache = cache_rows[0]

            demand_rows = cache.get("demand_data") or []
            if demand_rows:
                user_demand_rows = [{**row, "user_id": uid} for row in demand_rows]
                supabase.table("demand_history").delete().eq("user_id", uid).execute()
                for i in range(0, len(user_demand_rows), 500):
                    supabase.table("demand_history").insert(user_demand_rows[i : i + 500]).execute()
                logger.info("Loaded %d demand rows from sample cache for user %s", len(demand_rows), uid)

            inv_result = cache.get("inventory_result") or {}
            if inv_result:
                from app.routers.fmcg.inventory import _persist_inventory_items
                _persist_inventory_items(uid, inv_result.get("by_sku", []), inv_result.get("by_warehouse", []))
                logger.info("Loaded inventory results from sample cache for user %s", uid)

            return created
    except Exception as cache_err:
        logger.warning("Sample cache miss or error (%s) — falling back to inline analysis", cache_err)

    # ── 3. Fallback: run analysis in the background (returns immediately) ────────
    background_tasks.add_task(_run_inline_sample_analysis, uid)
    logger.info("Scheduled background sample analysis for user %s", uid)

    return created


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    """Upload a CSV/XLSX file to Supabase Storage and record metadata."""
    uid = str(current_user.id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed = {".csv", ".xlsx", ".xls"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    try:
        content = await file.read()
        storage_path = f"{uid}/{uuid.uuid4()}{ext}"
        supabase.storage.from_("data-files").upload(storage_path, content, {"content-type": file.content_type})

        record = {
            "user_id": uid,
            "file_name": file.filename,
            "storage_path": storage_path,
            "file_size": len(content),
        }
        resp = supabase.table("data_files").insert(record).execute()
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
