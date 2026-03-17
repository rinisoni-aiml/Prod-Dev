from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/kpis")
async def get_kpis(current_user=Depends(get_current_user)):
    """Compute KPIs from real inventory and warehouse data."""
    uid = str(current_user.id)
    try:
        items_resp = supabase.table("inventory_items").select("status, sku").eq("user_id", uid).execute()
        items = items_resp.data or []

        skus = set(i["sku"] for i in items if i.get("sku"))
        optimal = sum(1 for i in items if i.get("status") == "optimal")
        stockout_risk = sum(1 for i in items if i.get("status") in ("stockout", "low_stock"))
        total = len(items) or 1
        health_score = round((optimal / total) * 100)

        wh_resp = supabase.table("warehouses").select("fill_rate").eq("user_id", uid).execute()
        warehouses = wh_resp.data or []
        fill_rates = [w["fill_rate"] for w in warehouses if w.get("fill_rate") is not None]
        avg_fill = round(sum(fill_rates) / len(fill_rates), 1) if fill_rates else 0.0
    except Exception:
        skus, stockout_risk, avg_fill, health_score = set(), 0, 0.0, 0

    return [
        {"label": "Total SKUs Tracked", "value": len(skus), "trend": "+0%", "icon": "Package"},
        {"label": "Stockout Risk SKUs", "value": stockout_risk, "trend": "0", "icon": "AlertTriangle"},
        {"label": "Avg Fill Rate", "value": avg_fill, "trend": "+0%", "suffix": "%", "icon": "Target"},
        {"label": "Inventory Health Score", "value": health_score, "trend": "+0", "suffix": "/100", "icon": "Activity"},
    ]


@router.get("/demand-trend")
async def get_demand_trend(
    days: int = Query(30, ge=7, le=365),
    current_user=Depends(get_current_user),
):
    """Return daily demand from demand_history table (populated on data upload)."""
    uid = str(current_user.id)
    try:
        since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        resp = supabase.table("demand_history") \
            .select("date, units, forecast") \
            .eq("user_id", uid) \
            .gte("date", since) \
            .order("date") \
            .execute()
        if resp.data:
            return resp.data
    except Exception:
        pass

    # Return empty scaffolding so charts render gracefully
    base = datetime.utcnow() - timedelta(days=days)
    return [
        {"date": (base + timedelta(days=i)).strftime("%Y-%m-%d"), "units": 0, "forecast": 0}
        for i in range(days)
    ]


@router.get("/top-skus")
async def get_top_skus(current_user=Depends(get_current_user)):
    """Return top 5 SKUs by units sold (from demand_history or inventory)."""
    uid = str(current_user.id)
    try:
        resp = supabase.table("demand_history") \
            .select("sku, product_name, units") \
            .eq("user_id", uid) \
            .order("units", desc=True) \
            .limit(50) \
            .execute()
        rows = resp.data or []

        # Aggregate by SKU
        agg: dict = {}
        for r in rows:
            k = r.get("sku") or r.get("product_name") or "Unknown"
            agg[k] = agg.get(k, 0) + (r.get("units") or 0)

        top = sorted(agg.items(), key=lambda x: x[1], reverse=True)[:5]
        return [{"name": name, "units_sold": units} for name, units in top]
    except Exception:
        return []


@router.get("/inventory-snapshot")
async def get_inventory_snapshot(current_user=Depends(get_current_user)):
    """Return inventory count breakdown by status."""
    uid = str(current_user.id)
    try:
        resp = supabase.table("inventory_items").select("status").eq("user_id", uid).execute()
        items = resp.data or []
        counts = {"Optimal": 0, "Low Stock": 0, "Stockout": 0, "Overstock": 0}
        status_map = {
            "optimal": "Optimal",
            "low_stock": "Low Stock",
            "stockout": "Stockout",
            "overstock": "Overstock",
        }
        for item in items:
            label = status_map.get(item.get("status", ""), "Optimal")
            counts[label] = counts.get(label, 0) + 1
        return [{"name": k, "value": v} for k, v in counts.items()]
    except Exception:
        return [
            {"name": "Optimal", "value": 0},
            {"name": "Low Stock", "value": 0},
            {"name": "Stockout", "value": 0},
            {"name": "Overstock", "value": 0},
        ]
