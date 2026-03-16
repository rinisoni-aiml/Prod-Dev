from fastapi import APIRouter, Depends, HTTPException, Query
from app.models.alerts import AlertCreate
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase
from datetime import datetime, timezone

router = APIRouter()


@router.get("/")
async def get_alerts(
    resolved: bool | None = Query(None),
    severity: str | None = Query(None),
    current_user=Depends(get_current_user),
):
    uid = str(current_user.id)
    try:
        q = supabase.table("alerts").select("*").eq("user_id", uid).order("created_at", desc=True)
        if resolved is not None:
            q = q.eq("is_resolved", resolved)
        if severity:
            q = q.eq("severity", severity)
        resp = q.execute()
        return resp.data or []
    except Exception:
        return []


@router.post("/")
async def create_alert(alert: AlertCreate, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        data = alert.model_dump()
        data["user_id"] = uid
        resp = supabase.table("alerts").insert(data).execute()
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("alerts")
            .update({"is_resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", alert_id)
            .eq("user_id", uid)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        return resp.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
