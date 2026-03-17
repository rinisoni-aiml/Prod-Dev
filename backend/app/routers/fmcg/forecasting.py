from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from app.services.fmcg.forecast_service import generate_forecast
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/")
async def get_forecast(
    sku: str | None = Query(None),
    periods: int = Query(30, ge=7, le=90),
    current_user=Depends(get_current_user),
):
    """Generate forecast from demand_history table for a given SKU."""
    uid = str(current_user.id)
    try:
        q = supabase.table("demand_history").select("date, units, sku").eq("user_id", uid).order("date")
        if sku:
            q = q.eq("sku", sku)
        resp = q.execute()
        rows = resp.data or []

        historical = [{"date": r["date"], "quantity": r["units"]} for r in rows if r.get("units") is not None]
        forecast = generate_forecast(historical, periods)

        return {
            "sku": sku or "All",
            "historical": historical[-60:],  # last 60 days
            "forecast": forecast,
        }
    except Exception:
        return {"sku": sku or "All", "historical": [], "forecast": []}


@router.get("/products")
async def get_products(current_user=Depends(get_current_user)):
    """Return list of distinct SKUs with data available for forecasting."""
    uid = str(current_user.id)
    try:
        resp = supabase.table("demand_history").select("sku, product_name").eq("user_id", uid).execute()
        rows = resp.data or []
        seen = {}
        for r in rows:
            sku = r.get("sku")
            if sku and sku not in seen:
                seen[sku] = r.get("product_name") or sku
        return [{"sku": k, "product_name": v} for k, v in seen.items()]
    except Exception:
        return []


@router.get("/seasonality")
async def get_seasonality(current_user=Depends(get_current_user)):
    """Return day-of-week demand factors."""
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
