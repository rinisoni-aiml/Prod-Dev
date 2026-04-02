"""
View Service: Builds all screen data (dashboard, alerts, compliance, risk-analytics, shipment-risk, vendor-intel).
Adapted from logistics-ai-main for Supabase lg_* tables with user_id scoping.
All business logic, thresholds, and scoring formulas preserved exactly.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd

from app.industries.logistics.config.risk_config import (
    ALERT_THRESHOLDS,
    COMPLIANCE_ALERT_WINDOWS,
    RISK_THRESHOLDS,
    SCORING_WEIGHTS,
)
from app.industries.logistics.services.insight_service import (
    generate_dashboard_insight,
    generate_risk_insight,
    generate_shipment_insight,
    generate_vendor_insight,
)
from app.industries.logistics.services.ai.query_builder_service import (
    get_drivers,
    get_insights_summary,
    get_market_intelligence,
    get_risk_snapshots,
    get_routes,
    get_shipment_kpis,
    get_shipments,
    get_trucks,
    get_vendors,
    get_master_summary,
)

logger = logging.getLogger(__name__)


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value) if value is not None else default
    except Exception:
        return default


def _normalize_pct(value: Any) -> float:
    num = _num(value, 0.0)
    if 0.0 < num <= 1.0:
        return num * 100.0
    return num


def _to_records(data) -> list[dict[str, Any]]:
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, pd.DataFrame):
        return data.to_dict(orient="records")
    return []


def _risk_level(score: float) -> str:
    """Correct thresholds: HIGH>=80, MEDIUM>=60, LOW otherwise."""
    if score >= RISK_THRESHOLDS["HIGH"]:
        return "high"
    if score >= RISK_THRESHOLDS["MEDIUM"]:
        return "medium"
    return "low"


def _alert_severity(score: float) -> str:
    if score >= ALERT_THRESHOLDS["CRITICAL"]:
        return "critical"
    if score >= ALERT_THRESHOLDS["WARNING"]:
        return "high"
    if score >= ALERT_THRESHOLDS["INFO"]:
        return "medium"
    return "low"


def _days_until(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        dt = pd.to_datetime(value, errors="coerce")
        if pd.isna(dt):
            return None
        now = pd.Timestamp.now().normalize()
        return int((dt.normalize() - now).days)
    except Exception:
        return None


def _expiry_label(days: Optional[int]) -> str:
    if days is None:
        return "Not available"
    if days < 0:
        return f"Expired {abs(days)} days ago"
    if days == 0:
        return "Expires today"
    return f"Expires in {days} days"


def _expiry_level(days: Optional[int]) -> str:
    if days is None:
        return "unknown"
    if days <= COMPLIANCE_ALERT_WINDOWS["critical_days"]:
        return "critical"
    if days <= COMPLIANCE_ALERT_WINDOWS["warning_days"]:
        return "high"
    if days <= COMPLIANCE_ALERT_WINDOWS["watch_days"]:
        return "medium"
    return "low"


def _compliance_score(days: Optional[int]) -> float:
    if days is None:
        return 100.0
    if days <= 0:
        return 100.0
    if days <= COMPLIANCE_ALERT_WINDOWS["critical_days"]:
        progress = 1.0 - (days / max(COMPLIANCE_ALERT_WINDOWS["critical_days"], 1))
        return 85.0 + (progress * 15.0)
    if days <= COMPLIANCE_ALERT_WINDOWS["warning_days"]:
        span = max(1, COMPLIANCE_ALERT_WINDOWS["warning_days"] - COMPLIANCE_ALERT_WINDOWS["critical_days"])
        progress = (COMPLIANCE_ALERT_WINDOWS["warning_days"] - days) / span
        return 60.0 + (progress * 24.0)
    if days <= COMPLIANCE_ALERT_WINDOWS["watch_days"]:
        span = max(1, COMPLIANCE_ALERT_WINDOWS["watch_days"] - COMPLIANCE_ALERT_WINDOWS["warning_days"])
        progress = (COMPLIANCE_ALERT_WINDOWS["watch_days"] - days) / span
        return 35.0 + (progress * 24.0)
    return max(5.0, 34.0 - (days - COMPLIANCE_ALERT_WINDOWS["watch_days"]) * 0.2)


def _avg(values: list, default: float = 0.0) -> float:
    cleaned = [float(v) for v in values if v is not None]
    if not cleaned:
        return default
    return sum(cleaned) / len(cleaned)


def _latest_snapshot_rows(snapshots: list[dict]) -> list[dict]:
    """Keep only the most recent snapshot per shipment (first-occurrence wins since sorted DESC)."""
    by_shipment: dict[str, dict] = {}
    for row in snapshots:
        sid = str(row.get("shipment_id") or "")
        if sid and sid not in by_shipment:
            by_shipment[sid] = row
    return list(by_shipment.values())


# ─── Dashboard View ────────────────────────────────────────────────────────────

def build_dashboard_view(uid: str) -> dict[str, Any]:
    logger.info("Building dashboard view for uid=%s", uid)
    kpis = get_shipment_kpis(uid)
    routes = _to_records(get_routes(uid))
    vendors = _to_records(get_vendors(uid))
    trucks = _to_records(get_trucks(uid))
    drivers = _to_records(get_drivers(uid))
    snapshot_rows = _latest_snapshot_rows(_to_records(get_risk_snapshots(uid, limit=5000)))
    summary = get_insights_summary(uid)

    snapshot_overall_scores = [_num(row.get("overall_risk_score")) for row in snapshot_rows]
    snapshot_compliance_scores = [_num(row.get("compliance_risk_score")) for row in snapshot_rows]
    snapshot_vendor_scores = [_num(row.get("vendor_risk_score")) for row in snapshot_rows]

    company_risk = _avg(snapshot_overall_scores, _num(summary.get("avg_risk_score"), _num(kpis.get("avg_risk"))))
    high_risk_scores = [score for score in snapshot_overall_scores if score >= RISK_THRESHOLDS["MEDIUM"]]
    high_risk_overall_score = _avg(high_risk_scores, company_risk)
    compliance_overall_score = _avg(snapshot_compliance_scores, 0.0)
    vendor_overall_score = _avg(snapshot_vendor_scores, _avg([_num(row.get("vendor_risk_score")) for row in vendors], 0.0))

    # Route heatmap
    route_map: dict[str, dict] = {}
    for row in snapshot_rows:
        route_id = row.get("route_id")
        origin = row.get("origin_city") or "Unknown"
        destination = row.get("destination_city") or "Unknown"
        key = str(route_id) if route_id is not None else f"{origin}->{destination}"
        if key not in route_map:
            route_map[key] = {"id": route_id or key, "name": f"{origin} → {destination}", "scores": [], "shipments": 0}
        route_map[key]["scores"].append(_num(row.get("overall_risk_score")))
        route_map[key]["shipments"] += 1

    route_rows = []
    for route in route_map.values():
        avg_score = _avg(route["scores"], 0.0)
        route_rows.append({
            "id": route["id"],
            "name": route["name"],
            "risk_score": round(avg_score, 2),
            "risk_level": _risk_level(avg_score),
            "total_shipments": int(route["shipments"]),
        })

    if not route_rows:
        for route in routes:
            risk = _num(route.get("avg_risk_score"))
            route_rows.append({
                "id": route.get("route_id"),
                "name": f"{route.get('origin_city') or 'Unknown'} → {route.get('destination_city') or 'Unknown'}",
                "risk_score": round(risk, 2),
                "risk_level": _risk_level(risk),
                "total_shipments": int(_num(route.get("total_shipments"))),
            })

    route_rows = sorted(route_rows, key=lambda item: item["risk_score"], reverse=True)[:6]

    # Compliance timeline
    compliance_timeline = []
    vehicle_docs_expiring_30 = 0
    driver_licenses_expiring_30 = 0
    for truck in trucks:
        for key, label in (
            ("insurance_expiry_date", "Truck Insurance"),
            ("fitness_expiry_date", "Fitness Certificate"),
            ("registration_expiry_date", "Registration"),
        ):
            days = _days_until(truck.get(key))
            if days is None or days < 0:
                continue
            if days <= 30:
                vehicle_docs_expiring_30 += 1
            compliance_timeline.append({
                "id": f"{truck.get('truck_id')}-{key}",
                "subject": truck.get("truck_number") or truck.get("truck_id") or "Truck",
                "type": label,
                "days": days,
                "label": _expiry_label(days),
                "level": _expiry_level(days),
            })

    for driver in drivers:
        days = _days_until(driver.get("license_expiry_date"))
        if days is None or days < 0:
            continue
        if days <= 30:
            driver_licenses_expiring_30 += 1
        compliance_timeline.append({
            "id": f"{driver.get('driver_id')}-license",
            "subject": driver.get("driver_name") or driver.get("driver_id") or "Driver",
            "type": "Driver License",
            "days": days,
            "label": _expiry_label(days),
            "level": _expiry_level(days),
        })

    urgent_timeline = sorted([i for i in compliance_timeline if 0 <= i["days"] <= 5], key=lambda i: i["days"])
    future_timeline = sorted([i for i in compliance_timeline if i["days"] > 5], key=lambda i: i["days"])
    compliance_timeline = (urgent_timeline + future_timeline)[:6]
    compliance_alert_count = len([i for i in compliance_timeline if 0 <= i["days"] <= 5])

    vendor_alert_count = sum(1 for v in vendors if _num(v.get("vendor_risk_score")) >= ALERT_THRESHOLDS["WARNING"])
    high_risk_shipments_count = len([row for row in snapshot_rows if _num(row.get("overall_risk_score")) >= RISK_THRESHOLDS["MEDIUM"]])

    insight_cards = generate_dashboard_insight({
        "company_risk": company_risk,
        "delayed_shipments": int(_num(kpis.get("delayed"))),
        "total_shipments": int(_num(kpis.get("total"))),
        "delay_rate_pct": float(_num(summary.get("delay_rate_pct"))),
        "compliance_alerts": compliance_alert_count,
        "vendor_alerts": vendor_alert_count,
        "driver_licenses_expiring_30": driver_licenses_expiring_30,
        "vehicle_docs_expiring_30": vehicle_docs_expiring_30,
        "top_route_name": route_rows[0]["name"] if route_rows else "No route",
        "top_route_risk": route_rows[0]["risk_score"] if route_rows else 0,
    })

    return {
        "kpis": {
            "active_shipments": int(_num(kpis.get("total"))),
            "high_risk_shipments": round(high_risk_overall_score, 2),
            "compliance_alerts": round(compliance_overall_score, 2),
            "vendor_risk_alerts": round(vendor_overall_score, 2),
            "high_risk_shipments_count": high_risk_shipments_count,
            "compliance_alerts_count": compliance_alert_count,
            "vendor_risk_alerts_count": vendor_alert_count,
            "company_risk_index": round(company_risk, 2),
            "company_risk_level": _risk_level(company_risk),
            "total_value": _num(kpis.get("total_value")),
        },
        "route_heatmap": route_rows,
        "compliance_timeline": compliance_timeline,
        "insights": insight_cards,
        "risk_thresholds": RISK_THRESHOLDS,
    }


# ─── Alerts View ───────────────────────────────────────────────────────────────

def build_alerts_view(uid: str, limit: int = 300) -> list[dict[str, Any]]:
    logger.info("Building alerts view for uid=%s", uid)
    snapshots = _to_records(get_risk_snapshots(uid, limit=limit))
    shipments = {str(row.get("shipment_id")): row for row in _to_records(get_shipments(uid, limit=limit))}
    trucks = _to_records(get_trucks(uid))
    drivers = _to_records(get_drivers(uid))
    vendors = _to_records(get_vendors(uid))

    alerts: list[dict] = []

    for row in snapshots:
        score = _num(row.get("overall_risk_score"))
        if score < ALERT_THRESHOLDS["INFO"]:
            continue
        shipment = shipments.get(str(row.get("shipment_id")), {})
        alerts.append({
            "id": f"shipment-{row.get('shipment_id')}",
            "entity_type": "shipment",
            "entity_id": str(row.get("shipment_id")),
            "title": f"Shipment Risk Alert — {shipment.get('origin_city') or 'Unknown'} → {shipment.get('destination_city') or 'Unknown'}",
            "alert_severity": _alert_severity(score),
            "risk_score": round(score, 2),
            "risk_level": _risk_level(score),
            "category": "Operational Risk",
            "explanation": (
                f"Shipment {row.get('shipment_id')} currently scores {round(score, 1)} "
                f"with risk category {row.get('risk_category') or _risk_level(score).upper()}."
            ),
            "recommendation": "Revalidate milestones and carrier readiness for this route before next dispatch checkpoint.",
            "resolved": bool(row.get("resolved_at")),
        })

    for truck in trucks:
        for key, label in (
            ("insurance_expiry_date", "Fleet Insurance"),
            ("fitness_expiry_date", "Fitness Certificate"),
            ("registration_expiry_date", "Registration"),
        ):
            days = _days_until(truck.get(key))
            if days is None or days > COMPLIANCE_ALERT_WINDOWS["warning_days"]:
                continue
            score = 100 if days <= 0 else max(0, 100 - (days * 3))
            alerts.append({
                "id": f"truck-{truck.get('truck_id')}-{key}",
                "entity_type": "truck",
                "entity_id": truck.get("truck_id"),
                "title": f"Critical {label} Expiry — {truck.get('truck_number') or truck.get('truck_id')}",
                "alert_severity": _alert_severity(score),
                "risk_score": round(score, 2),
                "risk_level": _risk_level(score),
                "category": "Compliance & Vendor Risk",
                "explanation": f"Truck {truck.get('truck_number') or truck.get('truck_id')} has {label.lower()} {_expiry_label(days).lower()}.",
                "recommendation": "Renew policy/certificate and pause assignment of this vehicle until compliance is restored.",
                "resolved": False,
            })

    for driver in drivers:
        days = _days_until(driver.get("license_expiry_date"))
        if days is None or days > COMPLIANCE_ALERT_WINDOWS["warning_days"]:
            continue
        score = 100 if days <= 0 else max(0, 100 - (days * 3))
        alerts.append({
            "id": f"driver-{driver.get('driver_id')}",
            "entity_type": "driver",
            "entity_id": driver.get("driver_id"),
            "title": f"Driver License Expiry — {driver.get('driver_name') or driver.get('driver_id')}",
            "alert_severity": _alert_severity(score),
            "risk_score": round(score, 2),
            "risk_level": _risk_level(score),
            "category": "Compliance Risk",
            "explanation": f"Driver license {_expiry_label(days).lower()} inside the configured compliance action horizon.",
            "recommendation": "Schedule immediate renewal or reassign shipments to compliant drivers.",
            "resolved": False,
        })

    for vendor in vendors:
        score = _num(vendor.get("vendor_risk_score"))
        if score < ALERT_THRESHOLDS["WARNING"]:
            continue
        alerts.append({
            "id": f"vendor-{vendor.get('vendor_id')}",
            "entity_type": "vendor",
            "entity_id": vendor.get("vendor_id"),
            "title": f"Carrier Performance Degradation — {vendor.get('vendor_name') or 'Vendor'}",
            "alert_severity": _alert_severity(score),
            "risk_score": round(score, 2),
            "risk_level": _risk_level(score),
            "category": "Vendor Risk",
            "explanation": vendor.get("vendor_explanation") or "Vendor has crossed the configured warning threshold.",
            "recommendation": vendor.get("vendor_recommendation") or "Shift load allocation toward lower-risk carriers.",
            "resolved": False,
        })

    alerts.sort(key=lambda item: item["risk_score"], reverse=True)
    logger.info("Alerts view built: count=%d", len(alerts))
    return alerts


# ─── Compliance View ───────────────────────────────────────────────────────────

def build_compliance_view(uid: str) -> dict[str, Any]:
    logger.info("Building compliance view for uid=%s", uid)
    trucks = _to_records(get_trucks(uid))
    drivers = _to_records(get_drivers(uid))

    truck_rows: list[dict] = []
    for truck in trucks:
        ins_days = _days_until(truck.get("insurance_expiry_date"))
        fit_days = _days_until(truck.get("fitness_expiry_date"))
        reg_days = _days_until(truck.get("registration_expiry_date"))
        valid_days = [d for d in [ins_days, fit_days, reg_days] if d is not None]
        min_days = min(valid_days) if valid_days else None
        score = _compliance_score(min_days)
        severity = _alert_severity(score)
        truck_rows.append({
            "id": truck.get("truck_id") or truck.get("truck_number"),
            "asset": truck.get("truck_number") or truck.get("truck_id"),
            "type": truck.get("vehicle_type") or "--",
            "status": truck.get("truck_status") or "UNKNOWN",
            "insurance": truck.get("insurance_expiry_date"),
            "fitness": truck.get("fitness_expiry_date"),
            "registration": truck.get("registration_expiry_date"),
            "risk_score": round(score, 2),
            "risk_level": _risk_level(score),
            "alert_severity": severity,
            "label": _expiry_label(min_days),
            "risk_label": f"{severity.upper()} RISK",
            "details": {
                "insurance_days": ins_days,
                "fitness_days": fit_days,
                "registration_days": reg_days,
                "truck_capacity_weight": _num(truck.get("truck_capacity_weight")),
            },
            "documents": {
                "insurance": {"date": truck.get("insurance_expiry_date"), "days": ins_days, "label": _expiry_label(ins_days), "level": _expiry_level(ins_days)},
                "fitness": {"date": truck.get("fitness_expiry_date"), "days": fit_days, "label": _expiry_label(fit_days), "level": _expiry_level(fit_days)},
                "registration": {"date": truck.get("registration_expiry_date"), "days": reg_days, "label": _expiry_label(reg_days), "level": _expiry_level(reg_days)},
            },
        })

    driver_rows: list[dict] = []
    for driver in drivers:
        lic_days = _days_until(driver.get("license_expiry_date"))
        score = _compliance_score(lic_days)
        severity = _alert_severity(score)
        driver_rows.append({
            "id": driver.get("driver_id"),
            "name": driver.get("driver_name") or driver.get("driver_id"),
            "status": driver.get("driver_status") or "UNKNOWN",
            "license_number": driver.get("license_number") or "--",
            "license_expiry": driver.get("license_expiry_date"),
            "incidents": int(_num(driver.get("incident_count"))),
            "risk_score": round(score, 2),
            "risk_level": _risk_level(score),
            "alert_severity": severity,
            "label": _expiry_label(lic_days),
            "risk_label": f"{severity.upper()} RISK",
            "details": {"license_days": lic_days},
            "documents": {
                "license": {"date": driver.get("license_expiry_date"), "days": lic_days, "label": _expiry_label(lic_days), "level": _expiry_level(lic_days)}
            },
        })

    all_rows = truck_rows + driver_rows
    return {
        "kpis": {
            "critical_expiries": len([row for row in all_rows if row["alert_severity"] == "critical"]),
            "high_risk_assets": len([row for row in all_rows if row["alert_severity"] in {"critical", "high"}]),
            "fleet_tracked": len(truck_rows),
            "drivers_tracked": len(driver_rows),
        },
        "trucks": truck_rows,
        "drivers": driver_rows,
    }


# ─── Risk Analytics View ───────────────────────────────────────────────────────

def build_risk_analytics_view(uid: str) -> dict[str, Any]:
    logger.info("Building risk analytics view for uid=%s", uid)
    snapshot_rows = _latest_snapshot_rows(_to_records(get_risk_snapshots(uid, limit=5000)))
    routes = _to_records(get_routes(uid))
    vendors = _to_records(get_vendors(uid))
    market = _to_records(get_market_intelligence(uid))

    s_overall = [_num(row.get("overall_risk_score")) for row in snapshot_rows]
    s_financial = [_num(row.get("financial_exposure_score")) for row in snapshot_rows]
    s_operational = [_num(row.get("operational_risk_score")) for row in snapshot_rows]
    s_vendor = [_num(row.get("vendor_risk_score")) for row in snapshot_rows]
    s_compliance = [_num(row.get("compliance_risk_score")) for row in snapshot_rows]

    avg_risk = _avg(s_overall, 0.0)
    high_share = (len([s for s in s_overall if s >= RISK_THRESHOLDS["MEDIUM"]]) / max(len(s_overall), 1)) * 100.0
    exposure = sum(s_financial)

    route_map: dict[str, dict] = {}
    for row in snapshot_rows:
        rid = row.get("route_id")
        origin = row.get("origin_city") or "Unknown"
        dest = row.get("destination_city") or "Unknown"
        key = str(rid) if rid is not None else f"{origin}->{dest}"
        if key not in route_map:
            route_map[key] = {"name": f"{origin} → {dest}", "scores": [], "shipments": 0}
        route_map[key]["scores"].append(_num(row.get("overall_risk_score")))
        route_map[key]["shipments"] += 1

    top_routes = sorted([
        {"name": v["name"], "risk_score": round(_avg(v["scores"], 0.0), 2),
         "risk_level": _risk_level(_avg(v["scores"], 0.0)), "shipments": v["shipments"]}
        for v in route_map.values()
    ], key=lambda x: x["risk_score"], reverse=True)[:8]

    if not top_routes:
        top_routes = sorted([
            {"name": f"{r.get('origin_city','?')} → {r.get('destination_city','?')}",
             "risk_score": round(_num(r.get("avg_risk_score")), 2),
             "risk_level": _risk_level(_num(r.get("avg_risk_score"))),
             "shipments": int(_num(r.get("total_shipments")))}
            for r in routes
        ], key=lambda x: x["risk_score"], reverse=True)[:8]

    vendor_rows = sorted([
        {"vendor_name": v.get("vendor_name") or "Unknown",
         "risk_score": round(_num(v.get("vendor_risk_score")), 2),
         "risk_level": _risk_level(_num(v.get("vendor_risk_score"))),
         "on_time_pct": round(max(0.0, min(100.0, _normalize_pct(v.get("latest_otp")))), 2),
         "delay_rate_pct": round(max(0.0, min(100.0, _normalize_pct(v.get("delay_rate")))), 2)}
        for v in vendors
    ], key=lambda x: x["risk_score"], reverse=True)[:8]

    vol_map: dict[str, dict] = {}
    for m in market:
        key = str(m.get("route_id") or f"{m.get('origin_city')}-{m.get('destination_city')}")
        if key not in vol_map:
            vol_map[key] = {"name": f"{m.get('origin_city','?')} → {m.get('destination_city','?')}", "vals": []}
        if m.get("volatility_index"):
            vol_map[key]["vals"].append(_num(m["volatility_index"]))
    market_rows = sorted([
        {"name": v["name"], "volatility": round(_avg(v["vals"], 0.0), 2)}
        for v in vol_map.values() if v["vals"]
    ], key=lambda x: x["volatility"], reverse=True)[:6]

    insight = generate_risk_insight({
        "avg_risk": avg_risk, "high_risk_share": high_share,
        "top_volatility": market_rows[0]["volatility"] if market_rows else 0.0,
    })

    contributors = [
        {"name": "Operational Risks", "score": round(_avg(s_operational, 0.0), 2), "contribution_pct": round(float(SCORING_WEIGHTS.get("delay", 0.3)) * 100, 1)},
        {"name": "Vendor Risks", "score": round(_avg(s_vendor, 0.0), 2), "contribution_pct": round(float(SCORING_WEIGHTS.get("otp", 0.4)) * 100, 1)},
        {"name": "Compliance Risks", "score": round(_avg(s_compliance, 0.0), 2), "contribution_pct": 20.0},
        {"name": "Financial Risks", "score": round(_avg(s_financial, 0.0), 2), "contribution_pct": round(float(SCORING_WEIGHTS.get("claims", 0.3)) * 100, 1)},
    ]

    return {
        "kpis": {"avg_risk": round(avg_risk, 2), "financial_exposure": round(exposure, 2),
                 "high_risk_share": round(high_share, 2), "monitored_routes": len(top_routes),
                 "benchmarked_vendors": len(vendor_rows)},
        "top_routes": top_routes,
        "vendor_comparison": vendor_rows,
        "market_volatility": market_rows,
        "contributors": contributors,
        "insight_text": insight,
    }


# ─── Shipment Risk View ────────────────────────────────────────────────────────

def build_shipment_risk_view(uid: str, shipment_id: Optional[str] = None, limit: int = 300) -> dict[str, Any]:
    logger.info("Building shipment risk view for uid=%s", uid)
    shipments = _to_records(get_shipments(uid, limit=limit))
    snapshots = _to_records(get_risk_snapshots(uid, limit=max(limit, 500)))
    if not shipments:
        return {"shipments": [], "selected": None}

    selected_id = str(shipment_id or shipments[0].get("shipment_id"))
    selected_shipment = next((r for r in shipments if str(r.get("shipment_id")) == selected_id), shipments[0])
    selected_snapshot = next((r for r in snapshots if str(r.get("shipment_id")) == str(selected_shipment.get("shipment_id"))), {})

    operational = _num(selected_snapshot.get("operational_risk_score"))
    financial = _num(selected_snapshot.get("financial_exposure_score"))
    vendor = _num(selected_snapshot.get("vendor_risk_score"))
    compliance = _num(selected_snapshot.get("compliance_risk_score"))
    overall = _num(selected_snapshot.get("overall_risk_score"), _num(selected_shipment.get("overall_risk_score")))
    comp = {"operational": operational, "financial": financial, "vendor": vendor, "compliance": compliance}
    top_component = max(comp, key=comp.get) if comp else "operational"

    explanation = generate_shipment_insight({
        "shipment_id": selected_shipment.get("shipment_id"),
        "overall_risk": overall, "risk_level": _risk_level(overall), "top_component": top_component,
    })

    return {
        "shipments": [{"shipment_id": r.get("shipment_id"), "origin_city": r.get("origin_city"), "destination_city": r.get("destination_city")} for r in shipments],
        "selected": {
            "shipment": selected_shipment,
            "snapshot": selected_snapshot,
            "risk_score": round(overall, 2),
            "risk_level": _risk_level(overall),
            "alert_severity": _alert_severity(overall),
            "components": {"operational_score": round(operational, 2), "financial_score": round(financial, 2), "vendor_score": round(vendor, 2), "compliance_score": round(compliance, 2)},
            "explanation": explanation,
            "recommendation": f"Focus mitigation on {top_component} component first because it contributes {round(comp[top_component], 1)} points to the current profile.",
        },
    }


# ─── Vendor Intel View ─────────────────────────────────────────────────────────

def build_vendor_intel_view(uid: str, vendor_id: Optional[str] = None) -> dict[str, Any]:
    logger.info("Building vendor intel view for uid=%s", uid)
    vendors = _to_records(get_vendors(uid))
    shipments = _to_records(get_shipments(uid, limit=5000))
    snapshot_rows = _latest_snapshot_rows(_to_records(get_risk_snapshots(uid, limit=5000)))

    if not vendors:
        return {"vendors": [], "selected": None}

    current_vendor = next((v for v in vendors if str(v.get("vendor_id")) == str(vendor_id or "")), vendors[0])
    vid = str(current_vendor.get("vendor_id"))
    vendor_shipments = [r for r in shipments if str(r.get("vendor_id")) == vid]
    vendor_sids = {str(r.get("shipment_id")) for r in vendor_shipments}
    vendor_snapshots = [r for r in snapshot_rows if str(r.get("shipment_id")) in vendor_sids]

    avg_risk = _avg([_num(r.get("overall_risk_score")) for r in vendor_snapshots], _num(current_vendor.get("vendor_risk_score")))
    on_time = max(0.0, min(100.0, _normalize_pct(current_vendor.get("latest_otp"))))
    delay_rate = max(0.0, min(100.0, _normalize_pct(current_vendor.get("delay_rate"))))
    if on_time <= 0.0 and 0.0 < delay_rate <= 100.0:
        on_time = max(0.0, 100.0 - delay_rate)
    exposure = sum(_num(r.get("shipment_value")) for r in vendor_shipments)
    high_risk_loads = len([r for r in vendor_snapshots if _num(r.get("overall_risk_score")) >= RISK_THRESHOLDS["MEDIUM"]])

    status_mix: dict[str, int] = {}
    for s in vendor_shipments:
        key = str(s.get("shipment_status") or "UNKNOWN")
        status_mix[key] = status_mix.get(key, 0) + 1

    insight_text = generate_vendor_insight({
        "vendor_name": current_vendor.get("vendor_name"), "risk_score": avg_risk,
        "on_time_pct": on_time, "delay_rate_pct": delay_rate,
    })

    return {
        "vendors": [{"vendor_id": v.get("vendor_id"), "vendor_name": v.get("vendor_name"),
                     "risk_score": _num(v.get("vendor_risk_score")), "risk_level": v.get("vendor_risk_level") or _risk_level(_num(v.get("vendor_risk_score")))}
                    for v in vendors],
        "selected": {
            "vendor": current_vendor,
            "kpis": {"on_time_pct": round(on_time, 2), "delay_rate_pct": round(delay_rate, 2),
                     "avg_risk": round(avg_risk, 2), "risk_level": _risk_level(avg_risk),
                     "financial_exposure": round(exposure, 2), "high_risk_loads": high_risk_loads,
                     "total_shipments": len(vendor_shipments)},
            "status_mix": [{"status": k, "count": v} for k, v in status_mix.items()],
            "latest_risk_rows": [{"shipment_id": r.get("shipment_id"), "overall_risk_score": round(_num(r.get("overall_risk_score")), 2),
                                   "origin_city": r.get("origin_city"), "destination_city": r.get("destination_city"),
                                   "shipment_status": r.get("shipment_status")} for r in vendor_snapshots[:10]],
            "flags": vendor_shipments[:8],
            "insight_text": insight_text,
            "recommendation": current_vendor.get("vendor_recommendation") or "Prioritize route assignment by current vendor risk level.",
        },
    }
