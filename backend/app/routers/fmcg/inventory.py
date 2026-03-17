from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase

router = APIRouter()


@router.get("/overview")
async def get_overview(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("inventory_items").select("status").eq("user_id", uid).execute()
        items = resp.data or []
        counts = {"optimal": 0, "low_stock": 0, "stockout": 0, "overstock": 0}
        for item in items:
            s = item.get("status", "optimal")
            if s in counts:
                counts[s] += 1
        total = sum(counts.values()) or 1
        health_score = round((counts["optimal"] / total) * 100)
        return {**counts, "total": sum(counts.values()), "health_score": health_score}
    except Exception:
        return {"optimal": 0, "low_stock": 0, "stockout": 0, "overstock": 0, "total": 0, "health_score": 0}


@router.get("/warehouses")
async def get_warehouses(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("warehouses").select("*").eq("user_id", uid).order("name").execute()
        return resp.data or []
    except Exception:
        return []


@router.get("/warehouses/{warehouse_id}")
async def get_warehouse(warehouse_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("warehouses").select("*").eq("id", warehouse_id).eq("user_id", uid).single().execute()
        return resp.data
    except Exception:
        raise HTTPException(status_code=404, detail="Warehouse not found")


@router.get("/reorder-queue")
async def get_reorder_queue(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("inventory_items")
            .select("sku, product_name, current_stock, daily_avg_demand, days_left, status, warehouse_name")
            .eq("user_id", uid)
            .in_("status", ["stockout", "low_stock"])
            .order("days_left")
            .limit(50)
            .execute()
        )
        rows = resp.data or []
        result = []
        for r in rows:
            days_left = r.get("days_left")
            if days_left is None:
                daily_avg = r.get("daily_avg_demand") or 1
                days_left = round((r.get("current_stock") or 0) / daily_avg, 1)

            if days_left <= 1:
                urgency = "critical"
            elif days_left <= 3:
                urgency = "critical"
            elif days_left <= 7:
                urgency = "high"
            else:
                urgency = "medium"

            result.append({
                "sku": r.get("sku"),
                "product": r.get("product_name") or r.get("sku"),
                "current_stock": r.get("current_stock", 0),
                "daily_avg": r.get("daily_avg_demand", 0),
                "days_left": days_left,
                "urgency": urgency,
                "warehouse": r.get("warehouse_name"),
            })
        return result
    except Exception:
        return []


@router.get("/abc-analysis")
async def get_abc_analysis(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("inventory_items").select("abc_category").eq("user_id", uid).execute()
        items = resp.data or []
        counts = {"A": 0, "B": 0, "C": 0}
        for item in items:
            cat = item.get("abc_category") or "C"
            if cat in counts:
                counts[cat] += 1
        return [
            {"category": "A", "count": counts["A"], "revenue_pct": 80, "description": "Top 20% SKUs"},
            {"category": "B", "count": counts["B"], "revenue_pct": 15, "description": "Next 30% SKUs"},
            {"category": "C", "count": counts["C"], "revenue_pct": 5, "description": "Remaining 50%"},
        ]
    except Exception:
        return [
            {"category": "A", "count": 0, "revenue_pct": 80, "description": "Top 20% SKUs"},
            {"category": "B", "count": 0, "revenue_pct": 15, "description": "Next 30% SKUs"},
            {"category": "C", "count": 0, "revenue_pct": 5, "description": "Remaining 50%"},
        ]
