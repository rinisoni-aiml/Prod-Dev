"""
Logistics AI Chat Router — /api/logistics/v1/ai/*
Manages chat sessions and messages stored in Supabase.
Generates contextual responses from live logistics data.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
from app.industries.logistics.models.schemas import AIChatRequest

router = APIRouter()


def _safe_float(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _generate_response(question: str, uid: str) -> str:
    """Generate a data-grounded response from logistics tables."""
    q = question.lower()

    try:
        # Fetch context data
        snap_resp = supabase.table("lg_shipment_risk_snapshots").select("overall_risk_score, alert_generated, alert_severity").eq("user_id", uid).execute()
        snaps = snap_resp.data or []

        ship_resp = supabase.table("lg_shipments").select("shipment_id, shipment_status, origin_city, destination_city").eq("user_id", uid).execute()
        ships = ship_resp.data or []

        risk_scores = [_safe_float(s.get("overall_risk_score")) for s in snaps]
        avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
        active = [s for s in ships if s.get("shipment_status") not in ("DELIVERED", "CANCELLED")]
        delayed = [s for s in ships if s.get("shipment_status") in ("DELAYED", "DELAY")]
        critical_alerts = [s for s in snaps if s.get("alert_severity") == "critical"]
        high_alerts = [s for s in snaps if s.get("alert_severity") == "high"]

        # Route to relevant response
        if any(w in q for w in ["risk", "risky", "score", "dangerous"]):
            return (
                f"Current fleet average risk score is **{avg_risk:.1f}/100**. "
                f"There are **{len(critical_alerts)} critical** and **{len(high_alerts)} high** risk alerts active. "
                f"Focus on the highest-risk corridors shown in the Route Risk Heatmap on the Dashboard."
            )
        elif any(w in q for w in ["shipment", "active", "transit", "moving"]):
            return (
                f"There are **{len(active)} active shipments** currently in the system out of **{len(ships)} total**. "
                f"**{len(delayed)} shipment(s)** are delayed. "
                f"Use the Shipment Risk page to drill into individual shipment details."
            )
        elif any(w in q for w in ["delay", "late", "overdue"]):
            if delayed:
                routes = [f"{s.get('origin_city','?')} → {s.get('destination_city','?')}" for s in delayed[:3]]
                return f"**{len(delayed)} shipment(s)** are currently delayed. Key routes affected: {', '.join(routes)}. Review carrier assignments and reroute options."
            return "No delayed shipments detected at this time. Fleet is operating within schedule."
        elif any(w in q for w in ["vendor", "carrier", "supplier"]):
            vpm_resp = supabase.table("lg_vendor_performance_metrics").select("vendor_id, on_time_pct, delay_rate_pct").eq("user_id", uid).order("on_time_pct").limit(3).execute()
            low_perf = vpm_resp.data or []
            if low_perf:
                worst = low_perf[0]
                return f"Lowest on-time performance vendor has **{_safe_float(worst.get('on_time_pct')):.1f}% on-time delivery** with **{_safe_float(worst.get('delay_rate_pct')):.1f}% delay rate**. Visit the Vendor Intelligence page for a full vendor breakdown."
            return "Vendor performance data is being processed. Upload vendor performance metrics for detailed analysis."
        elif any(w in q for w in ["compliance", "license", "insurance", "expir"]):
            trucks_resp = supabase.table("lg_trucks").select("truck_number, insurance_expiry_date").eq("user_id", uid).execute()
            trucks = trucks_resp.data or []
            today = datetime.utcnow().date()
            expiring_soon = [t for t in trucks if t.get("insurance_expiry_date") and (datetime.fromisoformat(t["insurance_expiry_date"][:10]).date() - today).days <= 30]
            return (
                f"**{len(expiring_soon)} truck(s)** have insurance expiring within 30 days. "
                f"Navigate to the Compliance page for a full register of expiring documents across fleet and drivers."
            )
        elif any(w in q for w in ["alert", "warning", "critical"]):
            total_alerts = len([s for s in snaps if s.get("alert_generated")])
            return (
                f"There are **{total_alerts} active alerts** across your fleet — "
                f"**{len(critical_alerts)} critical** and **{len(high_alerts)} high priority**. "
                f"Visit the Alert Center to review and resolve each alert."
            )
        elif any(w in q for w in ["recommend", "suggest", "improve", "action"]):
            lines = []
            if avg_risk >= 70:
                lines.append("Immediately review high-risk shipment corridors and consider rerouting.")
            if len(critical_alerts) > 0:
                lines.append(f"Resolve {len(critical_alerts)} critical alert(s) in the Alert Center.")
            if len(delayed) > 0:
                lines.append(f"Investigate {len(delayed)} delayed shipment(s) and contact carriers.")
            if not lines:
                lines.append("Operations are within acceptable thresholds. Continue monitoring.")
            return "**Recommended actions:**\n" + "\n".join(f"• {l}" for l in lines)
        elif any(w in q for w in ["summary", "overview", "status", "report"]):
            return (
                f"**Fleet Overview:**\n"
                f"• **{len(ships)}** total shipments tracked\n"
                f"• **{len(active)}** currently active\n"
                f"• **{len(delayed)}** delayed\n"
                f"• Average risk score: **{avg_risk:.1f}/100**\n"
                f"• Critical alerts: **{len(critical_alerts)}**\n"
                f"• High alerts: **{len(high_alerts)}**"
            )
        else:
            return (
                f"I'm your logistics AI assistant. Here's a quick snapshot:\n"
                f"• **{len(active)}** active shipments, **{len(delayed)}** delayed\n"
                f"• Average fleet risk: **{avg_risk:.1f}/100**\n"
                f"• **{len(critical_alerts)}** critical alerts requiring attention\n\n"
                f"Ask me about shipment risk, vendor performance, compliance, delays, or recommendations."
            )
    except Exception:
        return "Unable to fetch live data at this moment. Please try again shortly or check individual dashboard sections."


# ─── Chat ─────────────────────────────────────────────────────────────────────

@router.post("/chat")
async def ask_ai(body: AIChatRequest, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    session_id = body.session_id or str(uuid.uuid4())
    question = body.question.strip()

    try:
        # Store user message
        supabase.table("lg_chat_messages").insert({
            "session_id": session_id,
            "user_id": uid,
            "role": "user",
            "content": question,
        }).execute()

        # Generate response
        answer = _generate_response(question, uid)

        # Store assistant message
        supabase.table("lg_chat_messages").insert({
            "session_id": session_id,
            "user_id": uid,
            "role": "assistant",
            "content": answer,
        }).execute()

        return {"data": {"session_id": session_id, "answer": answer}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Sessions ─────────────────────────────────────────────────────────────────

@router.get("/sessions")
async def get_sessions(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("lg_chat_messages")
            .select("session_id, content, role, created_at")
            .eq("user_id", uid)
            .eq("role", "user")
            .order("created_at", desc=True)
            .execute()
        )
        rows = resp.data or []

        # Deduplicate sessions, keep first user message as title
        seen: dict[str, dict] = {}
        for row in rows:
            sid = row["session_id"]
            if sid not in seen:
                seen[sid] = {
                    "session_id": sid,
                    "title": (row.get("content") or "Chat")[:60],
                    "created_at": row.get("created_at"),
                }

        sessions = list(seen.values())[:20]
        return {"data": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("lg_chat_messages")
            .select("id, role, content, created_at")
            .eq("user_id", uid)
            .eq("session_id", session_id)
            .order("created_at")
            .limit(100)
            .execute()
        )
        return {"data": resp.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        supabase.table("lg_chat_messages").delete().eq("user_id", uid).eq("session_id", session_id).execute()
        return {"data": {"deleted": True}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
