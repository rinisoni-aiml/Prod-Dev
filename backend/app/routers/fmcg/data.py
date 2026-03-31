from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from pathlib import Path
import uuid

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
    Register the bundled FMCG sample CSVs for the current user.
    Uploads each file to Supabase Storage and creates data_files records.
    Idempotent — if sample files are already loaded, returns the existing records.
    """
    uid = str(current_user.id)

    # Idempotency: if sample records already exist, return them
    try:
        existing_resp = supabase.table("data_files").select("*").eq("user_id", uid).execute()
        existing = existing_resp.data or []
        sample_records = [
            f for f in existing
            if (f.get("column_mapping") or {}).get("__sample__")
        ]
        if sample_records:
            return sample_records
    except Exception:
        pass

    created = []
    for sf in _SAMPLE_FILES:
        filepath = _SAMPLE_DATA_DIR / sf["filename"]
        if not filepath.exists():
            continue
        try:
            content = filepath.read_bytes()
            storage_path = f"{uid}/sample/{sf['filename']}"

            # Upload to storage — ignore conflict if file already exists there
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
