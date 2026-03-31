import io
import logging

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

# Absolute path to the bundled sample CSVs
_SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "industries" / "fmcg" / "data"

_SAMPLE_FILES = [
    {
        "filename": "sales_orders_complete.csv",
        "column_mapping": {
            "date": "OrderDate",
            "units_sold": "Quantity",
            "sku": "ProductID",
            "unit_price": "UnitPrice",
            "region": "Region",
            "__purpose__": "forecasting",
            "__sample__": True,
        },
    },
    {
        "filename": "inventory.csv",
        "column_mapping": {
            "sku": "ProductID",
            "warehouse": "WarehouseID",
            "stock_level": "CurrentStock",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
    {
        "filename": "purchase_orders.csv",
        "column_mapping": {
            "date": "PODate",
            "units_sold": "Quantity",
            "sku": "ProductID",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
    {
        "filename": "warehouses.csv",
        "column_mapping": {
            "warehouse": "WarehouseID",
            "region": "Region",
            "__purpose__": "supplementary",
            "__sample__": True,
        },
    },
]

# Sales orders column mapping used for inline ML analysis
_SALES_CM = {
    "date": "OrderDate",
    "units_sold": "Quantity",
    "sku": "ProductID",
    "unit_price": "UnitPrice",
    "region": "Region",
}

# Rows to keep from the large sales orders file
_SALES_NROWS = 5000

# Prefix used in storage_path for sample files that live on disk, not in Supabase Storage.
# The forecasting endpoint recognises this prefix and reads from the local filesystem.
_LOCAL_SAMPLE_PREFIX = "_local_sample/fmcg/"


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


@router.post("/load-sample")
async def load_sample_data(current_user=Depends(get_current_user)):
    """
    Register the bundled FMCG sample CSVs for the current user AND run
    forecast + inventory optimisation so the dashboard is fully populated.

    No Supabase Storage uploads — files stay on disk and are read directly.
    The storage_path field uses a '_local_sample/fmcg/' prefix so the
    forecasting endpoint knows to read from the local filesystem.

    Idempotent: if sample records already exist they are returned immediately.
    """
    uid = str(current_user.id)

    # ── Idempotency ──────────────────────────────────────────────────────────
    try:
        all_records = supabase.table("data_files").select("*").eq("user_id", uid).execute().data or []
        sample_records = [f for f in all_records if (f.get("column_mapping") or {}).get("__sample__")]
        if sample_records:
            return sample_records
    except Exception:
        pass

    # ── Register files (no Storage upload — files live on disk) ──────────────
    created = []
    trimmed_sales_bytes: bytes | None = None

    for sf in _SAMPLE_FILES:
        filepath = _SAMPLE_DATA_DIR / sf["filename"]
        if not filepath.exists():
            continue
        try:
            raw_bytes = filepath.read_bytes()

            if sf["filename"] == "sales_orders_complete.csv":
                df_trim = pd.read_csv(io.BytesIO(raw_bytes), nrows=_SALES_NROWS)
                trimmed_sales_bytes = df_trim.to_csv(index=False).encode()
                file_size = len(trimmed_sales_bytes)
            else:
                file_size = len(raw_bytes)

            record = {
                "user_id": uid,
                "file_name": sf["filename"],
                # Marker path — not a real Supabase Storage path
                "storage_path": f"{_LOCAL_SAMPLE_PREFIX}{sf['filename']}",
                "file_size": file_size,
                "column_mapping": sf["column_mapping"],
            }
            resp = supabase.table("data_files").insert(record).execute()
            if resp.data:
                created.append(resp.data[0])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to register {sf['filename']}: {e}")

    # ── Run analysis inline (reads from memory — no network calls) ────────────
    # Pre-populates demand_history + inventory_items so the dashboard loads
    # instantly without triggering auto-analyze.
    if trimmed_sales_bytes is not None:
        try:
            from app.services.fmcg.forecast_service import (
                parse_file_to_dataframe, run_all_skus_forecast,
            )
            from app.services.fmcg.inventory_optimizer import (
                parse_file_for_optimization, run_inventory_optimization,
            )
            from app.routers.fmcg.forecasting import _persist_demand_history
            from app.routers.fmcg.inventory import _persist_inventory_items

            df = parse_file_to_dataframe(trimmed_sales_bytes, "sales_orders_complete.csv", _SALES_CM)
            run_result = run_all_skus_forecast(df, 30)
            _persist_demand_history(uid, run_result.get("results", {}))

            df_inv = parse_file_for_optimization(trimmed_sales_bytes, "sales_orders_complete.csv", _SALES_CM)
            inv_result = run_inventory_optimization(
                df=df_inv, lead_time_days=7, service_level=0.95,
                order_cost=0, holding_cost_pct=0,
            )
            _persist_inventory_items(uid, inv_result.get("by_sku", []), inv_result.get("by_warehouse", []))

        except Exception as e:
            logger.warning("Inline sample analysis failed (dashboard will auto-analyze): %s", e)

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
