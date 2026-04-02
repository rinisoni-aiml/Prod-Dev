"""
Logistics API Router — /api/logistics/v1/*
Entity, analytics, risk, and insight endpoints.
All routes are scoped by the authenticated user's uid.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.industries.logistics.models.schemas import RiskWeightUpdate
from app.industries.logistics.services.ai.query_builder_service import (
    get_cost_planning,
    get_driver_incidents,
    get_drivers,
    get_high_risk_shipments,
    get_insights_summary,
    get_market_intelligence,
    get_risk_snapshots,
    get_routes,
    get_shipment_financials,
    get_shipment_kpis,
    get_shipments,
    get_trucks,
    get_vendors,
    get_master_summary,
)
from app.industries.logistics.services.scoring_service import (
    compute_and_store_risk_snapshot,
    rescore_all_for_user,
)
from app.industries.logistics.services.insight_engine_service import (
    get_shipment_overview_insight,
    get_vendor_risk_insight,
    get_compliance_insight,
    get_financial_risk_insight,
    get_operational_risk_insight,
    get_driver_incident_insight,
    get_market_freight_insight,
    invalidate_all_insights,
)
from app.shared.utils.supabase_client import supabase

router = APIRouter()


# ─── KPIs ─────────────────────────────────────────────────────────────────────

@router.get("/kpis")
async def kpis(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_shipment_kpis(uid)}


# ─── Insights ─────────────────────────────────────────────────────────────────

@router.get("/insights")
async def insights(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_insights_summary(uid)}


@router.get("/insights/llm")
async def llm_insights(current_user=Depends(get_current_user)):
    """Return all 7 LLM-generated insight cards (cached, TTL=3600s)."""
    uid = str(current_user.id)
    try:
        return {
            "data": {
                "shipment_overview": get_shipment_overview_insight(uid),
                "vendor_risk": get_vendor_risk_insight(uid),
                "compliance": get_compliance_insight(uid),
                "financial_risk": get_financial_risk_insight(uid),
                "operational_risk": get_operational_risk_insight(uid),
                "driver_incidents": get_driver_incident_insight(uid),
                "market_freight": get_market_freight_insight(uid),
            }
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/insights/invalidate")
async def invalidate_insights(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    invalidate_all_insights(uid)
    return {"data": {"invalidated": True}}


# ─── Master Summary ────────────────────────────────────────────────────────────

@router.get("/master-summary")
async def master_summary(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_master_summary(uid)}


# ─── Shipments ─────────────────────────────────────────────────────────────────

@router.get("/shipments")
async def shipments(
    limit: int = Query(50000, ge=1, le=100000),
    status: str = Query(None),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    return {"data": get_shipments(uid, limit=limit, status=status)}


@router.get("/shipments/{shipment_id}")
async def shipment_detail(shipment_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        row = (
            supabase.table("lg_shipments")
            .select("*")
            .eq("user_id", uid)
            .eq("shipment_id", shipment_id)
            .single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Shipment not found")
        return {"data": row}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/shipments/{shipment_id}/rescore")
async def rescore_shipment(shipment_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        snap = compute_and_store_risk_snapshot(shipment_id, uid)
        if snap is None:
            raise HTTPException(status_code=404, detail="Shipment not found or scoring failed")
        invalidate_all_insights(uid)
        return {"data": snap}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Vendors ──────────────────────────────────────────────────────────────────

@router.get("/vendors")
async def vendors(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_vendors(uid)}


@router.get("/vendors/{vendor_id}")
async def vendor_detail(vendor_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        row = (
            supabase.table("lg_vendors")
            .select("*")
            .eq("user_id", uid)
            .eq("vendor_id", vendor_id)
            .single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Vendor not found")
        # Attach performance metrics
        perf = (
            supabase.table("lg_vendor_performance_metrics")
            .select("*")
            .eq("user_id", uid)
            .eq("vendor_id", vendor_id)
            .order("calculation_date", desc=True)
            .limit(10)
            .execute()
            .data or []
        )
        return {"data": {**row, "performance_history": perf}}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Drivers ──────────────────────────────────────────────────────────────────

@router.get("/drivers")
async def drivers(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_drivers(uid)}


@router.get("/drivers/{driver_id}/incidents")
async def driver_incidents(driver_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_driver_incidents(uid, driver_id=driver_id)}


# ─── Trucks ───────────────────────────────────────────────────────────────────

@router.get("/trucks")
async def trucks(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    from app.industries.logistics.services.ai.query_builder_service import get_trucks as _get_trucks
    return {"data": _get_trucks(uid)}


# ─── Risk ─────────────────────────────────────────────────────────────────────

@router.get("/risk/snapshots")
async def risk_snapshots(
    limit: int = Query(50000, ge=1, le=100000),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    return {"data": get_risk_snapshots(uid, limit=limit)}


@router.get("/risk/high")
async def high_risk(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_high_risk_shipments(uid)}


@router.get("/risk/weights")
async def get_risk_weights(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        row = (
            supabase.table("lg_risk_weight_configuration")
            .select("*")
            .eq("user_id", uid)
            .is_("effective_to", "null")
            .order("effective_from", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if row:
            return {"data": row[0]}
        from app.industries.logistics.config.risk_config import DEFAULT_RISK_WEIGHTS
        return {"data": DEFAULT_RISK_WEIGHTS}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/risk/weights")
async def update_risk_weights(body: RiskWeightUpdate, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        # Close any current active row
        supabase.table("lg_risk_weight_configuration").update(
            {"effective_to": body.effective_from}
        ).eq("user_id", uid).is_("effective_to", "null").execute()

        # Insert new active row
        supabase.table("lg_risk_weight_configuration").insert({
            "user_id": uid,
            "compliance_weight": body.compliance_weight,
            "vendor_weight": body.vendor_weight,
            "operational_weight": body.operational_weight,
            "financial_weight": body.financial_weight,
            "effective_from": body.effective_from,
            "effective_to": None,
        }).execute()

        invalidate_all_insights(uid)
        return {"data": {"updated": True}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/risk/rescore-all")
async def rescore_all(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        result = rescore_all_for_user(uid)
        invalidate_all_insights(uid)
        return {"data": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Costs ────────────────────────────────────────────────────────────────────

@router.get("/costs")
async def costs(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_cost_planning(uid)}


@router.get("/financials")
async def financials(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_shipment_financials(uid)}


# ─── Market Intelligence ──────────────────────────────────────────────────────

@router.get("/market")
async def market(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_market_intelligence(uid)}


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/routes")
async def routes(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    return {"data": get_routes(uid)}
