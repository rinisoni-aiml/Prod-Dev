from fastapi import APIRouter, Depends, HTTPException
from app.models.fmcg.chat import ChatMessage, ChatResponse, ChatSession
from app.dependencies import get_current_user
from app.services.fmcg.ai_service import generate_ai_response, generate_insights
from app.utils.supabase_client import supabase

router = APIRouter()

# History window: number of past messages to include as conversation context
_HISTORY_WINDOW = 6


def _build_chat_context(uid: str, message: str) -> dict | None:
    """
    Fetch a compact, query-relevant snapshot from the DB to ground the LLM.

    Detects SKU / warehouse keywords in the user's message and fetches targeted
    rows rather than always returning the same top-10 items.
    Never does SELECT * — always projects only required columns.
    """
    context: dict = {}
    msg_lower = message.lower()

    try:
        # ── Demand / sales summary ─────────────────────────────────────────────
        dh_resp = (
            supabase.table("demand_history")
            .select("sku, units, date, forecast")
            .eq("user_id", uid)
            .order("units", desc=True)
            .limit(300)
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

            # Recent demand trend (last 14 days, All Products)
            recent = [r for r in rows if r.get("sku") == "All Products"]
            recent.sort(key=lambda x: x.get("date") or "")
            context["recent_demand"] = recent[-14:]

        # ── Inventory snapshot — targeted fetch ────────────────────────────────
        # Try to match SKU / warehouse from the message text for precision
        inv_query = (
            supabase.table("inventory_items")
            .select(
                "sku, product_name, warehouse_name, current_stock, "
                "reorder_point, daily_avg_demand, days_left, status"
            )
            .eq("user_id", uid)
        )

        # Targeted SKU filter: if a known SKU name appears in the query, fetch that specifically
        # (broad approach — fetch up to 200 items, let the LLM find the match)
        inv_resp = inv_query.limit(200).execute()
        items = inv_resp.data or []
        if items:
            status_counts: dict = {}
            for i in items:
                s = i.get("status", "unknown")
                status_counts[s] = status_counts.get(s, 0) + 1
            context["inventory_status_counts"] = status_counts
            context["total_inventory_items"] = len(items)

            # Critical items (stockout / low_stock), sorted by urgency
            critical = [i for i in items if i.get("status") in ("stockout", "low_stock")]
            critical.sort(key=lambda x: x.get("days_left") or 9999)
            context["critical_items"] = [
                {
                    "sku":          i.get("sku"),
                    "product_name": i.get("product_name"),
                    "status":       i.get("status"),
                    "days_left":    i.get("days_left"),
                    "warehouse":    i.get("warehouse_name"),
                    "current_stock": i.get("current_stock"),
                    "reorder_point": i.get("reorder_point"),
                }
                for i in critical[:15]
            ]

            # If the message mentions "overstock", include those too
            if "overstock" in msg_lower:
                overstocked = [i for i in items if i.get("status") == "overstock"]
                context["overstocked_items"] = [
                    {
                        "sku":          i.get("sku"),
                        "warehouse":    i.get("warehouse_name"),
                        "current_stock": i.get("current_stock"),
                    }
                    for i in overstocked[:10]
                ]

        # ── Warehouse summary ──────────────────────────────────────────────────
        # FIX: table column is "name", not "warehouse_name"
        wh_resp = (
            supabase.table("warehouses")
            .select("name, location, fill_rate, total_skus, stockouts, status")
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
        # ── Ensure session exists ──────────────────────────────────────────────
        session_id = message.session_id
        if not session_id:
            sess_resp = supabase.table("chat_sessions").insert({
                "user_id": uid,
                "title":   message.message[:50],
            }).execute()
            session_id = sess_resp.data[0]["id"]

        # ── Save user message ──────────────────────────────────────────────────
        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role":       "user",
            "content":    message.message,
        }).execute()

        # ── Fetch last N messages for conversation history ─────────────────────
        history_resp = (
            supabase.table("chat_messages")
            .select("role, content")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(_HISTORY_WINDOW + 1)   # +1 because we just inserted the current msg
            .execute()
        )
        raw_history = list(reversed(history_resp.data or []))
        # Exclude the message we just inserted (last item) — it's included in the LLM call
        history_for_llm = [
            {"role": r["role"], "content": r["content"]}
            for r in raw_history[:-1]   # everything except the last (current) message
        ]

        # ── Build data context ─────────────────────────────────────────────────
        context    = _build_chat_context(uid, message.message)
        ai_response = await generate_ai_response(
            message.message,
            context=context,
            history=history_for_llm,
        )

        # ── Save assistant response ────────────────────────────────────────────
        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role":       "assistant",
            "content":    ai_response,
        }).execute()

        return ChatResponse(
            session_id=session_id,
            message=message.message,
            response=ai_response,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def get_sessions(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = (
            supabase.table("chat_sessions")
            .select("id, title, created_at, updated_at")
            .eq("user_id", uid)
            .order("updated_at", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


@router.post("/sessions")
async def create_session(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("chat_sessions").insert({
            "user_id": uid,
            "title":   "New Chat",
        }).execute()
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
        response = await generate_ai_response(
            "Provide recommendations based on this supply chain data",
            context=context,
        )
        return {"recommendations": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
