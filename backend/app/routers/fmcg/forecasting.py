from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from app.services.fmcg.forecast_service import (
    parse_file_to_dataframe,
    get_skus_from_dataframe,
    run_all_skus_forecast,
    run_forecast_for_sku,
    generate_forecast,
)
from datetime import datetime
import pandas as pd

router = APIRouter()


# ─── DB persistence helpers ──────────────────────────────────────────────────

def _persist_demand_history(uid: str, results: dict):
    """Save per-SKU historical data + All Products aggregate (with forecast) to demand_history."""
    try:
        hist_rows = []   # units only — always safe to insert
        fc_rows = []     # forecast future — separate batch so failure is isolated

        for sku_name, result in results.items():
            if result.get("error"):
                continue

            # Historical actual demand — no forecast field to avoid column-missing errors
            for point in result.get("historical", []):
                date = point.get("date")
                actual = point.get("actual")
                if date and actual is not None:
                    hist_rows.append({
                        "user_id": uid,
                        "date": date,
                        "sku": sku_name,
                        "units": int(actual),
                    })

            # Future forecast rows — only for All Products aggregate
            if sku_name == "All Products":
                for point in result.get("forecast", []):
                    date = point.get("date")
                    fc = point.get("forecast")
                    if date and fc is not None:
                        fc_rows.append({
                            "user_id": uid,
                            "date": date,
                            "sku": "All Products",
                            "units": 0,
                            "forecast": int(fc),
                        })

        if not hist_rows:
            return

        # Clear existing data and insert historical rows
        supabase.table("demand_history").delete().eq("user_id", uid).execute()
        for i in range(0, len(hist_rows), 500):
            supabase.table("demand_history").insert(hist_rows[i:i + 500]).execute()

        # Insert forecast rows separately — silently skip if forecast column missing
        if fc_rows:
            try:
                for i in range(0, len(fc_rows), 500):
                    supabase.table("demand_history").insert(fc_rows[i:i + 500]).execute()
            except Exception:
                pass  # forecast column may not exist in older DB — historical data is safe
    except Exception:
        pass


# ─── Request model ───────────────────────────────────────────────────────────

class ForecastRunRequest(BaseModel):
    file_id: str
    horizon: int = 30       # days to forecast (7 / 30 / 90)
    sku: str | None = None  # None = all SKUs


# ─── Shared helper ───────────────────────────────────────────────────────────

def _download_and_parse(file_id: str, uid: str) -> pd.DataFrame:
    """Fetch file metadata, download bytes from Storage, parse into DataFrame."""
    meta_resp = (
        supabase.table("data_files")
        .select("*")
        .eq("id", file_id)
        .eq("user_id", uid)
        .single()
        .execute()
    )
    if not meta_resp.data:
        raise HTTPException(status_code=404, detail="File not found or access denied")

    meta = meta_resp.data
    storage_path = meta.get("storage_path")
    column_mapping = meta.get("column_mapping") or {}
    filename = meta.get("file_name", "file.csv")

    if not storage_path:
        raise HTTPException(status_code=400, detail="File has no storage path recorded")

    file_bytes = supabase.storage.from_("data-files").download(storage_path)
    return parse_file_to_dataframe(file_bytes, filename, column_mapping)


# ─── NEW: Run XGBoost forecast from an uploaded file ─────────────────────────

@router.post("/run")
async def run_forecast(body: ForecastRunRequest, current_user=Depends(get_current_user)):
    """
    Main ML forecasting endpoint.
    Downloads the user's uploaded CSV/XLSX from Supabase Storage,
    runs XGBoost per SKU (or just the requested SKU), and returns
    structured results ready for the ForecastingPage chart.
    """
    uid = str(current_user.id)
    horizon = max(7, min(body.horizon, 90))

    try:
        df = _download_and_parse(body.file_id, uid)

        if body.sku and body.sku != "All Products":
            # Single-SKU request
            df_sku = (
                df[df["sku"] == body.sku][["date", "units"]]
                .groupby("date", as_index=False)["units"]
                .sum()
            )
            result = run_forecast_for_sku(df_sku, horizon)
            if result.get("error"):
                raise HTTPException(status_code=422, detail=result["error"])
            return {
                "skus": [body.sku],
                "results": {body.sku: result},
            }

        # All-SKUs request (default)
        run_result = run_all_skus_forecast(df, horizon)
        # Persist historical data to demand_history for dashboard (best-effort)
        _persist_demand_history(uid, run_result.get("results", {}))
        return run_result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")


# ─── NEW: List SKUs available in an uploaded file ─────────────────────────────

@router.get("/file-skus")
async def get_file_skus(
    file_id: str = Query(...),
    current_user=Depends(get_current_user),
):
    """
    Quickly parse an uploaded file and return the list of distinct SKUs
    (with 'All Products' prepended).  Used to populate the SKU dropdown
    before running a full forecast.
    """
    uid = str(current_user.id)
    try:
        df = _download_and_parse(file_id, uid)
        return {"skus": get_skus_from_dataframe(df)}
    except HTTPException:
        raise
    except Exception:
        return {"skus": ["All Products"]}


# ─── Legacy: forecast from demand_history table ───────────────────────────────

@router.get("/")
async def get_forecast_legacy(
    sku: str | None = Query(None),
    periods: int = Query(30, ge=7, le=90),
    current_user=Depends(get_current_user),
):
    """Forecast using data in the demand_history Supabase table (legacy path)."""
    uid = str(current_user.id)
    try:
        q = supabase.table("demand_history").select("date, units, sku").eq("user_id", uid).order("date")
        if sku:
            q = q.eq("sku", sku)
        rows = q.execute().data or []

        historical = [{"date": r["date"], "quantity": r["units"]} for r in rows if r.get("units") is not None]
        forecast = generate_forecast(historical, periods)

        return {"sku": sku or "All", "historical": historical[-60:], "forecast": forecast}
    except Exception:
        return {"sku": sku or "All", "historical": [], "forecast": []}


@router.get("/products")
async def get_products(current_user=Depends(get_current_user)):
    """List distinct SKUs from demand_history table."""
    uid = str(current_user.id)
    try:
        resp = supabase.table("demand_history").select("sku, product_name").eq("user_id", uid).execute()
        seen = {}
        for r in resp.data or []:
            sku = r.get("sku")
            if sku and sku not in seen:
                seen[sku] = r.get("product_name") or sku
        return [{"sku": k, "product_name": v} for k, v in seen.items()]
    except Exception:
        return []


@router.get("/seasonality")
async def get_seasonality(current_user=Depends(get_current_user)):
    """Day-of-week demand factors from demand_history table."""
    uid = str(current_user.id)
    try:
        resp = supabase.table("demand_history").select("date, units").eq("user_id", uid).execute()
        rows = resp.data or []
        if not rows:
            return []

        dow_totals = [0.0] * 7
        dow_counts = [0] * 7
        for r in rows:
            try:
                dow = datetime.strptime(r["date"], "%Y-%m-%d").weekday()
                dow_totals[dow] += r.get("units") or 0
                dow_counts[dow] += 1
            except Exception:
                continue

        avg_totals = [dow_totals[i] / dow_counts[i] if dow_counts[i] else 0 for i in range(7)]
        overall_avg = sum(avg_totals) / 7 if any(avg_totals) else 1
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return [{"day": days[i], "factor": round(avg_totals[i] / overall_avg, 3)} for i in range(7)]
    except Exception:
        return []
