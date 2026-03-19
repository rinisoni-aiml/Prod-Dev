import httpx
from app.config import settings

SYSTEM_PROMPT = (
    "You are an AI assistant for PulseIQ, a supply chain management platform for FMCG businesses. "
    "Help users with inventory management, demand forecasting, and supply chain optimisation. "
    "Be concise, data-driven, and actionable."
)


async def generate_ai_response(message: str, context: dict | None = None) -> str:
    """Generate AI response — tries Groq first, then OpenAI, then Anthropic."""
    user_content = message
    if context:
        user_content = f"Context data: {context}\n\nUser question: {message}"

    # ── Groq (LLaMA 3.1 8B — free & fast) ──────────────────────────────────
    if settings.groq_api_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_content},
                        ],
                        "max_tokens": 600,
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

    # ── OpenAI fallback ──────────────────────────────────────────────────────
    if settings.openai_api_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_content},
                        ],
                        "max_tokens": 600,
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

    # ── Anthropic fallback ───────────────────────────────────────────────────
    if settings.anthropic_api_key:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-haiku-4-5-20251001",
                        "max_tokens": 600,
                        "system": SYSTEM_PROMPT,
                        "messages": [{"role": "user", "content": user_content}],
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["content"][0]["text"]
        except Exception:
            pass

    return (
        "AI services are temporarily unavailable. "
        "Please check your API keys in the backend .env file."
    )


async def generate_insights(user_id: str, supabase) -> list:
    """Generate insights based on real inventory and alert data."""
    insights = []
    try:
        # Pull low-stock / stockout items
        items_resp = supabase.table("inventory_items") \
            .select("product_name, sku, status, days_left, warehouse_name") \
            .eq("user_id", user_id) \
            .in_("status", ["stockout", "low_stock"]) \
            .order("days_left") \
            .limit(5) \
            .execute()
        items = items_resp.data or []

        if items:
            critical = [i for i in items if i.get("status") == "stockout"]
            if critical:
                names = ", ".join(i.get("product_name") or i.get("sku") for i in critical[:2])
                insights.append({
                    "type": "warning",
                    "title": "Stockout Detected",
                    "description": f"{len(critical)} product(s) are out of stock: {names}.",
                    "action": "Create purchase orders immediately",
                    "confidence": 98,
                })
            low = [i for i in items if i.get("status") == "low_stock"]
            if low:
                insights.append({
                    "type": "info",
                    "title": "Low Stock Alert",
                    "description": f"{len(low)} product(s) have fewer than 3 days of stock remaining.",
                    "action": "Review reorder queue",
                    "confidence": 92,
                })

        # Check for expiring contracts
        contracts_resp = supabase.table("contracts") \
            .select("contract_name, vendor, end_date") \
            .eq("created_by", user_id) \
            .eq("status", "expiring_soon") \
            .limit(3) \
            .execute()
        contracts = contracts_resp.data or []
        if contracts:
            insights.append({
                "type": "warning",
                "title": "Contracts Expiring",
                "description": f"{len(contracts)} vendor contract(s) are expiring soon.",
                "action": "Review and renew contracts",
                "confidence": 100,
            })

        if not insights:
            insights.append({
                "type": "success",
                "title": "Inventory Healthy",
                "description": "No critical issues detected. Your inventory levels look good.",
                "action": "Continue monitoring",
                "confidence": 85,
            })
    except Exception:
        insights.append({
            "type": "info",
            "title": "Upload Data to Get Insights",
            "description": "Upload your inventory or sales CSV to start receiving AI-powered insights.",
            "action": "Go to Data Upload",
            "confidence": 100,
        })

    return insights
