"""
Logistics Views Router — /api/logistics/v1/views/*
Delegates all view building to view_service.py which uses the correct
risk thresholds (HIGH≥80, MEDIUM≥60) and canonical scoring from scoring_service.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime

from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
from app.industries.logistics.services.view_service import (
    build_dashboard_view,
    build_alerts_view,
    build_compliance_view,
    build_risk_analytics_view,
    build_shipment_risk_view,
    build_vendor_intel_view,
)

router = APIRouter()


# ─── Dashboard View ────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard_view(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        data = build_dashboard_view(uid)
        return {"data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Alerts View ───────────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts_view(
    limit: int = Query(50000, ge=1, le=100000),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        data = build_alerts_view(uid, limit=limit)
        return {"data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        supabase.table("lg_shipment_risk_snapshots").update(
            {"resolved_at": datetime.utcnow().isoformat()}
        ).eq("id", alert_id).eq("user_id", uid).execute()
        return {"data": {"id": alert_id, "resolved": True}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/{alert_id}/unresolve")
async def unresolve_alert(alert_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        supabase.table("lg_shipment_risk_snapshots").update(
            {"resolved_at": None}
        ).eq("id", alert_id).eq("user_id", uid).execute()
        return {"data": {"id": alert_id, "resolved": False}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Compliance View ───────────────────────────────────────────────────────────

@router.get("/compliance")
async def get_compliance_view(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        data = build_compliance_view(uid)
        return {"data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Risk Analytics View ───────────────────────────────────────────────────────

@router.get("/risk-analytics")
async def get_risk_analytics_view(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        data = build_risk_analytics_view(uid)
        return {"data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Vendor Intel View ─────────────────────────────────────────────────────────

@router.get("/vendor-intel")
async def get_vendor_intel_view(
    vendor_id: str | None = Query(None),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        data = build_vendor_intel_view(uid, vendor_id=vendor_id)
        return {"data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Shipment Risk View ────────────────────────────────────────────────────────

@router.get("/shipment-risk")
async def get_shipment_risk_view(
    shipment_id: str | None = Query(None),
    limit: int = Query(50000, ge=1, le=100000),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        data = build_shipment_risk_view(uid, shipment_id=shipment_id, limit=limit)
        return {"data": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
