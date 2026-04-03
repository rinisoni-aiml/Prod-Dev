"""
Logistics Upload Router — /api/logistics/v1/upload
Handles file uploads and sample data loading.

Sample data strategy (cache-first, instant for users):
  1. A "system sample user" (SYS_SAMPLE_UID) holds the pre-loaded sample rows
     in all lg_* tables. Populate it once by calling POST /admin/init-sample-cache.
  2. When any user loads sample data, the Postgres RPC lg_copy_sample_to_user()
     does a server-side INSERT...SELECT — copies ~100 K rows in 1–3 s with no
     network overhead.
  3. If the system user has no data yet (cache not seeded), the endpoint falls
     back to loading files in the background.

Run the SQL in migrations/sample_cache_rpc.sql in the Supabase SQL editor BEFORE
calling the admin endpoint.
"""
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
from app.industries.logistics.utils.excel_processor import process_file, detect_table_from_filename
from app.industries.logistics.services.insight_engine_service import invalidate_all_insights

logger = logging.getLogger(__name__)
router = APIRouter()

# Reserved UUID that holds the single copy of sample data in all lg_* tables.
# This user is never a real auth user — it exists only as a FK-less data seed.
SYS_SAMPLE_UID = "00000000-0000-0000-0000-000000000000"

# Path to bundled sample dataset
SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Load order respects FK-ish dependencies (entities before transactions)
SAMPLE_FILES_ORDER = [
    "route.xlsx",
    "Vendors.xlsx",
    "drivers.xlsx",
    "trucks.xlsx",
    "shipments.xlsx",
    "vendor_performance_metrics.xlsx",
    "Incidents (driver_incidents).xlsx",
    "shipment_financial.xlsx",
    "shipment_cost_planning_actuals.xlsx",
    "market_freight_intelligence.xlsx",
    "shipment_risk_snapshots.xlsx",
    "risk_weight_configuration.xlsx",
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _system_cache_populated() -> bool:
    """Return True if the system sample user has shipment rows in the DB."""
    try:
        resp = (
            supabase.table("lg_shipments")
            .select("shipment_id", count="exact")
            .eq("user_id", SYS_SAMPLE_UID)
            .limit(1)
            .execute()
        )
        return (resp.count or 0) > 0
    except Exception:
        return False


def _copy_sample_via_rpc(uid: str) -> dict:
    """
    Call the Postgres RPC that does a server-side INSERT…SELECT from the system
    user to the target user. Returns in 1–3 s regardless of row count.
    """
    result = supabase.rpc("lg_copy_sample_to_user", {"p_uid": uid}).execute()
    return result.data or {}


def _load_sample_files_for_user(uid: str) -> list[dict]:
    """
    Process all bundled Excel files and insert them into lg_* tables for `uid`.
    Used both for seeding the system user and as a fallback when the RPC cache
    is not yet populated.
    """
    results = []
    _meta_records: list[dict] = []

    for filename in SAMPLE_FILES_ORDER:
        filepath = SAMPLE_DATA_DIR / filename
        if not filepath.exists():
            results.append({"file": filename, "skipped": True, "reason": "File not found"})
            continue
        try:
            content = filepath.read_bytes()
            result = process_file(content, filename, uid, supabase, skip_auto_risk=True)
            rows_inserted = result.get("rows_inserted", 0)
            table_name = result.get("table")
            results.append({
                "file": filename,
                "table": table_name,
                "rows_inserted": rows_inserted,
                "success": result.get("success", False),
                "error": result.get("error"),
            })
            if result.get("success") and uid != SYS_SAMPLE_UID:
                # Only write data_files metadata for real users, not the system seed
                _meta_records.append({
                    "user_id": uid,
                    "file_name": filename,
                    "storage_path": f"logistics/{uid}/sample/{filename}",
                    "file_size": len(content),
                    "row_count": rows_inserted,
                    "column_mapping": {
                        "__table__": table_name,
                        "__purpose__": "logistics",
                        "__sample__": True,
                    },
                })
        except Exception as e:
            logger.error("Sample load failed for %s (user %s): %s", filename, uid, e)
            results.append({"file": filename, "success": False, "error": str(e)})

    if _meta_records:
        try:
            supabase.table("data_files").upsert(
                _meta_records, on_conflict="user_id,file_name"
            ).execute()
        except Exception as meta_err:
            logger.warning("Could not batch-write data_files records: %s", meta_err)

    try:
        invalidate_all_insights(uid)
    except Exception:
        pass

    total = sum(r.get("rows_inserted", 0) for r in results)
    logger.info("Sample load complete for user %s: %d rows", uid, total)
    return results


def _write_user_data_files(uid: str) -> None:
    """Write data_files metadata rows for a user after RPC copy."""
    _meta_records = []
    for filename in SAMPLE_FILES_ORDER:
        filepath = SAMPLE_DATA_DIR / filename
        if not filepath.exists():
            continue
        try:
            table_name = f"lg_{detect_table_from_filename(filename)}" if detect_table_from_filename(filename) else None
            _meta_records.append({
                "user_id": uid,
                "file_name": filename,
                "storage_path": f"logistics/{uid}/sample/{filename}",
                "file_size": filepath.stat().st_size,
                "row_count": 0,  # row counts not tracked via RPC copy
                "column_mapping": {
                    "__table__": table_name,
                    "__purpose__": "logistics",
                    "__sample__": True,
                },
            })
        except Exception:
            pass

    if _meta_records:
        try:
            supabase.table("data_files").upsert(
                _meta_records, on_conflict="user_id,file_name"
            ).execute()
        except Exception as e:
            logger.warning("Could not write data_files after RPC copy: %s", e)


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    table_name: str | None = Query(None, description="Override detected table name"),
    current_user=Depends(get_current_user),
):
    """Upload a logistics Excel/CSV file and process it into the database."""
    uid = str(current_user.id)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
    if ext not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    try:
        content = await file.read()
        result = process_file(content, file.filename, uid, supabase, manual_table=table_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Processing failed"))

    try:
        storage_path = f"logistics/{uid}/{file.filename}"
        supabase.storage.from_("data-files").upload(
            storage_path, content,
            {"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
        record = {
            "user_id": uid,
            "file_name": file.filename,
            "storage_path": storage_path,
            "file_size": len(content),
            "row_count": result.get("rows_inserted", 0),
            "column_mapping": {"__table__": result.get("table"), "__purpose__": "logistics"},
        }
        existing = supabase.table("data_files").select("id").eq("user_id", uid).eq("file_name", file.filename).execute()
        if existing.data:
            supabase.table("data_files").update(record).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("data_files").insert(record).execute()
    except Exception as e:
        logger.warning("Could not record file metadata: %s", e)

    return {
        "success": True,
        "table": result.get("table"),
        "rows_processed": result.get("rows_processed"),
        "rows_inserted": result.get("rows_inserted"),
        "errors": result.get("errors", []),
        "filename": file.filename,
    }


@router.post("/sample")
async def load_sample_data(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    Load the bundled sample logistics dataset for the current user.

    Fast path (cache ready): calls lg_copy_sample_to_user() RPC — server-side
    INSERT…SELECT completes in ~2 seconds regardless of row count.

    Fallback (cache not seeded yet): runs file processing in a background task
    and returns immediately.
    """
    uid = str(current_user.id)

    if not SAMPLE_DATA_DIR.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Sample dataset directory not found: {SAMPLE_DATA_DIR}",
        )

    # Idempotency: if this user already has sample data, return immediately
    try:
        all_records = (
            supabase.table("data_files")
            .select("id,file_name,row_count,column_mapping")
            .eq("user_id", uid)
            .execute()
            .data or []
        )
        sample_records = [f for f in all_records if (f.get("column_mapping") or {}).get("__sample__")]
        if sample_records:
            return {
                "success": True,
                "status": "ready",
                "message": f"Sample data already loaded ({len(sample_records)} files).",
            }
    except Exception:
        pass

    # Fast path: system cache populated — use RPC (1–3 s)
    if _system_cache_populated():
        try:
            _copy_sample_via_rpc(uid)
            _write_user_data_files(uid)
            try:
                invalidate_all_insights(uid)
            except Exception:
                pass
            return {
                "success": True,
                "status": "ready",
                "message": "Sample data loaded from cache.",
            }
        except Exception as rpc_err:
            logger.warning("RPC copy failed (%s), falling back to background task", rpc_err)

    # Fallback: seed not ready yet — load in background
    background_tasks.add_task(_load_sample_files_for_user, uid)
    return {
        "success": True,
        "status": "loading",
        "message": "Sample data is loading in the background. Your dashboard will populate shortly.",
    }


@router.post("/admin/init-sample-cache")
async def init_sample_cache(
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """
    One-time admin endpoint: seed the system user with all sample Excel data.
    After this completes, all subsequent /sample calls will use the fast RPC path.

    Prerequisites:
      1. Run backend/app/industries/logistics/migrations/sample_cache_rpc.sql
         in the Supabase SQL editor to create the lg_copy_sample_to_user() function.
      2. Call this endpoint once (any authenticated user can trigger it).

    Idempotent — safe to call multiple times; skips if already seeded.
    """
    if _system_cache_populated():
        return {"success": True, "message": "System sample cache is already seeded. Nothing to do."}

    background_tasks.add_task(_load_sample_files_for_user, SYS_SAMPLE_UID)
    return {
        "success": True,
        "message": (
            "Seeding system sample cache in the background. "
            "This takes 1–3 minutes for ~100 K rows. "
            "Once complete, all users will get instant sample data via RPC."
        ),
    }


@router.get("/config")
async def get_upload_config(current_user=Depends(get_current_user)):
    """Return metadata about the upload system."""
    return {
        "data": {
            "supported_tables": list(detect_table_from_filename.__code__.co_consts),
            "sample_data_available": SAMPLE_DATA_DIR.exists(),
            "supported_formats": [".xlsx", ".xls", ".csv"],
            "sample_cache_ready": _system_cache_populated(),
        }
    }


@router.get("/table-stats")
async def get_table_stats(current_user=Depends(get_current_user)):
    """Return row counts for all logistics tables for this user."""
    uid = str(current_user.id)
    tables = [
        "lg_routes", "lg_vendors", "lg_drivers", "lg_trucks", "lg_shipments",
        "lg_vendor_performance_metrics", "lg_driver_incidents", "lg_shipment_financials",
        "lg_shipment_cost_planning_actuals", "lg_market_freight_intelligence",
        "lg_shipment_risk_snapshots",
    ]
    stats = {}
    for tbl in tables:
        try:
            resp = supabase.table(tbl).select("id", count="exact").eq("user_id", uid).limit(1).execute()
            stats[tbl] = resp.count or 0
        except Exception:
            stats[tbl] = 0
    return {"data": stats}
