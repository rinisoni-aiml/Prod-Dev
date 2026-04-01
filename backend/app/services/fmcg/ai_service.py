"""
FMCG AI Service

Handles LLM calls for the chatbot and insight generation.
Tries providers in order: Groq → OpenAI → Anthropic.

System prompt grounds the LLM strictly in the user's Supabase results data.
Conversation history (last 6 messages) is passed for follow-up questions.
"""

import httpx
from app.config import settings

# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are PulseIQ, an AI supply chain analyst for an FMCG (Fast-Moving Consumer Goods) company.

You answer questions EXCLUSIVELY from the actual data provided in the context block below.
NEVER invent, estimate, or hallucinate numbers.
If specific data is not in the context, say: "Data not available for this query."

## Data you have access to (from the user's latest analysis run):

### inventory_items table
Each row = one SKU's current inventory status.
Columns: sku, product_name, warehouse_name, current_stock (units on hand),
         reorder_point (trigger reorder when stock ≤ this),
         daily_avg_demand (avg units sold per day),
         days_left (days of stock remaining = current_stock / daily_avg_demand),
         status: "optimal" | "low_stock" | "stockout" | "overstock"

### demand_history table
Each row = one day's sales for one SKU.
Columns: date (YYYY-MM-DD), sku, units (actual sales), forecast (predicted — may be null for historical rows)

### warehouses table
Each row = warehouse summary.
Columns: name, location, total_skus, stockouts (count), fill_rate (%), status: "good" | "warning" | "critical"

## Rules for answering:
1. Always cite the specific numbers from the context (e.g., "Surf Excel 1kg has 342 units, 8.5 days of stock").
2. For stockout risk questions, look at status = "stockout" or "low_stock" and days_left.
3. For demand/forecast questions, look at demand_history forecast values.
4. For warehouse questions, match warehouse_name in inventory_items or name in warehouses.
5. If the context shows no data for a product/warehouse/region, respond: "No data found for [query term] in the current analysis."
6. Keep answers concise and data-driven. Use bullet points for lists of SKUs.
7. Recommend actions only when supported by the data (e.g., "Reorder X — only 2 days of stock remaining").
"""


# ─── Main AI response generator ──────────────────────────────────────────────

async def generate_ai_response(
    message: str,
    context: dict | None = None,
    history: list | None = None,
) -> str:
    """
    Generate AI response with conversation history.

    message – current user message
    context – dict of DB snapshot (from _build_chat_context)
    history – list of {"role": "user"|"assistant", "content": "..."} (last 6 msgs)
    """
    # Build the messages list: history + current user message
    messages = list(history or [])

    # Inject context into the first user turn or as a separate system injection
    user_content = message
    if context:
        user_content = (
            f"<data_context>\n{_format_context(context)}\n</data_context>\n\n"
            f"User question: {message}"
        )

    messages.append({"role": "user", "content": user_content})

    # ── Groq (LLaMA 3.3 70B — fast and capable) ─────────────────────────────
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
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            *messages,
                        ],
                        "max_tokens": 800,
                        "temperature": 0.2,
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
                            *messages,
                        ],
                        "max_tokens": 800,
                        "temperature": 0.2,
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
                        "max_tokens": 800,
                        "system": SYSTEM_PROMPT,
                        "messages": messages,
                    },
                )
                if resp.status_code == 200:
                    return resp.json()["content"][0]["text"]
        except Exception:
            pass

    return (
        "AI services are temporarily unavailable. "
        "Please check your API keys (GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY) in backend/.env"
    )


def _format_context(context: dict) -> str:
    """Format the context dict into compact readable text for the LLM."""
    lines = []

    if context.get("top_skus_by_sales"):
        lines.append("TOP SKUs BY TOTAL SALES:")
        for item in context["top_skus_by_sales"]:
            lines.append(f"  - {item['sku']}: {item['total_units']} units")

    if context.get("sales_date_range"):
        dr = context["sales_date_range"]
        lines.append(f"SALES DATE RANGE: {dr.get('from')} to {dr.get('to')}")

    if context.get("inventory_status_counts"):
        lines.append(f"INVENTORY STATUS COUNTS: {context['inventory_status_counts']}")

    if context.get("critical_items"):
        lines.append("CRITICAL / LOW STOCK ITEMS:")
        for item in context["critical_items"]:
            days = item.get("days_left")
            wh = item.get("warehouse") or "—"
            stock = item.get("current_stock")
            lines.append(
                f"  - {item.get('sku')} | warehouse: {wh} | status: {item.get('status')}"
                + (f" | days left: {days}" if days is not None else "")
                + (f" | stock: {stock}" if stock is not None else "")
            )

    if context.get("warehouses"):
        lines.append("WAREHOUSE SUMMARY:")
        for wh in context["warehouses"]:
            lines.append(
                f"  - {wh.get('name')} | total_skus: {wh.get('total_skus')} "
                f"| stockouts: {wh.get('stockouts')} | fill_rate: {wh.get('fill_rate')}%"
            )

    if context.get("recent_demand"):
        lines.append("RECENT DEMAND (last 7 days, All Products):")
        for row in context["recent_demand"][-7:]:
            lines.append(f"  - {row.get('date')}: {row.get('units')} units")

    return "\n".join(lines) if lines else "No data available."


# ─── Insight generator ───────────────────────────────────────────────────────

async def generate_insights(user_id: str, supabase) -> list:
    """Generate insights based on real inventory and alert data."""
    insights = []
    try:
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
