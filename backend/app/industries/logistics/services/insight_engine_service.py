"""
Insights Engine: Generates business insights from logistics data using LLM.
Adapted for Supabase lg_* tables with user_id scoping.
LLM logic, caching, and system prompt copied exactly from logistics-ai-main.
"""
import logging
import os
import time
from threading import Lock
from typing import Optional

from app.industries.logistics.utils.llm_init import get_llm
from app.shared.utils.supabase_client import supabase

logger = logging.getLogger(__name__)

MODEL = "llama-3.1-8b-instant"
CACHE_TTL_SECONDS = 3600  # 1 hour

_INSIGHT_CACHE: dict[str, tuple[str, float]] = {}
_INSIGHT_CACHE_LOCK = Lock()

# System prompt copied exactly from logistics-ai-main
INSIGHT_SYSTEM_PROMPT = """
You are a senior logistics analyst writing executive insights.

STRICT RULES:
- Use ONLY the data provided. Never invent numbers.
- Write 2-3 sentences maximum.
- Be direct. State what the number means for the business.
- No bullet points. No headers. No HTML. No markdown formatting.
- No filler phrases like "Based on the data" or "It appears that".
- If data is empty or all zeros, say "Insufficient data to generate insight."
- Always mention at least one specific number from the data.
"""


def _cache_key(uid: str, insight_name: str) -> str:
    return f"insight_cache_{uid}_{insight_name}"


def _is_cache_valid(uid: str, insight_name: str) -> bool:
    key = _cache_key(uid, insight_name)
    with _INSIGHT_CACHE_LOCK:
        entry = _INSIGHT_CACHE.get(key)
    if not entry:
        return False
    _, ts = entry
    return (time.time() - ts) < CACHE_TTL_SECONDS


def _get_cached(uid: str, insight_name: str) -> Optional[str]:
    key = _cache_key(uid, insight_name)
    if _is_cache_valid(uid, insight_name):
        with _INSIGHT_CACHE_LOCK:
            entry = _INSIGHT_CACHE.get(key)
        if entry:
            return entry[0]
    return None


def _set_cache(uid: str, insight_name: str, value: str):
    key = _cache_key(uid, insight_name)
    with _INSIGHT_CACHE_LOCK:
        _INSIGHT_CACHE[key] = (value, time.time())


def _run_supabase_query(uid: str, table: str, select: str, **filters) -> list[dict]:
    """Execute a Supabase query and return list of dicts."""
    try:
        q = supabase.table(table).select(select).eq("user_id", uid)
        for col, val in filters.items():
            q = q.eq(col, val)
        resp = q.execute()
        return resp.data or []
    except Exception as exc:
        logger.warning("Supabase query failed on %s: %s", table, exc)
        return []


def _call_llm(data_summary: str, context: str) -> str:
    """Single LLM call for insight generation. Copied from logistics-ai-main."""
    try:
        llm = get_llm(model=MODEL, temperature=0.3)
        response = llm.invoke([
            {"role": "system", "content": INSIGHT_SYSTEM_PROMPT},
            {"role": "user", "content": f"Context: {context}\n\nData:\n{data_summary}"}
        ])
        return response.content.strip()
    except Exception as e:
        if "429" in str(e):
            return "Insight temporarily unavailable due to rate limit. Refresh in 1 minute."
        return "Insight unavailable."


def _format_rows(rows: list[dict]) -> str:
    if not rows:
        return "No data available."
    return "\n".join(str(row) for row in rows[:10])


# ─── Insight Functions ─────────────────────────────────────────────────────────

def get_shipment_overview_insight(uid: str) -> str:
    name = "shipment_overview"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    rows = _run_supabase_query(uid, "lg_shipments", "shipment_status")
    if rows:
        total = len(rows)
        delayed = sum(1 for r in rows if r.get("shipment_status") == "DELAYED")
        in_transit = sum(1 for r in rows if r.get("shipment_status") == "IN_TRANSIT")
        delivered = sum(1 for r in rows if r.get("shipment_status") == "DELIVERED")
        delay_rate = round(delayed * 100.0 / max(total, 1), 1)
        summary = [{
            "total_shipments": total,
            "delayed": delayed,
            "in_transit": in_transit,
            "delivered": delivered,
            "delay_rate_pct": delay_rate,
        }]
    else:
        summary = []

    insight = _call_llm(_format_rows(summary), "Overall shipment performance for the last 30 days")
    _set_cache(uid, name, insight)
    return insight


def get_vendor_risk_insight(uid: str) -> str:
    name = "vendor_risk"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    # Fetch vendor performance metrics, join with vendor names
    try:
        vpm_resp = (
            supabase.table("lg_vendor_performance_metrics")
            .select("vendor_id, on_time_percentage, delay_rate_percentage, claim_ratio_percentage, total_shipments")
            .eq("user_id", uid)
            .eq("performance_window", "30D")
            .order("delay_rate_percentage", desc=True)
            .limit(5)
            .execute()
        )
        vpm_rows = vpm_resp.data or []

        # Enrich with vendor names
        vendor_ids = [r["vendor_id"] for r in vpm_rows if r.get("vendor_id")]
        vendor_names: dict[str, str] = {}
        if vendor_ids:
            vnd_resp = (
                supabase.table("lg_vendors")
                .select("vendor_id, vendor_name")
                .eq("user_id", uid)
                .in_("vendor_id", vendor_ids)
                .execute()
            )
            vendor_names = {r["vendor_id"]: r["vendor_name"] for r in (vnd_resp.data or [])}

        rows = [
            {
                "vendor_name": vendor_names.get(r["vendor_id"], r["vendor_id"]),
                "on_time_percentage": r.get("on_time_percentage"),
                "delay_rate_percentage": r.get("delay_rate_percentage"),
                "claim_ratio_percentage": r.get("claim_ratio_percentage"),
                "total_shipments": r.get("total_shipments"),
            }
            for r in vpm_rows
        ]
    except Exception:
        rows = []

    insight = _call_llm(_format_rows(rows), "Top 5 vendors with highest delay rates in last 30 days")
    _set_cache(uid, name, insight)
    return insight


def get_compliance_insight(uid: str) -> str:
    name = "compliance"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    from datetime import date
    today = date.today().isoformat()

    try:
        trucks = _run_supabase_query(uid, "lg_trucks",
            "insurance_expiry_date, fitness_expiry_date, registration_expiry_date, truck_status")
        drivers = _run_supabase_query(uid, "lg_drivers", "license_expiry_date, driver_status")

        active_trucks = [t for t in trucks if t.get("truck_status") == "ACTIVE"]
        active_drivers = [d for d in drivers if d.get("driver_status") == "ACTIVE"]

        ins_expired = sum(1 for t in active_trucks if t.get("insurance_expiry_date") and t["insurance_expiry_date"] < today)
        fit_expired = sum(1 for t in active_trucks if t.get("fitness_expiry_date") and t["fitness_expiry_date"] < today)
        reg_expired = sum(1 for t in active_trucks if t.get("registration_expiry_date") and t["registration_expiry_date"] < today)
        lic_expired = sum(1 for d in active_drivers if d.get("license_expiry_date") and d["license_expiry_date"] < today)

        # Expiring within 30 days
        from datetime import timedelta
        soon = (date.today() + timedelta(days=30)).isoformat()
        ins_soon = sum(1 for t in active_trucks if t.get("insurance_expiry_date") and today <= t["insurance_expiry_date"] <= soon)

        rows = [{
            "insurance_expired": ins_expired,
            "fitness_expired": fit_expired,
            "registration_expired": reg_expired,
            "driver_license_expired": lic_expired,
            "insurance_expiring_soon": ins_soon,
        }]
    except Exception:
        rows = []

    insight = _call_llm(_format_rows(rows), "Fleet and driver compliance status — expired and expiring documents")
    _set_cache(uid, name, insight)
    return insight


def get_financial_risk_insight(uid: str) -> str:
    name = "financial_risk"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    try:
        cost_rows = _run_supabase_query(uid, "lg_shipment_cost_planning_actuals",
            "cost_variance, cost_variance_percentage, detention_cost, penalty_cost")
        fin_rows = _run_supabase_query(uid, "lg_shipment_financials",
            "declared_value, insurance_coverage_value")

        variances = [float(r.get("cost_variance_percentage") or 0) for r in cost_rows]
        overruns = [float(r.get("cost_variance") or 0) for r in cost_rows if (r.get("cost_variance") or 0) > 0]
        penalties = sum(
            float(r.get("detention_cost") or 0) + float(r.get("penalty_cost") or 0)
            for r in cost_rows
        )
        uninsured = sum(
            max(0, float(r.get("declared_value") or 0) - float(r.get("insurance_coverage_value") or 0))
            for r in fin_rows
        )

        rows = [{
            "avg_cost_variance_pct": round(sum(variances) / max(len(variances), 1), 2),
            "total_cost_overrun": round(sum(overruns), 2),
            "total_penalty_detention": round(penalties, 2),
            "shipments_over_budget": len(overruns),
            "total_uninsured_exposure": round(uninsured, 2),
        }]
    except Exception:
        rows = []

    insight = _call_llm(_format_rows(rows), "Financial risk — cost overruns, penalties, and insurance exposure")
    _set_cache(uid, name, insight)
    return insight


def get_operational_risk_insight(uid: str) -> str:
    name = "operational_risk"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    try:
        shipments = _run_supabase_query(uid, "lg_shipments", "route_id, shipment_status, origin_city, destination_city")
        from collections import defaultdict
        route_stats: dict[str, dict] = defaultdict(lambda: {"total": 0, "delayed": 0, "origin": "", "dest": ""})
        for s in shipments:
            rid = str(s.get("route_id") or "unknown")
            route_stats[rid]["total"] += 1
            route_stats[rid]["origin"] = s.get("origin_city", "")
            route_stats[rid]["dest"] = s.get("destination_city", "")
            if s.get("shipment_status") == "DELAYED":
                route_stats[rid]["delayed"] += 1

        rows = sorted([
            {
                "route": f"{v['origin']} → {v['dest']}",
                "total_shipments": v["total"],
                "delayed": v["delayed"],
                "delay_pct": round(v["delayed"] * 100.0 / max(v["total"], 1), 1),
            }
            for v in route_stats.values() if v["total"] > 0
        ], key=lambda x: x["delay_pct"], reverse=True)[:5]
    except Exception:
        rows = []

    insight = _call_llm(_format_rows(rows), "Top 5 highest risk routes by delay percentage")
    _set_cache(uid, name, insight)
    return insight


def get_driver_incident_insight(uid: str) -> str:
    name = "driver_incidents"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    try:
        incidents = _run_supabase_query(uid, "lg_driver_incidents", "driver_id, incident_severity")
        drivers = _run_supabase_query(uid, "lg_drivers", "driver_id, driver_name")
        driver_names = {d["driver_id"]: d["driver_name"] for d in drivers}

        from collections import defaultdict
        stats: dict[str, dict] = defaultdict(lambda: {"total": 0, "high": 0, "medium": 0})
        for inc in incidents:
            did = inc.get("driver_id", "")
            stats[did]["total"] += 1
            sev = (inc.get("incident_severity") or "").upper()
            if sev == "HIGH":
                stats[did]["high"] += 1
            elif sev == "MEDIUM":
                stats[did]["medium"] += 1

        rows = sorted([
            {
                "driver_name": driver_names.get(did, did),
                "total_incidents": v["total"],
                "high_severity": v["high"],
                "medium_severity": v["medium"],
            }
            for did, v in stats.items()
        ], key=lambda x: x["total_incidents"], reverse=True)[:5]
    except Exception:
        rows = []

    insight = _call_llm(_format_rows(rows), "Top 5 drivers by incident count")
    _set_cache(uid, name, insight)
    return insight


def get_market_freight_insight(uid: str) -> str:
    name = "market_freight"
    cached = _get_cached(uid, name)
    if cached:
        return cached

    try:
        from datetime import date, timedelta
        seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
        mfi_resp = (
            supabase.table("lg_market_freight_intelligence")
            .select("route_id, vehicle_type, average_market_rate_per_km, volatility_index, capacity_shortage_index")
            .eq("user_id", uid)
            .gte("date", seven_days_ago)
            .execute()
        )
        mfi_rows = mfi_resp.data or []

        route_ids = list({r["route_id"] for r in mfi_rows if r.get("route_id")})
        route_names: dict = {}
        if route_ids:
            rte_resp = (
                supabase.table("lg_routes")
                .select("route_id, origin_city, destination_city")
                .eq("user_id", uid)
                .in_("route_id", route_ids)
                .execute()
            )
            route_names = {
                str(r["route_id"]): f"{r['origin_city']} → {r['destination_city']}"
                for r in (rte_resp.data or [])
            }

        from collections import defaultdict
        agg: dict = defaultdict(lambda: {"rates": [], "vols": [], "shorts": []})
        for r in mfi_rows:
            key = f"{r.get('route_id')}-{r.get('vehicle_type')}"
            if r.get("average_market_rate_per_km"):
                agg[key]["rates"].append(float(r["average_market_rate_per_km"]))
            if r.get("volatility_index"):
                agg[key]["vols"].append(float(r["volatility_index"]))
            if r.get("capacity_shortage_index"):
                agg[key]["shorts"].append(float(r["capacity_shortage_index"]))

        rows_out = []
        for r in mfi_rows[:5]:
            rid = str(r.get("route_id") or "")
            rows_out.append({
                "route": route_names.get(rid, rid),
                "vehicle_type": r.get("vehicle_type"),
                "avg_rate": round(float(r.get("average_market_rate_per_km") or 0), 2),
                "avg_volatility": round(float(r.get("volatility_index") or 0), 2),
                "avg_shortage": round(float(r.get("capacity_shortage_index") or 0), 2),
            })
    except Exception:
        rows_out = []

    insight = _call_llm(_format_rows(rows_out), "Market freight rate volatility and capacity shortage last 7 days")
    _set_cache(uid, name, insight)
    return insight


def invalidate_all_insights(uid: str):
    """Clear all insight caches for a user. Call when new data is loaded."""
    insight_names = [
        "shipment_overview", "vendor_risk", "compliance",
        "financial_risk", "operational_risk", "driver_incidents", "market_freight",
    ]
    with _INSIGHT_CACHE_LOCK:
        for name in insight_names:
            key = _cache_key(uid, name)
            _INSIGHT_CACHE.pop(key, None)
