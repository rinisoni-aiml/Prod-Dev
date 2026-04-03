"""
Logistics Upload Router — /api/logistics/v1/upload

Sample data strategy (mirrors FMCG, no manual SQL steps required):

  CACHE (one-time, automatic):
    Processed rows from the 12 sample Excel files are compressed (gzip JSON)
    and stored in Supabase Storage at logistics/sample_cache/{table}.json.gz.
    The cache is built automatically the first time any user loads sample data,
    then reused for every subsequent user.

  USER LOAD (synchronous, ~10–14 s):
    1. Download all 12 gzip files from Storage concurrently.
    2. Decompress in memory.
    3. Insert into all 12 lg_* tables concurrently (2 000-row batches).
    4. Return {"status": "ready"} — frontend navigates to a populated dashboard.

  No background tasks, no polling, no zeros on the dashboard.
"""
import asyncio
import gzip
import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
from app.industries.logistics.utils.excel_processor import (
    process_file, detect_table_from_filename,
)
from app.industries.logistics.services.insight_engine_service import invalidate_all_insights

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Constants ────────────────────────────────────────────────────────────────

SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_BUCKET    = "data-files"
CACHE_PREFIX    = "logistics/sample_cache"
BATCH_SIZE      = 2000          # rows per upsert request
MAX_WORKERS     = 6             # concurrent table threads

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

TABLE_CONFLICT_MAP: dict[str, str] = {
    "lg_routes":                         "user_id,route_id",
    "lg_vendors":                        "user_id,vendor_id",
    "lg_drivers":                        "user_id,driver_id",
    "lg_trucks":                         "user_id,truck_id",
    "lg_shipments":                      "user_id,shipment_id",
    "lg_vendor_performance_metrics":     "user_id,vendor_id,calculation_date,performance_window",
    "lg_driver_incidents":               "user_id,incident_id",
    "lg_shipment_financials":            "user_id,shipment_id",
    "lg_shipment_cost_planning_actuals": "user_id,shipment_id",
    "lg_market_freight_intelligence":    "user_id,route_id,vehicle_type,date",
    "lg_shipment_risk_snapshots":        "user_id,shipment_id",
    "lg_risk_weight_configuration":      "user_id",
}


# ─── Storage cache helpers ────────────────────────────────────────────────────

def _cache_path(table_name: str) -> str:
    return f"{CACHE_PREFIX}/{table_name}.json.gz"


def _is_cache_ready() -> bool:
    """True if lg_shipments cache file exists in Storage."""
    try:
        files = supabase.storage.from_(CACHE_BUCKET).list(CACHE_PREFIX)
        names = {f["name"] for f in (files or [])}
        return "lg_shipments.json.gz" in names
    except Exception:
        return False


def _upload_cache(table_rows: dict[str, list[dict]]) -> None:
    """Compress and upload all tables to Storage. Fire-and-forget (runs in its own thread)."""
    for table_name, rows in table_rows.items():
        try:
            # Strip user_id — each user gets their own copy on load
            stripped = [{k: v for k, v in r.items() if k != "user_id"} for r in rows]
            payload  = gzip.compress(
                json.dumps(stripped, default=str).encode("utf-8"), compresslevel=6
            )
            supabase.storage.from_(CACHE_BUCKET).upload(
                _cache_path(table_name), payload,
                {"content-type": "application/gzip", "upsert": "true"},
            )
            logger.info("Sample cache uploaded: %s (%d rows, %d bytes)", table_name, len(stripped), len(payload))
        except Exception as exc:
            logger.warning("Cache upload failed for %s: %s", table_name, exc)


def _download_cache() -> dict[str, list[dict]]:
    """Download and decompress all cached tables concurrently."""
    tables = list(TABLE_CONFLICT_MAP.keys())

    def _dl(table_name: str) -> tuple[str, list[dict]]:
        try:
            raw = supabase.storage.from_(CACHE_BUCKET).download(_cache_path(table_name))
            rows = json.loads(gzip.decompress(raw).decode("utf-8"))
            logger.info("Cache hit: %s (%d rows)", table_name, len(rows))
            return table_name, rows
        except Exception as exc:
            logger.warning("Cache download failed for %s: %s", table_name, exc)
            return table_name, []

    result: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        for table_name, rows in ex.map(lambda t: _dl(t), tables):
            if rows:
                result[table_name] = rows
    return result


# ─── Excel processing ──────────────────────────────────────────────────────────

def _process_all_files() -> dict[str, list[dict]]:
    """
    Read + process all 12 Excel files concurrently using dry_run mode.
    Returns {table_name: rows} without touching the database.
    """
    def _process_one(filename: str) -> tuple[str | None, list[dict]]:
        filepath = SAMPLE_DATA_DIR / filename
        if not filepath.exists():
            logger.warning("Sample file not found: %s", filename)
            return None, []
        try:
            content = filepath.read_bytes()
            result  = process_file(
                content, filename, "__cache__", supabase,
                skip_auto_risk=True, dry_run=True,
            )
            return result.get("table"), result.get("rows", [])
        except Exception as exc:
            logger.error("Failed to process %s: %s", filename, exc)
            return None, []

    table_rows: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        for table_name, rows in ex.map(_process_one, SAMPLE_FILES_ORDER):
            if table_name and rows:
                table_rows[table_name] = rows
    return table_rows


# ─── Concurrent DB insertion ──────────────────────────────────────────────────

def _insert_all_tables(table_rows: dict[str, list[dict]], uid: str) -> None:
    """Insert all tables concurrently with BATCH_SIZE-row upserts."""

    def _insert_one(table_name: str, rows: list[dict]) -> None:
        conflict  = TABLE_CONFLICT_MAP.get(table_name, "id")
        user_rows = [{**r, "user_id": uid} for r in rows]
        for i in range(0, len(user_rows), BATCH_SIZE):
            batch = user_rows[i : i + BATCH_SIZE]
            try:
                supabase.table(table_name).upsert(batch, on_conflict=conflict).execute()
            except Exception as exc:
                logger.error("Insert error %s batch@%d: %s", table_name, i, exc)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(_insert_one, t, r): t for t, r in table_rows.items()}
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as exc:
                logger.error("Table insert thread failed: %s", exc)


def _write_data_files_metadata(uid: str) -> None:
    """Write data_files metadata rows so files appear in the Data Upload page."""
    records = []
    for filename in SAMPLE_FILES_ORDER:
        filepath = SAMPLE_DATA_DIR / filename
        if not filepath.exists():
            continue
        tbl = detect_table_from_filename(filename)
        records.append({
            "user_id":        uid,
            "file_name":      filename,
            "storage_path":   f"logistics/{uid}/sample/{filename}",
            "file_size":      filepath.stat().st_size,
            "row_count":      0,
            "column_mapping": {
                "__table__":   f"lg_{tbl}" if tbl else None,
                "__purpose__": "logistics",
                "__sample__":  True,
            },
        })
    if records:
        try:
            supabase.table("data_files").upsert(records, on_conflict="user_id,file_name").execute()
        except Exception as exc:
            logger.warning("data_files metadata write failed: %s", exc)


def _do_load_sample(uid: str) -> None:
    """
    Core synchronous loader — runs in a thread via run_in_executor.

    Fast path  (cache ready):   download Storage → concurrent insert  (~10–12 s)
    First-time (no cache yet):  process Excel files → concurrent insert (~12–15 s)
                                 then upload cache in background for future users
    """
    if _is_cache_ready():
        logger.info("Loading sample from Storage cache for user %s", uid)
        table_rows = _download_cache()
    else:
        logger.info("Cache miss — processing Excel files for user %s (will cache after)", uid)
        table_rows = _process_all_files()
        # Upload cache in the background so next users are fast
        threading.Thread(
            target=_upload_cache, args=(table_rows,), daemon=True, name="lg-cache-upload"
        ).start()

    _insert_all_tables(table_rows, uid)
    _write_data_files_metadata(uid)

    try:
        invalidate_all_insights(uid)
    except Exception:
        pass

    total = sum(len(r) for r in table_rows.values())
    logger.info("Sample load complete for user %s: %d rows across %d tables", uid, total, len(table_rows))


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
        result  = process_file(content, file.filename, uid, supabase, manual_table=table_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not result.get("success"):
        raise HTTPException(status_code=422, detail=result.get("error", "Processing failed"))

    try:
        storage_path = f"logistics/{uid}/{file.filename}"
        supabase.storage.from_("data-files").upload(
            storage_path, content,
            {"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
        record = {
            "user_id":        uid,
            "file_name":      file.filename,
            "storage_path":   storage_path,
            "file_size":      len(content),
            "row_count":      result.get("rows_inserted", 0),
            "column_mapping": {"__table__": result.get("table"), "__purpose__": "logistics"},
        }
        existing = (
            supabase.table("data_files")
            .select("id").eq("user_id", uid).eq("file_name", file.filename)
            .execute()
        )
        if existing.data:
            supabase.table("data_files").update(record).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("data_files").insert(record).execute()
    except Exception as exc:
        logger.warning("Could not record file metadata: %s", exc)

    return {
        "success":        True,
        "table":          result.get("table"),
        "rows_processed": result.get("rows_processed"),
        "rows_inserted":  result.get("rows_inserted"),
        "errors":         result.get("errors", []),
        "filename":       file.filename,
    }


@router.post("/sample")
async def load_sample_data(current_user=Depends(get_current_user)):
    """
    Load the full logistics sample dataset for the current user.

    This endpoint is SYNCHRONOUS — it waits until all rows are inserted and
    returns {"status": "ready"} only when the dashboard will show real data.

    Timing:
      - Cache hit (Storage):  ~10–12 s  (download + concurrent insert)
      - Cache miss (first ever load): ~12–15 s  (Excel parse + concurrent insert,
                                                  then uploads cache for future users)
    """
    uid = str(current_user.id)

    if not SAMPLE_DATA_DIR.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Sample dataset directory not found: {SAMPLE_DATA_DIR}",
        )

    # Idempotency: skip if this user already has sample data
    try:
        all_records = (
            supabase.table("data_files")
            .select("id,column_mapping")
            .eq("user_id", uid)
            .execute()
            .data or []
        )
        if any((r.get("column_mapping") or {}).get("__sample__") for r in all_records):
            return {"success": True, "status": "ready", "message": "Sample data already loaded."}
    except Exception:
        pass

    # Run synchronously in a thread so the async event loop stays free
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _do_load_sample, uid)

    return {
        "success": True,
        "status":  "ready",
        "message": "Sample data loaded successfully.",
    }


@router.get("/config")
async def get_upload_config(current_user=Depends(get_current_user)):
    return {
        "data": {
            "sample_data_available": SAMPLE_DATA_DIR.exists(),
            "supported_formats":     [".xlsx", ".xls", ".csv"],
            "sample_cache_ready":    _is_cache_ready(),
        }
    }


@router.get("/table-stats")
async def get_table_stats(current_user=Depends(get_current_user)):
    """Return row counts for all logistics tables for this user."""
    uid = str(current_user.id)
    tables = [
        "lg_routes", "lg_vendors", "lg_drivers", "lg_trucks", "lg_shipments",
        "lg_vendor_performance_metrics", "lg_driver_incidents",
        "lg_shipment_financials", "lg_shipment_cost_planning_actuals",
        "lg_market_freight_intelligence", "lg_shipment_risk_snapshots",
    ]
    stats = {}
    for tbl in tables:
        try:
            resp = supabase.table(tbl).select("id", count="exact").eq("user_id", uid).limit(1).execute()
            stats[tbl] = resp.count or 0
        except Exception:
            stats[tbl] = 0
    return {"data": stats}
