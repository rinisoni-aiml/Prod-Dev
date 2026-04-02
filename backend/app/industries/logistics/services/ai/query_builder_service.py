"""
Query builder: All data-fetch functions for views and analytics.
Adapted from logistics-ai-main to use Supabase lg_* tables with user_id scoping.
Scoring weights and risk thresholds copied exactly from logistics-ai-main.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Optional

from app.industries.logistics.config.risk_config import RISK_THRESHOLDS, SCORING_WEIGHTS
from app.shared.utils.supabase_client import supabase

logger = logging.getLogger(__name__)


def _safe_float(v, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except Exception:
        return default


def _q(uid: str, table: str, select: str = "*", limit: int = 50000, **filters) -> list[dict]:
    """Generic Supabase select with user_id filter."""
    try:
        q = supabase.table(table).select(select).eq("user_id", uid).limit(limit)
        for col, val in filters.items():
            q = q.eq(col, val)
        return q.execute().data or []
    except Exception as exc:
        logger.error("Query failed on %s: %s", table, exc)
        return []


# ─── Shipments ─────────────────────────────────────────────────────────────────

def get_shipments(uid: str, limit: int = 50000, status: Optional[str] = None) -> list[dict]:
    try:
        q = (
            supabase.table("lg_shipments")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if status:
            q = q.eq("shipment_status", status)
        return q.execute().data or []
    except Exception as exc:
        logger.error("get_shipments failed: %s", exc)
        return []


def get_shipment_kpis(uid: str) -> dict:
    rows = _q(uid, "lg_shipments", "shipment_id, shipment_status, shipment_value")
    # Also get risk scores
    snap_rows = _q(uid, "lg_shipment_risk_snapshots", "shipment_id, overall_risk_score")
    snap_map = {str(r["shipment_id"]): _safe_float(r.get("overall_risk_score")) for r in snap_rows}

    total = len(rows)
    delivered = sum(1 for r in rows if r.get("shipment_status") == "DELIVERED")
    delayed = sum(1 for r in rows if r.get("shipment_status") == "DELAYED")
    in_transit = sum(1 for r in rows if r.get("shipment_status") == "IN_TRANSIT")
    total_value = sum(_safe_float(r.get("shipment_value")) for r in rows)
    risk_scores = [snap_map.get(str(r["shipment_id"]), 0.0) for r in rows]
    avg_risk = sum(risk_scores) / max(len(risk_scores), 1)

    return {
        "total": total,
        "delivered": delivered,
        "delayed": delayed,
        "in_transit": in_transit,
        "total_value": round(total_value, 2),
        "avg_risk": round(avg_risk, 2),
    }


# ─── Vendors ───────────────────────────────────────────────────────────────────

def get_vendors(uid: str) -> list[dict]:
    vendors = _q(uid, "lg_vendors", "*")
    if not vendors:
        return []

    # Fetch latest vendor performance (30D window)
    vpm_rows = _q(uid, "lg_vendor_performance_metrics",
        "vendor_id, on_time_percentage, delay_rate_percentage, claim_ratio_percentage, total_shipments",
        performance_window="30D")
    vpm_map: dict[str, dict] = {}
    for v in vpm_rows:
        vid = v.get("vendor_id")
        if vid and vid not in vpm_map:
            vpm_map[vid] = v

    # Shipment counts per vendor
    ships = _q(uid, "lg_shipments", "vendor_id")
    ship_counts: dict[str, int] = defaultdict(int)
    for s in ships:
        if s.get("vendor_id"):
            ship_counts[s["vendor_id"]] += 1

    otp_weight = float(SCORING_WEIGHTS.get("otp", 0.4))
    delay_weight = float(SCORING_WEIGHTS.get("delay", 0.3))
    claim_weight = float(SCORING_WEIGHTS.get("claims", 0.3))
    high_threshold = float(RISK_THRESHOLDS.get("HIGH", 80))
    medium_threshold = float(RISK_THRESHOLDS.get("MEDIUM", 60))

    result = []
    for v in vendors:
        vid = v.get("vendor_id")
        perf = vpm_map.get(vid, {})
        otp = _safe_float(perf.get("on_time_percentage"), 75.0)
        delay_rate = _safe_float(perf.get("delay_rate_percentage"), 20.0)
        claim_ratio = _safe_float(perf.get("claim_ratio_percentage"), 5.0)

        otp_risk = max(0.0, min(100.0, 100.0 - otp))
        delay_risk = max(0.0, min(100.0, delay_rate))
        claim_risk = max(0.0, min(100.0, claim_ratio))
        vendor_risk_score = round(
            min(100.0, otp_risk * otp_weight + delay_risk * delay_weight + claim_risk * claim_weight), 2
        )

        level = "low"
        if vendor_risk_score >= high_threshold:
            level = "high"
        elif vendor_risk_score >= medium_threshold:
            level = "medium"

        row = dict(v)
        row.update({
            "total_shipments": ship_counts.get(vid, 0),
            "latest_otp": round(otp, 2),
            "delay_rate": round(delay_rate, 2),
            "claim_ratio": round(claim_ratio, 2),
            "vendor_risk_score": vendor_risk_score,
            "vendor_risk_level": level,
            "on_time_pct": round(otp, 2),
            "vendor_explanation": (
                f"On-time {otp:.1f}% / Delay {delay_rate:.1f}% / Claims {claim_ratio:.1f}% "
                "under active scoring configuration."
            ),
            "vendor_recommendation": (
                "Prioritize load assignment by vendor risk level and monitor delay/claim trend "
                "before next dispatch cycle."
            ),
        })
        result.append(row)

    return result


def get_vendor_metrics(uid: str, vendor_id: Optional[str] = None) -> list[dict]:
    rows = _q(uid, "lg_vendor_performance_metrics", "*") if not vendor_id else \
           _q(uid, "lg_vendor_performance_metrics", "*", vendor_id=vendor_id)
    return rows


# ─── Drivers ───────────────────────────────────────────────────────────────────

def get_drivers(uid: str) -> list[dict]:
    drivers = _q(uid, "lg_drivers", "*")
    incidents = _q(uid, "lg_driver_incidents", "driver_id")
    ships = _q(uid, "lg_shipments", "driver_id, shipment_status")

    inc_counts: dict[str, int] = defaultdict(int)
    for inc in incidents:
        if inc.get("driver_id"):
            inc_counts[inc["driver_id"]] += 1

    trip_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "delayed": 0})
    for s in ships:
        did = s.get("driver_id")
        if did:
            trip_counts[did]["total"] += 1
            if s.get("shipment_status") == "DELAYED":
                trip_counts[did]["delayed"] += 1

    result = []
    for d in drivers:
        did = d.get("driver_id")
        row = dict(d)
        row["incident_count"] = inc_counts.get(did, 0)
        row["total_trips"] = trip_counts[did]["total"]
        row["delayed_trips"] = trip_counts[did]["delayed"]
        result.append(row)

    return result


def get_driver_incidents(uid: str, driver_id: Optional[str] = None) -> list[dict]:
    if driver_id:
        return _q(uid, "lg_driver_incidents", "*", driver_id=driver_id)
    return _q(uid, "lg_driver_incidents", "*")


# ─── Trucks ────────────────────────────────────────────────────────────────────

def get_trucks(uid: str) -> list[dict]:
    trucks = _q(uid, "lg_trucks", "*")
    ships = _q(uid, "lg_shipments", "truck_id, shipment_status")

    trip_counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "delayed": 0})
    for s in ships:
        tid = s.get("truck_id")
        if tid:
            trip_counts[tid]["total"] += 1
            if s.get("shipment_status") == "DELAYED":
                trip_counts[tid]["delayed"] += 1

    result = []
    for t in trucks:
        tid = t.get("truck_id")
        row = dict(t)
        row["total_trips"] = trip_counts[tid]["total"]
        row["delayed_trips"] = trip_counts[tid]["delayed"]
        result.append(row)

    return result


# ─── Financials ────────────────────────────────────────────────────────────────

def get_shipment_financials(uid: str) -> list[dict]:
    fins = _q(uid, "lg_shipment_financials", "*")
    costs = _q(uid, "lg_shipment_cost_planning_actuals",
        "shipment_id, planned_transport_cost, actual_transport_cost, cost_variance, cost_variance_percentage")
    cost_map = {str(r["shipment_id"]): r for r in costs}

    ships = _q(uid, "lg_shipments", "shipment_id, origin_city, destination_city, shipment_value, shipment_status, vendor_id")
    ship_map = {str(r["shipment_id"]): r for r in ships}

    result = []
    for f in fins:
        sid = str(f.get("shipment_id", ""))
        row = dict(f)
        row.update(ship_map.get(sid, {}))
        cost = cost_map.get(sid, {})
        row["planned_transport_cost"] = cost.get("planned_transport_cost")
        row["actual_transport_cost"] = cost.get("actual_transport_cost")
        row["cost_variance"] = cost.get("cost_variance")
        row["cost_variance_percentage"] = cost.get("cost_variance_percentage")
        result.append(row)
    return result


# ─── Risk ──────────────────────────────────────────────────────────────────────

def get_risk_snapshots(uid: str, limit: int = 50000) -> list[dict]:
    try:
        snaps = (
            supabase.table("lg_shipment_risk_snapshots")
            .select("*")
            .eq("user_id", uid)
            .order("calculated_at", desc=True)
            .limit(limit)
            .execute()
            .data or []
        )
        ships = _q(uid, "lg_shipments", "shipment_id, origin_city, destination_city, shipment_status, vendor_id, route_id")
        ship_map = {str(r["shipment_id"]): r for r in ships}
        result = []
        for s in snaps:
            row = dict(s)
            ship = ship_map.get(str(s.get("shipment_id", "")), {})
            row["origin_city"] = ship.get("origin_city")
            row["destination_city"] = ship.get("destination_city")
            row["shipment_status"] = ship.get("shipment_status")
            row["route_id"] = ship.get("route_id")
            result.append(row)
        return result
    except Exception as exc:
        logger.error("get_risk_snapshots failed: %s", exc)
        return []


def get_high_risk_shipments(uid: str) -> list[dict]:
    high_threshold = float(RISK_THRESHOLDS.get("MEDIUM", 60))
    snaps = get_risk_snapshots(uid, limit=50000)
    return [r for r in snaps if _safe_float(r.get("overall_risk_score")) >= high_threshold]


# ─── Cost Planning ─────────────────────────────────────────────────────────────

def get_cost_planning(uid: str) -> list[dict]:
    return _q(uid, "lg_shipment_cost_planning_actuals", "*")


# ─── Market Intelligence ───────────────────────────────────────────────────────

def get_market_intelligence(uid: str) -> list[dict]:
    mfi = _q(uid, "lg_market_freight_intelligence", "*")
    routes = _q(uid, "lg_routes", "route_id, origin_city, destination_city, distance_km")
    route_map = {str(r["route_id"]): r for r in routes}
    result = []
    for m in mfi:
        row = dict(m)
        rte = route_map.get(str(m.get("route_id") or ""), {})
        row["origin_city"] = rte.get("origin_city")
        row["destination_city"] = rte.get("destination_city")
        row["distance_km"] = rte.get("distance_km")
        result.append(row)
    return result


def get_routes(uid: str) -> list[dict]:
    routes = _q(uid, "lg_routes", "*")
    ships = _q(uid, "lg_shipments", "route_id")
    mfi = _q(uid, "lg_market_freight_intelligence", "route_id, volatility_index")
    snaps = _q(uid, "lg_shipment_risk_snapshots", "shipment_id, overall_risk_score")
    ship_routes = _q(uid, "lg_shipments", "shipment_id, route_id")
    ship_to_route = {str(r["shipment_id"]): str(r.get("route_id") or "") for r in ship_routes}
    snap_scores: dict[str, list] = defaultdict(list)
    for s in snaps:
        rid = ship_to_route.get(str(s.get("shipment_id") or ""), "")
        if rid:
            snap_scores[rid].append(_safe_float(s.get("overall_risk_score")))

    ship_counts: dict[str, int] = defaultdict(int)
    for s in ships:
        if s.get("route_id"):
            ship_counts[str(s["route_id"])] += 1

    vol_by_route: dict[str, list] = defaultdict(list)
    for m in mfi:
        if m.get("route_id") and m.get("volatility_index"):
            vol_by_route[str(m["route_id"])].append(_safe_float(m["volatility_index"]))

    result = []
    for r in routes:
        rid = str(r.get("route_id", ""))
        scores = snap_scores.get(rid, [])
        row = dict(r)
        row["total_shipments"] = ship_counts.get(rid, 0)
        row["avg_risk_score"] = round(sum(scores) / max(len(scores), 1), 2) if scores else 0.0
        vols = vol_by_route.get(rid, [])
        row["avg_volatility"] = round(sum(vols) / max(len(vols), 1), 2) if vols else 0.0
        result.append(row)

    return sorted(result, key=lambda x: x["total_shipments"], reverse=True)


# ─── Master Summary ─────────────────────────────────────────────────────────────

def get_master_summary(uid: str) -> list[dict]:
    # Build master summary from risk snapshots + shipments
    snaps = get_risk_snapshots(uid, limit=50000)
    return snaps


def get_insights_summary(uid: str) -> dict:
    kpis = get_shipment_kpis(uid)
    snaps = _q(uid, "lg_shipment_risk_snapshots", "overall_risk_score, risk_category")
    scores = [_safe_float(r.get("overall_risk_score")) for r in snaps if r.get("overall_risk_score") is not None]
    avg_risk = sum(scores) / max(len(scores), 1) if scores else 0.0
    high_count = sum(1 for r in snaps if r.get("risk_category") == "HIGH")
    top_delayed = get_delayed_route_summary(uid)

    return {
        "total_shipments": kpis.get("total", 0),
        "delay_rate_pct": round((kpis.get("delayed", 0) / max(kpis.get("total", 1), 1)) * 100, 1),
        "avg_risk_score": round(avg_risk, 2),
        "high_risk_count": high_count,
        "top_delayed_routes": top_delayed,
        "total_value": kpis.get("total_value", 0),
    }


def get_delayed_route_summary(uid: str) -> list[dict]:
    ships = _q(uid, "lg_shipments", "route_id, shipment_status, origin_city, destination_city")
    route_stats: dict[str, dict] = defaultdict(lambda: {"delays": 0, "route": ""})
    for s in ships:
        rid = str(s.get("route_id") or "unknown")
        route_stats[rid]["route"] = f"{s.get('origin_city','?')} → {s.get('destination_city','?')}"
        if s.get("shipment_status") == "DELAYED":
            route_stats[rid]["delays"] += 1
    return sorted(
        [{"route": v["route"], "delays": v["delays"]} for v in route_stats.values() if v["delays"] > 0],
        key=lambda x: x["delays"], reverse=True,
    )[:5]
