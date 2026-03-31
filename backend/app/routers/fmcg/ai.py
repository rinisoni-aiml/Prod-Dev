from fastapi import APIRouter, Depends, HTTPException
from app.models.fmcg.chat import ChatMessage, ChatResponse, ChatSession
from app.dependencies import get_current_user
from app.services.fmcg.ai_service import generate_ai_response, generate_insights
from app.utils.supabase_client import supabase

router = APIRouter()


def _build_chat_context(uid: str) -> dict | None:
    """
    Fetch a compact snapshot of the user's data from the DB to give the LLM
    real context when answering questions.  Runs synchronously (no async needed
    for the Supabase Python client).
    """
    context: dict = {}
    try:
        # ── Demand / sales summary ─────────────────────────────────────────────
        dh_resp = (
            supabase.table("demand_history")
            .select("sku, units, date")
            .eq("user_id", uid)
            .order("units", desc=True)
            .limit(500)
            .execute()
        )
        rows = dh_resp.data or []
        if rows:
            sku_totals: dict = {}
            dates = []
            for r in rows:
                k = r.get("sku") or "Unknown"
                sku_totals[k] = sku_totals.get(k, 0) + (r.get("units") or 0)
                if r.get("date"):
                    dates.append(r["date"])
            top_skus = sorted(sku_totals.items(), key=lambda x: x[1], reverse=True)[:10]
            context["top_skus_by_sales"] = [
                {"sku": k, "total_units": round(v)} for k, v in top_skus
            ]
            context["total_skus_tracked"] = len(sku_totals)
            if dates:
                context["sales_date_range"] = {"from": min(dates), "to": max(dates)}

        # ── Inventory snapshot ─────────────────────────────────────────────────
        inv_resp = (
            supabase.table("inventory_items")
            .select("sku, product_name, status, days_left, warehouse_name, current_stock, reorder_point")
            .eq("user_id", uid)
            .limit(300)
            .execute()
        )
        items = inv_resp.data or []
        if items:
            status_counts: dict = {}
            for i in items:
                s = i.get("status", "unknown")
                status_counts[s] = status_counts.get(s, 0) + 1
            context["inventory_status_counts"] = status_counts
            context["total_inventory_items"] = len(items)

            critical = [
                i for i in items if i.get("status") in ("stockout", "low_stock")
            ]
            critical.sort(key=lambda x: x.get("days_left") or 9999)
            context["critical_items"] = [
                {
                    "sku": i.get("sku"),
                    "product_name": i.get("product_name"),
                    "status": i.get("status"),
                    "days_left": i.get("days_left"),
                    "warehouse": i.get("warehouse_name"),
                }
                for i in critical[:8]
            ]

        # ── Warehouse summary ──────────────────────────────────────────────────
        wh_resp = (
            supabase.table("warehouses")
            .select("warehouse_name, fill_rate, total_skus, stockouts")
            .eq("user_id", uid)
            .execute()
        )
        warehouses = wh_resp.data or []
        if warehouses:
            context["warehouses"] = warehouses

    except Exception:
        pass

    return context if context else None


@router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        session_id = message.session_id
        if not session_id:
            sess_resp = supabase.table("chat_sessions").insert({
                "user_id": uid,
                "title": message.message[:50],
            }).execute()
            session_id = sess_resp.data[0]["id"]

        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "user",
            "content": message.message,
        }).execute()

        # Fetch real user data to ground the LLM's answer
        context = _build_chat_context(uid)
        ai_response = await generate_ai_response(message.message, context)

        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "assistant",
            "content": ai_response,
        }).execute()

        return ChatResponse(session_id=session_id, message=message.message, response=ai_response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def get_sessions(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("chat_sessions").select("*").eq("user_id", uid).order("updated_at", desc=True).execute()
        return resp.data or []
    except Exception:
        return []


@router.post("/sessions")
async def create_session(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("chat_sessions").insert({"user_id": uid, "title": "New Chat"}).execute()
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insights")
async def get_ai_insights(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        insights = await generate_insights(uid, supabase)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommendations")
async def get_recommendations(context: dict, current_user=Depends(get_current_user)):
    try:
        response = await generate_ai_response("Provide recommendations based on this supply chain data", context)
        return {"recommendations": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
