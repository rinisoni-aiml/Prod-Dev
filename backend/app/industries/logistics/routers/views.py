"""
Logistics Views Router — /api/logistics/v1/views/*
Queries the lg_* Supabase tables to compute dashboard, alert, and risk views.
All queries are scoped by the authenticated user's uid.
"""
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase

router = APIRouter()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_float(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _risk_level(score: float) -> str:
    if score >= 75:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


def _alert_severity_from_score(score: float) -> str:
    if score >= 85:
        return "critical"
    if score >= 70:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


def _compliance_days(exp_date) -> int | None:
    if not exp_date:
        return None
    try:
        if isinstance(exp_date, str):
            exp = date.fromisoformat(exp_date[:10])
        else:
            exp = exp_date
        return (exp - date.today()).days
    except Exception:
        return None


def _expiry_label(days: int) -> tuple[str, str]:
    """Returns (label, level) for a compliance expiry."""
    if days <= 7:
        return "CRITICAL", "critical"
    if days <= 30:
        return "WARNING", "high"
    return "WATCH", "medium"


# ─── Dashboard View ────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard_view(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        # Fetch risk snapshots for KPIs
        snap_resp = (
            supabase.table("lg_shipment_risk_snapshots")
            .select("shipment_id, overall_risk_score, risk_category, compliance_risk_score, vendor_risk_score, alert_severity, alert_generated")
            .eq("user_id", uid)
            .execute()
        )
        snapshots = snap_resp.data or []

        # Fetch shipments for active count
        ship_resp = (
            supabase.table("lg_shipments")
            .select("shipment_id, shipment_status, origin_city, destination_city, route_id")
            .eq("user_id", uid)
            .execute()
        )
        shipments = ship_resp.data or []

        # KPIs
        active_count = len([s for s in shipments if s.get("shipment_status") not in ("DELIVERED", "CANCELLED")])
        risk_scores = [_safe_float(s.get("overall_risk_score")) for s in snapshots]
        avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
        compliance_scores = [_safe_float(s.get("compliance_risk_score")) for s in snapshots]
        avg_compliance = sum(compliance_scores) / len(compliance_scores) if compliance_scores else 0.0
        vendor_scores = [_safe_float(s.get("vendor_risk_score")) for s in snapshots]
        avg_vendor = sum(vendor_scores) / len(vendor_scores) if vendor_scores else 0.0

        # Company Risk Index = weighted average of all component averages
        company_risk = avg_risk
        company_level = _risk_level(company_risk)

        # Route Heatmap — group shipments by route
        route_risk: dict[str, dict] = {}
        snap_by_shipment = {s["shipment_id"]: s for s in snapshots}
        for ship in shipments:
            route_name = f"{ship.get('origin_city', '?')} → {ship.get('destination_city', '?')}"
            snap = snap_by_shipment.get(ship.get("shipment_id"), {})
            rs = _safe_float(snap.get("overall_risk_score"))
            if route_name not in route_risk:
                route_risk[route_name] = {"scores": [], "count": 0}
            route_risk[route_name]["scores"].append(rs)
            route_risk[route_name]["count"] += 1

        route_heatmap = []
        for name, info in sorted(route_risk.items(), key=lambda x: -sum(x[1]["scores"]) / max(len(x[1]["scores"]), 1)):
            scores = info["scores"]
            avg = sum(scores) / len(scores) if scores else 0
            route_heatmap.append({
                "name": name,
                "risk_score": round(avg, 1),
                "risk_level": _risk_level(avg),
                "total_shipments": info["count"],
            })

        # Compliance timeline — trucks & drivers with expiring docs
        timeline = []
        trucks_resp = (
            supabase.table("lg_trucks")
            .select("truck_id, truck_number, insurance_expiry_date, fitness_expiry_date, registration_expiry_date")
            .eq("user_id", uid)
            .execute()
        )
        for truck in (trucks_resp.data or []):
            tid = truck.get("truck_number") or truck.get("truck_id", "Unknown")
            for field, label in [
                ("insurance_expiry_date", "Insurance"),
                ("fitness_expiry_date", "Fitness Certificate"),
                ("registration_expiry_date", "Registration"),
            ]:
                days = _compliance_days(truck.get(field))
                if days is not None and 0 <= days <= 60:
                    lbl, lvl = _expiry_label(days)
                    timeline.append({"id": f"{tid}_{field}", "type": label, "subject": tid, "days": days, "label": lbl, "level": lvl})

        drivers_resp = (
            supabase.table("lg_drivers")
            .select("driver_id, driver_name, license_expiry_date")
            .eq("user_id", uid)
            .execute()
        )
        for drv in (drivers_resp.data or []):
            did = drv.get("driver_name") or drv.get("driver_id", "Unknown")
            days = _compliance_days(drv.get("license_expiry_date"))
            if days is not None and 0 <= days <= 60:
                lbl, lvl = _expiry_label(days)
                timeline.append({"id": f"{did}_license", "type": "Driver License", "subject": did, "days": days, "label": lbl, "level": lvl})

        vendors_resp = (
            supabase.table("lg_vendors")
            .select("vendor_id, vendor_name, contract_end_date")
            .eq("user_id", uid)
            .execute()
        )
        for v in (vendors_resp.data or []):
            vid = v.get("vendor_name") or v.get("vendor_id", "Unknown")
            days = _compliance_days(v.get("contract_end_date"))
            if days is not None and 0 <= days <= 60:
                lbl, lvl = _expiry_label(days)
                timeline.append({"id": f"{vid}_contract", "type": "Vendor Contract", "subject": vid, "days": days, "label": lbl, "level": lvl})

        timeline.sort(key=lambda x: x["days"])

        # AI Insights — generated from data patterns
        insights = _generate_insights(avg_risk, avg_compliance, avg_vendor, active_count, len(snapshots))

        return {
            "generated_at": date.today().isoformat(),
            "data": {
                "kpis": {
                    "active_shipments": active_count,
                    "high_risk_shipments": round(avg_risk, 1),
                    "compliance_alerts": round(avg_compliance, 1),
                    "vendor_risk_alerts": round(avg_vendor, 1),
                    "company_risk_index": round(company_risk, 1),
                    "company_risk_level": company_level,
                },
                "route_heatmap": route_heatmap[:10],
                "compliance_timeline": timeline[:15],
                "insights": insights,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _generate_insights(avg_risk: float, avg_compliance: float, avg_vendor: float, active: int, total: int) -> list:
    insights = []
    if avg_risk >= 70:
        insights.append({"icon": "🚨", "title": "Elevated Fleet Risk", "body": f"Average risk score is {avg_risk:.1f}/100. Immediate review of high-risk shipments recommended."})
    elif avg_risk >= 50:
        insights.append({"icon": "⚠️", "title": "Moderate Risk Level", "body": f"Fleet average risk is {avg_risk:.1f}/100. Monitor high-risk corridors closely."})
    else:
        insights.append({"icon": "✅", "title": "Risk Under Control", "body": f"Fleet average risk is {avg_risk:.1f}/100. Operations are within acceptable thresholds."})

    if avg_vendor >= 65:
        insights.append({"icon": "🏢", "title": "Vendor Performance Alert", "body": f"Vendor risk average {avg_vendor:.1f}/100. Review underperforming carrier contracts."})
    else:
        insights.append({"icon": "🤝", "title": "Vendor Performance Stable", "body": f"Vendor risk at {avg_vendor:.1f}/100. Carrier relationships are healthy."})

    if avg_compliance >= 60:
        insights.append({"icon": "📋", "title": "Compliance Attention Needed", "body": f"Compliance risk at {avg_compliance:.1f}/100. Review expiring licenses and permits."})
    else:
        insights.append({"icon": "✔️", "title": "Compliance On Track", "body": f"Compliance score at {avg_compliance:.1f}/100. Document renewals are up to date."})

    insights.append({"icon": "📦", "title": f"{active} Active Shipments", "body": f"Currently tracking {active} active shipments out of {total} total records in the system."})
    return insights


# ─── Alerts View ───────────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts_view(
    limit: int = Query(300, ge=1, le=1000),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("lg_shipment_risk_snapshots")
            .select("id, shipment_id, overall_risk_score, risk_category, alert_severity, alert_type, compliance_risk_score, vendor_risk_score, operational_risk_score, financial_exposure_score, explanation, recommendation, category, resolved_at, calculated_at")
            .eq("user_id", uid)
            .eq("alert_generated", True)
            .order("overall_risk_score", desc=True)
            .limit(limit)
            .execute()
        )
        rows = resp.data or []

        alerts = []
        for row in rows:
            score = _safe_float(row.get("overall_risk_score"))
            severity = row.get("alert_severity") or _alert_severity_from_score(score)
            category = row.get("category") or row.get("alert_type") or "Operational"
            alerts.append({
                "id": row.get("id"),
                "shipment_id": row.get("shipment_id"),
                "title": f"Shipment #{row.get('shipment_id', 'Unknown')} — {(category).title()} Risk",
                "category": category,
                "entity_id": row.get("shipment_id"),
                "entity_type": "shipment",
                "risk_score": round(score, 1),
                "risk_level": _risk_level(score),
                "alert_severity": severity,
                "explanation": row.get("explanation") or f"Risk score of {score:.1f} detected for this shipment.",
                "recommendation": row.get("recommendation") or "Review shipment details and take corrective action.",
                "resolved_at": row.get("resolved_at"),
                "calculated_at": row.get("calculated_at"),
            })

        return {"data": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Alert Resolve / Unresolve ─────────────────────────────────────────────────

@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        from datetime import datetime
        supabase.table("lg_shipment_risk_snapshots").update({"resolved_at": datetime.utcnow().isoformat()}).eq("id", alert_id).eq("user_id", uid).execute()
        return {"data": {"id": alert_id, "resolved": True}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/unresolve")
async def unresolve_alert(alert_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        supabase.table("lg_shipment_risk_snapshots").update({"resolved_at": None}).eq("id", alert_id).eq("user_id", uid).execute()
        return {"data": {"id": alert_id, "resolved": False}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Shipment Risk View ────────────────────────────────────────────────────────

@router.get("/shipment-risk")
async def get_shipment_risk_view(
    shipment_id: str | None = Query(None),
    limit: int = Query(300, ge=1, le=1000),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        # Load all shipments for the selector
        ship_q = (
            supabase.table("lg_shipments")
            .select("shipment_id, origin_city, destination_city, shipment_status, shipment_value, delivery_deadline, vendor_id, vendor_name, driver_id, truck_id, route_id")
            .eq("user_id", uid)
            .order("shipment_id")
            .limit(limit)
        )
        ship_resp = ship_q.execute()
        shipments = ship_resp.data or []

        # Pick selected shipment
        target_id = shipment_id
        if not target_id and shipments:
            target_id = shipments[0].get("shipment_id")

        selected_shipment = next((s for s in shipments if str(s.get("shipment_id")) == str(target_id)), shipments[0] if shipments else {})

        # Load risk snapshot for selected shipment
        selected_data = None
        if target_id:
            snap_resp = (
                supabase.table("lg_shipment_risk_snapshots")
                .select("*")
                .eq("user_id", uid)
                .eq("shipment_id", str(target_id))
                .limit(1)
                .execute()
            )
            snap = (snap_resp.data or [{}])[0]
            if snap:
                overall = _safe_float(snap.get("overall_risk_score"))
                selected_data = {
                    "shipment": selected_shipment,
                    "snapshot": snap,
                    "risk_score": overall,
                    "components": {
                        "operational_score": _safe_float(snap.get("operational_risk_score")),
                        "financial_score": _safe_float(snap.get("financial_exposure_score")),
                        "vendor_score": _safe_float(snap.get("vendor_risk_score")),
                        "compliance_score": _safe_float(snap.get("compliance_risk_score")),
                    },
                    "recommendation": snap.get("recommendation") or "Execute reroute and backup carrier strategy to reduce operational volatility.",
                }

        return {
            "data": {
                "shipments": [{"shipment_id": s.get("shipment_id"), "origin_city": s.get("origin_city"), "destination_city": s.get("destination_city")} for s in shipments],
                "selected": selected_data,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
