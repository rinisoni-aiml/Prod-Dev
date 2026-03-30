from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
from app.industries.fmcg.services.inventory_optimizer import (
    parse_file_for_optimization,
    run_inventory_optimization,
)
from datetime import datetime, timezone

router = APIRouter()


# ─── DB persistence helpers ───────────────────────────────────────────────────

STATUS_MAP = {
    "stockout": "stockout",
    "order_now": "low_stock",
    "watch": "low_stock",
    "overstock": "overstock",
    "ok": "optimal",
}


def _persist_inventory_items(uid: str, by_sku: list, by_warehouse: list = None):
    """Save inventory optimization results to inventory_items and warehouses tables."""
    try:
        items = []
        for item in by_sku:
            sku = item.get("sku")
            if not sku:
                continue
            items.append({
                "user_id": uid,
                "sku": sku,
                "product_name": sku,
                "current_stock": int(item.get("current_stock") or 0),
                "reorder_point": int(item.get("reorder_point") or 0),
                "daily_avg_demand": float(item.get("avg_daily_demand") or 0),
                "days_left": float(item.get("days_remaining") or 0) if item.get("days_remaining") is not None else None,
                "status": STATUS_MAP.get(item.get("status", "ok"), "optimal"),
            })
        if items:
            supabase.table("inventory_items").delete().eq("user_id", uid).execute()
            supabase.table("inventory_items").insert(items).execute()
    except Exception:
        pass

    # Populate warehouses table
    if by_warehouse:
        try:
            wh_rows = []
            for wh in by_warehouse:
                wh_name = wh.get("warehouse")
                if not wh_name:
                    continue
                skus = wh.get("skus", [])
                summary = wh.get("summary", {})
                total_skus = len(skus)
                stockouts = summary.get("stockout", 0)
                fill_rate = round((total_skus - stockouts) / max(total_skus, 1) * 100, 1)
                wh_status = "critical" if stockouts > 0 else ("warning" if summary.get("order_now", 0) > 0 else "good")
                wh_rows.append({
                    "user_id": uid,
                    "name": wh_name,
                    "total_skus": total_skus,
                    "stockouts": stockouts,
                    "fill_rate": fill_rate,
                    "status": wh_status,
                })
            if wh_rows:
                supabase.table("warehouses").delete().eq("user_id", uid).execute()
                supabase.table("warehouses").insert(wh_rows).execute()
        except Exception:
            pass

    # Auto-generate alerts for critical inventory issues
    try:
        alerts = []
        for item in by_sku:
            status = item.get("status")
            sku = item.get("sku", "")
            days = item.get("days_remaining", 0) or 0
            if status == "stockout":
                alerts.append({
                    "user_id": uid,
                    "alert_type": "stockout",
                    "severity": "critical",
                    "message": f"SKU {sku} is out of stock — immediate replenishment required.",
                    "sku": sku,
                    "is_resolved": False,
                })
            elif status == "order_now":
                alerts.append({
                    "user_id": uid,
                    "alert_type": "low_stock",
                    "severity": "high",
                    "message": f"SKU {sku} needs immediate reorder ({round(days, 1)}d of stock remaining).",
                    "sku": sku,
                    "is_resolved": False,
                })
        if alerts:
            # Clear old auto-generated inventory alerts before inserting new ones
            supabase.table("alerts") \
                .delete() \
                .eq("user_id", uid) \
                .in_("alert_type", ["stockout", "low_stock"]) \
                .execute()
            supabase.table("alerts").insert(alerts).execute()
    except Exception:
        pass


# ─── Inventory optimization ───────────────────────────────────────────────────

class OptimizeRequest(BaseModel):
    file_id: str
    lead_time_days: int = 7          # supplier lead time in days
    service_level: float = 0.95     # 0.90, 0.95, or 0.99
    order_cost: float = 0.0         # $ cost per order (optional, used in EOQ)
    holding_cost_pct: float = 0.0   # fraction of inventory value as annual holding cost


@router.post("/optimize")
async def optimize_inventory(body: OptimizeRequest, current_user=Depends(get_current_user)):
    """
    Run inventory optimization (Safety Stock, ROP, EOQ) from an uploaded file.
    Returns per-SKU and per-warehouse recommendations.
    """
    uid = str(current_user.id)

    # Validate params
    if body.service_level not in (0.90, 0.95, 0.99):
        body.service_level = 0.95
    if body.lead_time_days < 1:
        raise HTTPException(status_code=400, detail="lead_time_days must be at least 1")

    try:
        # Fetch file metadata
        meta_resp = (
            supabase.table("data_files")
            .select("*")
            .eq("id", body.file_id)
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

        # Download and parse
        file_bytes = supabase.storage.from_("data-files").download(storage_path)
        df = parse_file_for_optimization(file_bytes, filename, column_mapping)

        # Run optimization
        result = run_inventory_optimization(
            df=df,
            lead_time_days=body.lead_time_days,
            service_level=body.service_level,
            order_cost=body.order_cost,
            holding_cost_pct=body.holding_cost_pct,
        )
        # Persist results to inventory_items, warehouses, and alerts (best-effort)
        _persist_inventory_items(uid, result.get("by_sku", []), result.get("by_warehouse", []))

        # Store full optimization result for cross-session persistence
        try:
            supabase.table("optimization_runs").upsert({
                "user_id": uid,
                "file_id": body.file_id,
                "params": result.get("params"),
                "summary": result.get("summary"),
                "by_sku": result.get("by_sku"),
                "by_warehouse": result.get("by_warehouse"),
                "has_warehouse_data": result.get("has_warehouse_data", False),
                "has_stock_data": result.get("has_stock_data", False),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="user_id").execute()
        except Exception:
            pass

        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.get("/latest-optimization")
async def get_latest_optimization(current_user=Depends(get_current_user)):
    """Return the most recent inventory optimization result for this user."""
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("optimization_runs")
            .select("*")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if resp.data:
            return resp.data
        return None
    except Exception:
        return None


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
