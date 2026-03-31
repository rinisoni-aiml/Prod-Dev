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

# Sales orders column mapping (shortcut — avoids searching _SAMPLE_FILES at runtime)
_SALES_CM = {
    "date": "OrderDate",
    "units_sold": "Quantity",
    "sku": "ProductID",
    "unit_price": "UnitPrice",
    "region": "Region",
}

# Max rows to keep from the large sales orders file for fast processing
_SALES_NROWS = 5000


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
        # Get file record first to delete from storage
        resp = supabase.table("data_files").select("storage_path").eq("id", file_id).eq("user_id", uid).single().execute()
        if resp.data and resp.data.get("storage_path"):
            supabase.storage.from_("data-files").remove([resp.data["storage_path"]])
        supabase.table("data_files").delete().eq("id", file_id).eq("user_id", uid).execute()
        return {"message": "File deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/load-sample")
async def load_sample_data(current_user=Depends(get_current_user)):
    """
    Register the bundled FMCG sample CSVs for the current user AND immediately
    run forecast + inventory optimisation so the dashboard is fully populated
    without needing an auto-analyse pass.

    - sales_orders_complete.csv is trimmed to _SALES_NROWS rows before upload
      so Storage upload and XGBoost both finish quickly.
    - Idempotent: if sample records already exist they are returned immediately.
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

    # ── Upload files ─────────────────────────────────────────────────────────
    created = []
    trimmed_sales_bytes: bytes | None = None

    for sf in _SAMPLE_FILES:
        filepath = _SAMPLE_DATA_DIR / sf["filename"]
        if not filepath.exists():
            continue
        try:
            raw_bytes = filepath.read_bytes()

            # Trim the large sales orders file so upload and ML are fast
            if sf["filename"] == "sales_orders_complete.csv":
                df_trim = pd.read_csv(io.BytesIO(raw_bytes), nrows=_SALES_NROWS)
                content = df_trim.to_csv(index=False).encode()
                trimmed_sales_bytes = content
            else:
                content = raw_bytes

            storage_path = f"{uid}/sample/{sf['filename']}"
            try:
                supabase.storage.from_("data-files").upload(
                    storage_path, content, {"content-type": "text/csv"}
                )
            except Exception:
                pass  # already uploaded on a previous partial run

            record = {
                "user_id": uid,
                "file_name": sf["filename"],
                "storage_path": storage_path,
                "file_size": len(content),
                "column_mapping": sf["column_mapping"],
            }
            resp = supabase.table("data_files").insert(record).execute()
            if resp.data:
                created.append(resp.data[0])
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load {sf['filename']}: {e}")

    # ── Run analysis inline so dashboard is ready immediately ─────────────────
    # Pre-populating demand_history + inventory_items means the dashboard will
    # find has_demand_data=True and skip its auto-analyze pass entirely.
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

            # Forecast
            df = parse_file_to_dataframe(trimmed_sales_bytes, "sales_orders_complete.csv", _SALES_CM)
            run_result = run_all_skus_forecast(df, 30)
            _persist_demand_history(uid, run_result.get("results", {}))

            # Inventory optimisation
            df_inv = parse_file_for_optimization(trimmed_sales_bytes, "sales_orders_complete.csv", _SALES_CM)
            inv_result = run_inventory_optimization(
                df=df_inv, lead_time_days=7, service_level=0.95,
                order_cost=0, holding_cost_pct=0,
            )
            _persist_inventory_items(uid, inv_result.get("by_sku", []), inv_result.get("by_warehouse", []))

        except Exception as e:
            # Non-fatal: dashboard will fall back to auto-analyze on first load
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
