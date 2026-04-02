"""
Logistics Upload Router — /api/logistics/v1/upload
Handles file uploads and sample data loading.
Processes Excel/CSV files into lg_* Supabase tables via excel_processor.
"""
import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
from app.industries.logistics.utils.excel_processor import process_file, detect_table_from_filename
from app.industries.logistics.services.scoring_service import rescore_all_for_user
from app.industries.logistics.services.insight_engine_service import invalidate_all_insights

logger = logging.getLogger(__name__)
router = APIRouter()

# Path to the bundled sample dataset
SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Ordered list of sample files to load (dependency order matters for FK-ish relationships)
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

    # Also record in data_files for the DataUploadPage listing
    try:
        storage_path = f"logistics/{uid}/{file.filename}"
        supabase.storage.from_("data-files").upload(
            storage_path, content, {"content-type": file.content_type or "application/octet-stream", "upsert": "true"}
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
async def load_sample_data(current_user=Depends(get_current_user)):
    """
    Load the bundled sample logistics dataset for the current user.
    Idempotent — if sample files are already loaded, returns the existing records
    without re-processing (avoids duplicating rows in lg_* tables).
    Also writes data_files records so files appear in the Data Upload page.
    """
    uid = str(current_user.id)

    if not SAMPLE_DATA_DIR.exists():
        raise HTTPException(status_code=500, detail=f"Sample dataset directory not found: {SAMPLE_DATA_DIR}")

    # Idempotency check — if sample records already exist for this user, return early
    try:
        all_records = supabase.table("data_files").select("*").eq("user_id", uid).execute().data or []
        sample_records = [f for f in all_records if (f.get("column_mapping") or {}).get("__sample__")]
        if sample_records:
            total = sum(r.get("row_count") or 0 for r in sample_records)
            return {
                "success": True,
                "message": f"Sample data already loaded ({len(sample_records)} files, {total} rows).",
                "results": [
                    {"file": r["file_name"], "table": (r.get("column_mapping") or {}).get("__table__"),
                     "rows_inserted": r.get("row_count") or 0, "success": True}
                    for r in sample_records
                ],
            }
    except Exception:
        pass

    results = []
    for filename in SAMPLE_FILES_ORDER:
        filepath = SAMPLE_DATA_DIR / filename
        if not filepath.exists():
            results.append({"file": filename, "skipped": True, "reason": "File not found"})
            continue
        try:
            content = filepath.read_bytes()
            # Limit to 500 rows per file — enough for a rich demo, avoids processing
            # tens-of-thousands of rows. skip_auto_risk because shipment_risk_snapshots.xlsx
            # is loaded separately and would overwrite auto-computed snapshots anyway.
            result = process_file(
                content, filename, uid, supabase,
                max_rows=500, skip_auto_risk=True,
            )
            rows_inserted = result.get("rows_inserted", 0)
            table_name = result.get("table")
            results.append({
                "file": filename,
                "table": table_name,
                "rows_inserted": rows_inserted,
                "success": result.get("success", False),
                "error": result.get("error"),
            })

            # Write a data_files record so the file appears in the Data Upload page
            if result.get("success"):
                try:
                    record = {
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
                    }
                    existing_file = supabase.table("data_files").select("id") \
                        .eq("user_id", uid).eq("file_name", filename).execute()
                    if existing_file.data:
                        supabase.table("data_files").update(record) \
                            .eq("id", existing_file.data[0]["id"]).execute()
                    else:
                        supabase.table("data_files").insert(record).execute()
                except Exception as meta_err:
                    logger.warning("Could not write data_files record for %s: %s", filename, meta_err)

        except Exception as e:
            results.append({"file": filename, "success": False, "error": str(e)})

    total_inserted = sum(r.get("rows_inserted", 0) for r in results)
    successful = [r for r in results if r.get("success")]

    # Run the proper 13-function scoring engine over all shipments
    rescore_result = {"success": 0, "failed": 0, "total": 0}
    try:
        rescore_result = rescore_all_for_user(uid)
        invalidate_all_insights(uid)
        logger.info("Rescored uid=%s: %s", uid, rescore_result)
    except Exception as score_err:
        logger.warning("Post-load rescore failed for uid=%s: %s", uid, score_err)

    return {
        "success": True,
        "message": (
            f"Sample data loaded: {len(successful)}/{len(SAMPLE_FILES_ORDER)} files processed, "
            f"{total_inserted} rows inserted. "
            f"{rescore_result['success']} shipments rescored."
        ),
        "results": results,
        "rescore": rescore_result,
    }


@router.get("/config")
async def get_upload_config(current_user=Depends(get_current_user)):
    """Return metadata about the upload system."""
    return {
        "data": {
            "supported_tables": list(detect_table_from_filename.__code__.co_consts),
            "sample_data_available": SAMPLE_DATA_DIR.exists(),
            "supported_formats": [".xlsx", ".xls", ".csv"],
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
