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


# ─── Compliance View ───────────────────────────────────────────────────────────

@router.get("/compliance")
async def get_compliance_view(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        trucks_resp = (
            supabase.table("lg_trucks")
            .select("truck_id, truck_number, vehicle_type, truck_status, insurance_expiry_date, fitness_expiry_date, registration_expiry_date")
            .eq("user_id", uid)
            .execute()
        )
        trucks_raw = trucks_resp.data or []

        drivers_resp = (
            supabase.table("lg_drivers")
            .select("driver_id, driver_name, driver_status, license_number, license_expiry_date")
            .eq("user_id", uid)
            .execute()
        )
        drivers_raw = drivers_resp.data or []

        def _doc(exp_date):
            days = _compliance_days(exp_date)
            if days is None:
                return None
            if days < 0:
                return {"date": exp_date[:10] if isinstance(exp_date, str) else str(exp_date), "days": days, "level": "critical", "label": "EXPIRED"}
            lbl, lvl = _expiry_label(days)
            return {"date": exp_date[:10] if isinstance(exp_date, str) else str(exp_date), "days": days, "level": lvl, "label": lbl}

        critical_expiries = 0
        high_risk_assets = 0

        truck_rows = []
        for t in trucks_raw:
            ins = _doc(t.get("insurance_expiry_date"))
            fit = _doc(t.get("fitness_expiry_date"))
            reg = _doc(t.get("registration_expiry_date"))
            docs = {k: v for k, v in [("insurance", ins), ("fitness", fit), ("registration", reg)] if v}
            doc_levels = [d["level"] for d in docs.values()]
            if "critical" in doc_levels:
                critical_expiries += 1
                sev, risk_label = "critical", "CRITICAL Risk"
            elif "high" in doc_levels:
                high_risk_assets += 1
                sev, risk_label = "high", "HIGH Risk"
            elif "medium" in doc_levels:
                sev, risk_label = "medium", "MEDIUM Risk"
            else:
                sev, risk_label = "low", "LOW Risk"
            truck_rows.append({
                "id": t.get("truck_id"),
                "asset": t.get("truck_number") or t.get("truck_id"),
                "type": t.get("vehicle_type", "Unknown"),
                "status": t.get("truck_status", "ACTIVE"),
                "risk_score": 85 if sev == "critical" else 70 if sev == "high" else 50 if sev == "medium" else 20,
                "risk_label": risk_label,
                "alert_severity": sev,
                "documents": docs,
            })

        # Fetch all driver incidents in one query
        all_incidents_resp = (
            supabase.table("lg_driver_incidents")
            .select("driver_id")
            .eq("user_id", uid)
            .execute()
        )
        incident_counts: dict[str, int] = {}
        for inc in (all_incidents_resp.data or []):
            did = str(inc.get("driver_id") or "")
            if did:
                incident_counts[did] = incident_counts.get(did, 0) + 1

        driver_rows = []
        for d in drivers_raw:
            lic = _doc(d.get("license_expiry_date"))
            docs = {"license": lic} if lic else {}
            sev = lic["level"] if lic else "low"
            if sev == "critical":
                critical_expiries += 1
            elif sev == "high":
                high_risk_assets += 1
            incident_count = incident_counts.get(str(d.get("driver_id") or ""), 0)
            driver_rows.append({
                "id": d.get("driver_id"),
                "name": d.get("driver_name") or d.get("driver_id"),
                "status": d.get("driver_status", "ACTIVE"),
                "license_number": d.get("license_number", ""),
                "incidents": incident_count,
                "risk_score": 85 if sev == "critical" else 70 if sev == "high" else 50 if sev == "medium" else 20,
                "risk_label": ("CRITICAL" if sev == "critical" else "HIGH" if sev == "high" else "MEDIUM" if sev == "medium" else "LOW") + " Risk",
                "alert_severity": sev,
                "documents": docs,
            })

        return {
            "data": {
                "kpis": {
                    "critical_expiries": critical_expiries,
                    "high_risk_assets": high_risk_assets,
                    "fleet_tracked": len(truck_rows),
                    "drivers_tracked": len(driver_rows),
                },
                "trucks": truck_rows,
                "drivers": driver_rows,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Risk Analytics View ───────────────────────────────────────────────────────

@router.get("/risk-analytics")
async def get_risk_analytics_view(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        ship_resp = (
            supabase.table("lg_shipments")
            .select("shipment_id, origin_city, destination_city, vendor_id")
            .eq("user_id", uid)
            .execute()
        )
        shipments = ship_resp.data or []

        snap_resp = (
            supabase.table("lg_shipment_risk_snapshots")
            .select("shipment_id, overall_risk_score, vendor_risk_score")
            .eq("user_id", uid)
            .execute()
        )
        snaps_by_ship = {str(s["shipment_id"]): s for s in (snap_resp.data or [])}

        # Top routes — build from shipments + snapshots
        route_map: dict[str, dict] = {}
        for ship in shipments:
            route = f"{ship.get('origin_city','?')} → {ship.get('destination_city','?')}"
            snap = snaps_by_ship.get(str(ship.get("shipment_id")), {})
            rs = _safe_float(snap.get("overall_risk_score"))
            if route not in route_map:
                route_map[route] = {"scores": [], "count": 0}
            route_map[route]["scores"].append(rs)
            route_map[route]["count"] += 1

        top_routes = []
        for name, info in sorted(route_map.items(), key=lambda x: -sum(x[1]["scores"]) / max(len(x[1]["scores"]), 1)):
            avg = sum(info["scores"]) / len(info["scores"]) if info["scores"] else 0
            top_routes.append({"name": name, "risk_score": round(avg, 1), "shipments": info["count"], "risk_level": _risk_level(avg)})

        # Vendor comparison — vendor risk score from shipments lookup
        vendors_resp = (
            supabase.table("lg_vendors")
            .select("vendor_id, vendor_name")
            .eq("user_id", uid)
            .execute()
        )
        vendors = vendors_resp.data or []

        # Build vendor → risk scores via shipments (vendor_id is on shipments table)
        vendor_snaps: dict[str, list] = {}
        for ship in shipments:
            vid = str(ship.get("vendor_id") or "")
            snap = snaps_by_ship.get(str(ship.get("shipment_id")), {})
            vs = _safe_float(snap.get("vendor_risk_score"))
            if vid:
                vendor_snaps.setdefault(vid, []).append(vs)

        vpm_resp = (
            supabase.table("lg_vendor_performance_metrics")
            .select("vendor_id, on_time_percentage, delay_rate_percentage, performance_window")
            .eq("user_id", uid)
            .order("calculation_date", desc=True)
            .execute()
        )
        vpm_by_vendor: dict[str, dict] = {}
        for vpm in (vpm_resp.data or []):
            vid = str(vpm.get("vendor_id") or "")
            if vid not in vpm_by_vendor:
                vpm_by_vendor[vid] = vpm

        vendor_comparison = []
        for v in vendors:
            vid = str(v.get("vendor_id"))
            scores = vendor_snaps.get(vid, [])
            avg_risk = sum(scores) / len(scores) if scores else 0.0
            vpm = vpm_by_vendor.get(vid, {})
            vendor_comparison.append({
                "vendor_name": v.get("vendor_name") or vid,
                "risk_score": round(avg_risk, 1),
                "delay_rate_pct": _safe_float(vpm.get("delay_rate_percentage")),
                "on_time_pct": _safe_float(vpm.get("on_time_percentage")),
            })
        vendor_comparison.sort(key=lambda x: -x["risk_score"])

        # Market volatility — join route_id with lg_routes for readable names
        routes_resp = (
            supabase.table("lg_routes")
            .select("route_id, origin_city, destination_city")
            .eq("user_id", uid)
            .execute()
        )
        route_names = {str(r.get("route_id")): f"{r.get('origin_city','?')} → {r.get('destination_city','?')}" for r in (routes_resp.data or [])}

        mfi_resp = (
            supabase.table("lg_market_freight_intelligence")
            .select("route_id, volatility_index")
            .eq("user_id", uid)
            .execute()
        )
        mfi_map: dict[str, list] = {}
        for row in (mfi_resp.data or []):
            rid = str(row.get("route_id") or "")
            name = route_names.get(rid) or f"Route {rid}"
            mfi_map.setdefault(name, []).append(_safe_float(row.get("volatility_index")))
        market_volatility = sorted(
            [{"name": k, "volatility": round(sum(v) / len(v), 3)} for k, v in mfi_map.items()],
            key=lambda x: -x["volatility"],
        )[:10]

        # Risk weight contributors
        rw_resp = (
            supabase.table("lg_risk_weight_configuration")
            .select("compliance_weight, vendor_weight, operational_weight, financial_weight")
            .eq("user_id", uid)
            .limit(1)
            .execute()
        )
        rw = (rw_resp.data or [{}])[0]
        compliance_w = _safe_float(rw.get("compliance_weight"), 25.0)
        vendor_w = _safe_float(rw.get("vendor_weight"), 25.0)
        operational_w = _safe_float(rw.get("operational_weight"), 25.0)
        financial_w = _safe_float(rw.get("financial_weight"), 25.0)
        total_w = compliance_w + vendor_w + operational_w + financial_w or 100.0
        contributors = [
            {"name": "Operational", "contribution_pct": round(operational_w / total_w * 100, 1)},
            {"name": "Financial", "contribution_pct": round(financial_w / total_w * 100, 1)},
            {"name": "Vendor", "contribution_pct": round(vendor_w / total_w * 100, 1)},
            {"name": "Compliance", "contribution_pct": round(compliance_w / total_w * 100, 1)},
        ]

        return {
            "data": {
                "top_routes": top_routes[:10],
                "vendor_comparison": vendor_comparison[:15],
                "market_volatility": market_volatility,
                "contributors": contributors,
                "insight_text": "Adjust weights in risk configuration to reprioritize scoring components.",
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Vendor Intel View ─────────────────────────────────────────────────────────

@router.get("/vendor-intel")
async def get_vendor_intel_view(
    vendor_id: str | None = Query(None),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        vendors_resp = (
            supabase.table("lg_vendors")
            .select("vendor_id, vendor_name, vendor_status")
            .eq("user_id", uid)
            .order("vendor_name")
            .execute()
        )
        vendors = vendors_resp.data or []

        target_id = vendor_id
        if not target_id and vendors:
            target_id = str(vendors[0].get("vendor_id"))

        selected_vendor = next((v for v in vendors if str(v.get("vendor_id")) == str(target_id)), vendors[0] if vendors else {})

        selected_data: dict = {}
        if target_id and selected_vendor:
            ships_resp = (
                supabase.table("lg_shipments")
                .select("shipment_id, shipment_status, origin_city, destination_city, shipment_value")
                .eq("user_id", uid)
                .eq("vendor_id", str(target_id))
                .execute()
            )
            vendor_ships = ships_resp.data or []
            ship_ids = [str(s["shipment_id"]) for s in vendor_ships]

            risk_rows = []
            if ship_ids:
                snaps_resp = (
                    supabase.table("lg_shipment_risk_snapshots")
                    .select("shipment_id, overall_risk_score, financial_exposure_score")
                    .eq("user_id", uid)
                    .in_("shipment_id", ship_ids[:200])
                    .order("overall_risk_score", desc=True)
                    .execute()
                )
                risk_rows = snaps_resp.data or []

            risk_scores = [_safe_float(r.get("overall_risk_score")) for r in risk_rows]
            avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
            total_value = sum(_safe_float(s.get("shipment_value")) for s in vendor_ships)

            status_counts: dict[str, int] = {}
            for s in vendor_ships:
                st = s.get("shipment_status", "UNKNOWN")
                status_counts[st] = status_counts.get(st, 0) + 1
            status_mix = [{"status": k, "count": v} for k, v in status_counts.items()]

            vpm_resp = (
                supabase.table("lg_vendor_performance_metrics")
                .select("on_time_percentage, delay_rate_percentage")
                .eq("user_id", uid)
                .eq("vendor_id", str(target_id))
                .order("calculation_date", desc=True)
                .limit(1)
                .execute()
            )
            vpm = (vpm_resp.data or [{}])[0]
            on_time = _safe_float(vpm.get("on_time_percentage"), 0.0)
            delay_rate = _safe_float(vpm.get("delay_rate_percentage"), 0.0)

            snap_by_ship = {str(r["shipment_id"]): r for r in risk_rows}
            flags = []
            for s in vendor_ships:
                snap = snap_by_ship.get(str(s.get("shipment_id")), {})
                risk = _safe_float(snap.get("overall_risk_score"))
                status = s.get("shipment_status", "")
                if status in ("DELAYED", "DELAY") or risk >= 70:
                    flags.append({
                        "shipment_id": s.get("shipment_id"),
                        "origin_city": s.get("origin_city"),
                        "destination_city": s.get("destination_city"),
                        "shipment_status": status,
                        "overall_risk_score": round(risk, 1),
                        "financial_exposure": _safe_float(snap.get("financial_exposure_score")),
                        "shipment_value": _safe_float(s.get("shipment_value")),
                    })

            high_risk_loads = len([r for r in risk_rows if _safe_float(r.get("overall_risk_score")) >= 70])

            if avg_risk >= 70:
                insight_text = f"Vendor {selected_vendor.get('vendor_name')} shows high average risk of {avg_risk:.1f}/100. Immediate review of carrier contracts is recommended."
            elif avg_risk >= 50:
                insight_text = f"Vendor {selected_vendor.get('vendor_name')} has moderate risk at {avg_risk:.1f}/100. On-time delivery at {on_time:.1f}%. Monitor closely."
            else:
                insight_text = f"Vendor {selected_vendor.get('vendor_name')} is performing within acceptable thresholds. Risk score {avg_risk:.1f}/100 with {on_time:.1f}% on-time rate."

            selected_data = {
                "vendor": selected_vendor,
                "kpis": {
                    "on_time_pct": on_time,
                    "delay_rate_pct": delay_rate,
                    "total_shipments": len(vendor_ships),
                    "avg_risk": round(avg_risk, 1),
                    "financial_exposure": total_value,
                    "high_risk_loads": high_risk_loads,
                },
                "status_mix": status_mix,
                "latest_risk_rows": [{"shipment_id": r.get("shipment_id"), "overall_risk_score": _safe_float(r.get("overall_risk_score"))} for r in risk_rows[:20]],
                "flags": flags[:10],
                "insight_text": insight_text,
                "recommendation": "No delayed or high-risk shipments are currently assigned to this vendor." if not flags else f"{len(flags)} shipment(s) require immediate attention.",
            }

        return {
            "data": {
                "vendors": [{"vendor_id": v.get("vendor_id"), "vendor_name": v.get("vendor_name")} for v in vendors],
                "selected": selected_data,
            }
        }
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
