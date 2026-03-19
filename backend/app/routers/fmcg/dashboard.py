from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/data-status")
async def get_data_status(current_user=Depends(get_current_user)):
    """
    Returns whether the user has uploaded files and whether analysis results exist.
    Used by the dashboard to decide whether to trigger auto-analysis.
    """
    uid = str(current_user.id)
    try:
        # Check data files — get latest of each purpose
        files_resp = supabase.table("data_files").select("id, column_mapping, created_at") \
            .eq("user_id", uid).order("created_at", desc=True).limit(50).execute()
        files = files_resp.data or []

        latest_forecast_file = None
        latest_inventory_file = None
        for f in files:
            cm = f.get("column_mapping") or {}
            purpose = cm.get("__purpose__", "forecasting")
            if purpose == "forecasting" and not latest_forecast_file:
                latest_forecast_file = f["id"]
            if purpose == "inventory" and not latest_inventory_file:
                latest_inventory_file = f["id"]
        # Any untagged file can serve as fallback for both
        if not latest_forecast_file and files:
            latest_forecast_file = files[0]["id"]
        if not latest_inventory_file and files:
            latest_inventory_file = files[0]["id"]

        # Check if results already exist
        dh_resp = supabase.table("demand_history").select("id").eq("user_id", uid).limit(1).execute()
        inv_resp = supabase.table("inventory_items").select("id").eq("user_id", uid).limit(1).execute()

        return {
            "has_files": len(files) > 0,
            "has_demand_data": len(dh_resp.data or []) > 0,
            "has_inventory_data": len(inv_resp.data or []) > 0,
            "latest_forecast_file_id": latest_forecast_file,
            "latest_inventory_file_id": latest_inventory_file,
        }
    except Exception:
        return {
            "has_files": False,
            "has_demand_data": False,
            "has_inventory_data": False,
            "latest_forecast_file_id": None,
            "latest_inventory_file_id": None,
        }


@router.post("/auto-analyze")
async def auto_analyze(current_user=Depends(get_current_user)):
    """
    Run forecast + inventory optimization on the user's latest uploaded files.
    Called by the dashboard when data files exist but no results are present yet.
    Returns a summary of what was run.
    """
    uid = str(current_user.id)
    from app.services.fmcg.forecast_service import (
        parse_file_to_dataframe, run_all_skus_forecast,
    )
    from app.services.fmcg.inventory_optimizer import (
        parse_file_for_optimization, run_inventory_optimization,
    )
    from app.routers.fmcg.forecasting import _persist_demand_history
    from app.routers.fmcg.inventory import _persist_inventory_items, STATUS_MAP
    from datetime import timezone

    ran_forecast = False
    ran_inventory = False
    forecast_result = None
    inventory_result = None
    errors = []

    try:
        # Get latest files
        files_resp = supabase.table("data_files").select("*") \
            .eq("user_id", uid).order("created_at", desc=True).limit(20).execute()
        files = files_resp.data or []

        latest_forecast_file = None
        latest_inventory_file = None
        for f in files:
            cm = f.get("column_mapping") or {}
            purpose = cm.get("__purpose__", "forecasting")
            if purpose in ("forecasting", "") and not latest_forecast_file:
                latest_forecast_file = f
            if purpose == "inventory" and not latest_inventory_file:
                latest_inventory_file = f
        if not latest_forecast_file and files:
            latest_forecast_file = files[0]
        if not latest_inventory_file and files:
            latest_inventory_file = files[0]

        # ── Run forecast ──────────────────────────────────────────────────────
        if latest_forecast_file:
            try:
                fb = supabase.storage.from_("data-files").download(latest_forecast_file["storage_path"])
                df = parse_file_to_dataframe(fb, latest_forecast_file["file_name"],
                                              latest_forecast_file.get("column_mapping") or {})
                run_result = run_all_skus_forecast(df, 30)
                _persist_demand_history(uid, run_result.get("results", {}))
                forecast_result = {
                    "skus": run_result.get("skus", []),
                    "results": run_result.get("results", {}),
                }
                ran_forecast = True
            except Exception as e:
                errors.append(f"forecast: {str(e)}")

        # ── Run inventory optimization ────────────────────────────────────────
        if latest_inventory_file:
            try:
                ib = supabase.storage.from_("data-files").download(latest_inventory_file["storage_path"])
                df_inv = parse_file_for_optimization(ib, latest_inventory_file["file_name"],
                                                      latest_inventory_file.get("column_mapping") or {})
                inv_result = run_inventory_optimization(df=df_inv, lead_time_days=7,
                                                         service_level=0.95, order_cost=0, holding_cost_pct=0)
                _persist_inventory_items(uid, inv_result.get("by_sku", []), inv_result.get("by_warehouse", []))
                # Store in optimization_runs (best-effort)
                try:
                    from datetime import timezone as tz
                    supabase.table("optimization_runs").upsert({
                        "user_id": uid,
                        "file_id": latest_inventory_file["id"],
                        "params": inv_result.get("params"),
                        "summary": inv_result.get("summary"),
                        "by_sku": inv_result.get("by_sku"),
                        "by_warehouse": inv_result.get("by_warehouse"),
                        "has_warehouse_data": inv_result.get("has_warehouse_data", False),
                        "has_stock_data": inv_result.get("has_stock_data", False),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }, on_conflict="user_id").execute()
                except Exception:
                    pass
                inventory_result = inv_result
                ran_inventory = True
            except Exception as e:
                errors.append(f"inventory: {str(e)}")

    except Exception as e:
        errors.append(f"setup: {str(e)}")

    return {
        "ran_forecast": ran_forecast,
        "ran_inventory": ran_inventory,
        "forecast_result": forecast_result,
        "inventory_result": inventory_result,
        "errors": errors,
    }


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
    """Return daily demand aggregated from demand_history (all SKUs summed by date)."""
    uid = str(current_user.id)
    try:
        # Fetch ALL demand history rows for this user (no date filter — data may be historical)
        # Try with forecast column; fall back gracefully if column doesn't exist yet
        try:
            resp = supabase.table("demand_history") \
                .select("date, sku, units, forecast") \
                .eq("user_id", uid) \
                .order("date") \
                .execute()
        except Exception:
            resp = supabase.table("demand_history") \
                .select("date, sku, units") \
                .eq("user_id", uid) \
                .order("date") \
                .execute()

        rows = resp.data or []
        if rows:
            # Aggregate all SKUs by date
            date_agg: dict = {}
            for r in rows:
                d = r["date"]
                if d not in date_agg:
                    date_agg[d] = {"date": d, "units": 0, "forecast": None}
                units = r.get("units") or 0
                date_agg[d]["units"] += units
                if r.get("forecast") is not None:
                    date_agg[d]["forecast"] = (date_agg[d]["forecast"] or 0) + r["forecast"]

            sorted_dates = sorted(date_agg.keys())
            # Return last `days` historical points + any forecast points beyond them
            hist_dates = [d for d in sorted_dates if date_agg[d]["units"] > 0]
            fc_dates = [d for d in sorted_dates if date_agg[d]["units"] == 0 and date_agg[d]["forecast"]]
            result_dates = hist_dates[-days:] + fc_dates
            return [date_agg[d] for d in result_dates]
    except Exception:
        pass

    # Empty scaffolding so chart renders gracefully
    base = datetime.utcnow() - timedelta(days=days)
    return [
        {"date": (base + timedelta(days=i)).strftime("%Y-%m-%d"), "units": 0, "forecast": None}
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
