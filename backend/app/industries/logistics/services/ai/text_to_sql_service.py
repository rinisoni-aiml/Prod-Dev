"""
Text-to-SQL Pipeline: Natural language → SQL → plain English answers via Groq LLM.
Adapted from logistics-ai-main for Supabase lg_* tables with user_id row security.
All domain guards, rate limiting, LLM models, and retry logic preserved exactly.
"""
from __future__ import annotations

import logging
import os
import re
import time as _time
import uuid

from app.industries.logistics.services.ai.schema_context_service import SCHEMA_CONTEXT
from app.industries.logistics.utils.db import get_session
from app.industries.logistics.utils.llm_init import get_llm
from app.shared.utils.supabase_client import supabase
from sqlalchemy import text

logger = logging.getLogger(__name__)

SQL_MODEL = "llama-3.3-70b-versatile"
ANSWER_MODEL = "llama-3.1-8b-instant"
ENTITY_ID_PATTERN = re.compile(r"\b[A-Za-z]{1,3}\d{1,6}\b")
NUMERIC_ID_PATTERN = re.compile(r"\b\d{1,6}\b")

_query_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL_SECONDS: int = 300

# Domain keywords — copied exactly from logistics-ai-main
_DOMAIN_KEYWORDS = {
    "shipment", "shipments", "cargo", "delivery", "dispatch", "consignment", "order", "orders",
    "vendor", "vendors", "supplier", "carrier", "partner",
    "driver", "drivers", "license", "incident", "incidents", "accident", "violation", "breakdown",
    "truck", "trucks", "vehicle", "fleet", "lorry", "insurance", "fitness", "registration",
    "route", "routes", "origin", "destination", "distance", "corridor", "lane",
    "risk", "score", "alert", "compliance", "snapshot",
    "cost", "financial", "market", "rate", "expense", "variance", "overrun", "margin",
    "delay", "delayed", "kpi", "summary", "overview", "dashboard",
}

OUT_OF_DOMAIN_RESPONSE = "I only answer logistics-related questions."
NO_DATA_RESPONSE = "No matching logistics data found."
UNCLEAR_QUERY_RESPONSE = "I couldn't understand the query. Please rephrase."
_AMBIGUOUS_QUERY_PATTERNS = [
    r"^show(?:\s+me)?$", r"^list(?:\s+all)?$", r"^details?$",
    r"^status$", r"^data$", r"^info(?:rmation)?$", r"^help$",
    r"^tell\s+me$", r"^what\s+about\s+this$",
]
_MATH_EXPRESSION_PATTERN = re.compile(r"\b\d+\s*[+\-*/]\s*\d+\b")
_AMOUNT_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\b")

# lg_* compact schema for dynamic injection
COMPACT_SCHEMA: dict[str, str] = {
    "lg_shipments": (
        "lg_shipments(user_id UUID REQUIRED, shipment_id UUID PK, route_id FK->lg_routes, "
        "origin_city, origin_state, destination_city, destination_state, shipment_value NUMERIC, "
        "dispatch_datetime TIMESTAMP, delivery_deadline TIMESTAMP, "
        "actual_delivery_datetime TIMESTAMP nullable, vendor_id FK->lg_vendors, "
        "driver_id FK->lg_drivers, truck_id FK->lg_trucks, "
        "shipment_status[CREATED|DISPATCHED|IN_TRANSIT|DELIVERED|DELAYED|CANCELLED])"
    ),
    "lg_vendors": (
        "lg_vendors(user_id UUID REQUIRED, vendor_id PK, vendor_name, "
        "vendor_status[ACTIVE|SUSPENDED|BLACKLISTED]) "
        "!! NO performance columns — use lg_vendor_performance_metrics"
    ),
    "lg_vendor_performance_metrics": (
        "lg_vendor_performance_metrics(user_id UUID REQUIRED, vendor_id FK, calculation_date, "
        "performance_window[30D|90D|LIFETIME] — always filter '30D' by default, "
        "on_time_percentage 0-100, delay_rate_percentage 0-100, claim_ratio_percentage 0-100)"
    ),
    "lg_drivers": (
        "lg_drivers(user_id UUID REQUIRED, driver_id PK, driver_name, "
        "license_expiry_date DATE, driver_status[ACTIVE|SUSPENDED|INACTIVE]) "
        "!! NO incident columns — use lg_driver_incidents"
    ),
    "lg_driver_incidents": (
        "lg_driver_incidents(user_id UUID REQUIRED, incident_id PK, driver_id FK->lg_drivers, "
        "shipment_id FK nullable, incident_type VARCHAR, "
        "incident_severity[LOW|MEDIUM|HIGH], incident_date DATE)"
    ),
    "lg_trucks": (
        "lg_trucks(user_id UUID REQUIRED, truck_id PK, truck_number UNIQUE, "
        "insurance_expiry_date DATE, fitness_expiry_date DATE, registration_expiry_date DATE, "
        "vehicle_type[20FT|32FT|TRAILER|CONTAINER|LCV|MXL], "
        "truck_status[ACTIVE|IN_MAINTENANCE|INACTIVE])"
    ),
    "lg_shipment_financials": (
        "lg_shipment_financials(user_id UUID REQUIRED, shipment_id UUID PK, "
        "declared_value NUMERIC, insurance_coverage_value NUMERIC, expected_margin NUMERIC)"
    ),
    "lg_shipment_cost_planning_actuals": (
        "lg_shipment_cost_planning_actuals(user_id UUID REQUIRED, shipment_id UUID PK, "
        "planned_transport_cost, actual_transport_cost, distance_km, "
        "detention_cost, penalty_cost, cost_variance, cost_variance_percentage, "
        "market_volatility_index, market_capacity_shortage_index)"
    ),
    "lg_shipment_risk_snapshots": (
        "lg_shipment_risk_snapshots(user_id UUID REQUIRED, shipment_id UUID PK, "
        "compliance_risk_score 0-100, vendor_risk_score 0-100, "
        "operational_risk_score 0-100, financial_exposure_score 0-100, "
        "overall_risk_score 0-100, risk_category[LOW|MEDIUM|HIGH], "
        "alert_generated BOOLEAN, alert_type, estimated_financial_impact NUMERIC, "
        "calculated_at TIMESTAMP) "
        "!! Risk scores ONLY here"
    ),
    "lg_routes": (
        "lg_routes(user_id UUID REQUIRED, route_id PK, origin_city, origin_state, "
        "destination_city, destination_state, distance_km NUMERIC)"
    ),
    "lg_market_freight_intelligence": (
        "lg_market_freight_intelligence(user_id UUID REQUIRED, route_id FK->lg_routes, "
        "vehicle_type, date DATE, average_market_rate_per_km, "
        "volatility_index, capacity_shortage_index)"
    ),
    "lg_risk_weight_configuration": (
        "lg_risk_weight_configuration(user_id UUID REQUIRED, compliance_weight, vendor_weight, "
        "operational_weight, financial_weight, effective_from DATE, effective_to DATE nullable) "
        "!! Active config: WHERE effective_to IS NULL AND user_id = :user_id"
    ),
}

# Map old table names → new lg_* names for keyword detection
_TABLE_KEYWORD_MAP = {
    ("shipment", "cargo", "delivery", "dispatch", "consignment", "order"): [
        "lg_shipments", "lg_shipment_risk_snapshots", "lg_shipment_financials", "lg_shipment_cost_planning_actuals"
    ],
    ("vendor", "supplier", "carrier", "partner"): ["lg_vendors", "lg_vendor_performance_metrics"],
    ("driver", "license", "chauffeur", "operator"): ["lg_drivers", "lg_driver_incidents"],
    ("truck", "vehicle", "fleet", "lorry", "insurance", "fitness", "registration"): ["lg_trucks"],
    ("route", "origin", "destination", "distance", "corridor", "lane"): ["lg_routes", "lg_market_freight_intelligence"],
    ("risk", "score", "alert", "compliance", "snapshot"): ["lg_shipment_risk_snapshots", "lg_risk_weight_configuration"],
    ("cost", "financial", "market", "rate", "expense", "variance", "overrun", "margin"): [
        "lg_shipment_cost_planning_actuals", "lg_shipment_financials", "lg_market_freight_intelligence"
    ],
    ("incident", "accident", "violation", "breakdown"): ["lg_driver_incidents"],
}


def _make_cache_key(question: str, session_id: str = "", uid: str = "") -> str:
    return f"{uid}::{session_id}::{question.strip().lower()}"


def _get_cached_result(question: str, session_id: str = "", uid: str = "") -> dict | None:
    key = _make_cache_key(question, session_id, uid)
    entry = _query_cache.get(key)
    if entry and (_time.time() - entry[1]) < _CACHE_TTL_SECONDS:
        return entry[0]
    return None


def _set_cached_result(question: str, result: dict, session_id: str = "", uid: str = "") -> None:
    key = _make_cache_key(question, session_id, uid)
    _query_cache[key] = (result, _time.time())
    if len(_query_cache) > 500:
        oldest = min(_query_cache.items(), key=lambda x: x[1][1])[0]
        _query_cache.pop(oldest, None)


def _is_logistics_question(question: str) -> bool:
    q = (question or "").strip().lower()
    if not q:
        return False
    if any(token in q for token in _DOMAIN_KEYWORDS):
        return True
    has_entity = any(token in q for token in ["driver", "truck", "vendor", "shipment"])
    has_id_token = bool(ENTITY_ID_PATTERN.search(question or "") or NUMERIC_ID_PATTERN.search(question or ""))
    return has_entity and has_id_token


def _is_definitely_out_of_domain(question: str) -> bool:
    q = (question or "").strip().lower()
    if not q:
        return True
    if any(token in q for token in _DOMAIN_KEYWORDS):
        return False
    return bool(_MATH_EXPRESSION_PATTERN.search(q))


def _is_ambiguous_query(question: str) -> bool:
    q = (question or "").strip().lower()
    if not q or len(q) < 4:
        return True
    return any(re.match(pattern, q) for pattern in _AMBIGUOUS_QUERY_PATTERNS)


def _extract_numeric_amount(question: str) -> float | None:
    match = _AMOUNT_PATTERN.search(question or "")
    if not match:
        return None
    try:
        return float(match.group(0))
    except Exception:
        return None


def _is_vendor_financial_exposure_query(question: str) -> bool:
    q = (question or "").strip().lower()
    return ("vendor" in q) and ("exposure" in q) and (_extract_numeric_amount(q) is not None)


def _detect_relevant_tables(question: str) -> list[str]:
    q = question.lower()
    relevant: set[str] = set()
    for keywords, tables in _TABLE_KEYWORD_MAP.items():
        if any(w in q for w in keywords):
            relevant.update(tables)
    if "summary" in q or "overview" in q or "dashboard" in q or "kpi" in q:
        relevant.update(["lg_shipments", "lg_shipment_risk_snapshots"])
    if not relevant:
        return list(COMPACT_SCHEMA.keys())
    if "lg_shipments" in relevant:
        relevant.add("lg_shipment_risk_snapshots")
    return list(relevant)


_BASE_SYSTEM_RULES = """You are a senior PostgreSQL analyst for a logistics platform.
Convert the user's natural language question into a single valid PostgreSQL SELECT query.

== OUTPUT FORMAT ==
Output ONLY the raw SQL. No explanations. No markdown. No backticks. No code blocks.
If the question cannot be answered from the schema, output exactly: CANNOT_ANSWER

== CRITICAL RULES ==
1. EVERY table query MUST include: AND user_id = :user_id (or WHERE user_id = :user_id for first condition)
2. All tables are prefixed lg_* (e.g. lg_shipments, lg_vendors, lg_drivers, etc.)
3. Only SELECT statements — never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE.
4. Always add LIMIT 50 for list/detail queries. COUNT queries do NOT need LIMIT.
5. For "how many" questions use COUNT(*) with a descriptive alias.
6. Use CURRENT_DATE for date comparisons.
7. When joining lg_vendor_performance_metrics always filter: performance_window = '30D' unless user specifies.
8. Use DISTINCT when counting entities that could appear in multiple rows.
9. For aggregations (AVG, SUM, MAX, MIN), always GROUP BY the appropriate identifier columns.
10. When question mentions a vendor/driver/truck name, use ILIKE for matching.
11. For "top N" questions use ORDER BY ... DESC LIMIT N.
12. For ID lookups use tolerant matching: (driver_id::text ILIKE 'D72' OR regexp_replace(driver_id::text, '[^0-9]', '', 'g') = '72')

== BUSINESS LOGIC ==
- "expired [document]" → expiry_date < CURRENT_DATE
- "expiring soon" → expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
- "high risk vendor" → delay_rate_percentage > 30 (lg_vendor_performance_metrics window='30D')
- "low performing vendor" → on_time_percentage < 70
- "high risk shipment" → risk_category = 'HIGH' in lg_shipment_risk_snapshots (score >= 80)
- "delayed shipment" → shipment_status = 'DELAYED'
- "cost overrun" → actual_transport_cost > planned_transport_cost
- Active risk config: lg_risk_weight_configuration WHERE effective_to IS NULL AND user_id = :user_id
"""


def _build_dynamic_sql_prompt(user_question: str) -> str:
    relevant_tables = _detect_relevant_tables(user_question)
    schema_lines = [COMPACT_SCHEMA[t] for t in relevant_tables if t in COMPACT_SCHEMA]
    schema_fragment = "\n".join(schema_lines)
    return f"{_BASE_SYSTEM_RULES}\n\n== RELEVANT SCHEMA ==\n{schema_fragment}"


REWRITE_PROMPT = """You are a query rewriting assistant for a logistics platform.
Convert the user's latest question into a fully standalone question using the chat history below.
Rules: Keep it short and specific. Add missing filters from history. If already standalone, return unchanged.
Output ONLY the rewritten question — no explanation.

CHAT HISTORY:
{history}

USER QUESTION:
{question}

REWRITTEN QUESTION:"""

ANSWER_SYSTEM_PROMPT = """You are LogiGuard AI, a logistics intelligence assistant.
You are given a user question and data retrieved from the database.

RULES:
- Answer using ONLY the provided data. Never invent numbers or facts.
- If data is empty, say exactly: "No matching logistics data found."
- For count results (single number), say it directly.
- For list results, summarize key findings in 2-3 sentences.
- Be concise and business-focused. No technical jargon, no SQL, no code.
- Always cite actual numbers from the data.
- Use plain English only — no HTML, no markdown.
"""


def clean_sql(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"```(?:sql)?", "", raw, flags=re.IGNORECASE)
    raw = raw.replace("```", "").strip()
    if raw.startswith('"') and raw.endswith('"'):
        raw = raw[1:-1].strip()
    return raw


def is_safe_sql(sql: str) -> bool:
    normalized = sql.strip().upper()
    for word in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "EXEC"]:
        if re.search(rf"\b{word}\b", normalized):
            return False
    return normalized.startswith("SELECT") or normalized.startswith("WITH")


def generate_sql(user_question: str, retry_error: str = None) -> str:
    system_prompt = _build_dynamic_sql_prompt(user_question)
    messages = [{"role": "system", "content": system_prompt}]
    if retry_error:
        messages.append({
            "role": "user",
            "content": (
                f"Question: {user_question}\n\n"
                f"Previous SQL failed: {retry_error}\n"
                f"Fix the SQL and return the corrected query only:"
            )
        })
    else:
        messages.append({"role": "user", "content": f"Question: {user_question}"})
    llm = get_llm(model=SQL_MODEL, temperature=0)
    response = llm.invoke(messages)
    return clean_sql(response.content)


def _has_entity_id_lookup_pattern(question: str) -> bool:
    q = (question or "").lower()
    has_entity = any(t in q for t in ["driver", "truck", "vendor", "shipment"])
    has_id_token = bool(ENTITY_ID_PATTERN.search(question) or NUMERIC_ID_PATTERN.search(question))
    return has_entity and has_id_token


def execute_sql(sql: str, uid: str) -> list[dict]:
    """Execute SQL with user_id bound parameter. Max 50 rows."""
    try:
        with get_session() as session:
            result = session.execute(text(sql), {"user_id": uid})
            columns = list(result.keys())
            rows = result.fetchmany(50)
            return [dict(zip(columns, row)) for row in rows]
    except Exception as exc:
        raise exc


def generate_answer(user_question: str, data: list[dict]) -> str:
    data_str = "No records found." if not data else "\n".join(str(row) for row in data[:50])
    messages = [
        {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
        {"role": "user", "content": f"Question: {user_question}\n\nData:\n{data_str}"}
    ]
    for attempt in range(3):
        try:
            llm = get_llm(model=ANSWER_MODEL, temperature=0.1)
            return llm.invoke(messages).content.strip()
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                _time.sleep(5)
                continue
            raise


# ─── Chat History (Supabase) ───────────────────────────────────────────────────

def save_message(session_id: str, uid: str, role: str, content: str) -> None:
    try:
        supabase.table("lg_chat_messages").insert({
            "session_id": session_id,
            "user_id": uid,
            "role": role,
            "content": content,
        }).execute()
    except Exception as exc:
        logger.warning("save_message failed (non-fatal): %s", exc)


def get_history(session_id: str, uid: str, limit: int = 6) -> list[dict]:
    try:
        resp = (
            supabase.table("lg_chat_messages")
            .select("role, content")
            .eq("user_id", uid)
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = list(reversed(resp.data or []))
        return [{"role": r["role"], "content": r["content"]} for r in rows]
    except Exception as exc:
        logger.warning("get_history failed: %s", exc)
        return []


def get_all_sessions(uid: str) -> list[dict]:
    try:
        resp = (
            supabase.table("lg_chat_messages")
            .select("session_id, content, created_at")
            .eq("user_id", uid)
            .eq("role", "user")
            .order("created_at", desc=True)
            .execute()
        )
        seen: dict[str, dict] = {}
        for row in (resp.data or []):
            sid = row["session_id"]
            if sid not in seen:
                seen[sid] = {
                    "session_id": sid,
                    "title": (row.get("content") or "Chat")[:60],
                    "created_at": row.get("created_at"),
                }
        return list(seen.values())[:20]
    except Exception as exc:
        logger.warning("get_all_sessions failed: %s", exc)
        return []


def delete_session(session_id: str, uid: str) -> int:
    try:
        resp = (
            supabase.table("lg_chat_messages")
            .delete()
            .eq("user_id", uid)
            .eq("session_id", session_id)
            .execute()
        )
        return len(resp.data or [])
    except Exception as exc:
        logger.warning("delete_session failed: %s", exc)
        return 0


def format_history(messages: list[dict]) -> str:
    return "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in messages)


def rewrite_query(question: str, history: list[dict]) -> str:
    if not history:
        return question
    try:
        prompt = REWRITE_PROMPT.format(history=format_history(history), question=question)
        llm = get_llm(model="llama-3.1-8b-instant", temperature=0)
        rewritten = llm.invoke([{"role": "user", "content": prompt}]).content.strip()
        return rewritten if rewritten else question
    except Exception as exc:
        logger.warning("rewrite_query failed, using original: %s", exc)
        return question


# ─── Main Pipeline ─────────────────────────────────────────────────────────────

def run_chat_query(user_question: str, session_id: str, uid: str) -> dict:
    """
    Full pipeline: guard → rewrite → SQL → execute → answer → save history.
    user_id (uid) is injected into all SQL queries as :user_id bound parameter.
    """
    if _is_definitely_out_of_domain(user_question):
        return {"answer": OUT_OF_DOMAIN_RESPONSE, "sql": None, "row_count": 0, "error": None}

    logger.info("run_chat_query: SQL_MODEL=%s ANSWER_MODEL=%s", SQL_MODEL, ANSWER_MODEL)

    cached = _get_cached_result(user_question, session_id=session_id, uid=uid)
    if cached:
        return cached

    try:
        history = get_history(session_id, uid) if session_id else []
        standalone_question = rewrite_query(user_question, history) if history else user_question

        if _is_ambiguous_query(user_question) and not history:
            return {"answer": UNCLEAR_QUERY_RESPONSE, "sql": None, "row_count": 0, "error": None}
        if _is_ambiguous_query(standalone_question):
            return {"answer": UNCLEAR_QUERY_RESPONSE, "sql": None, "row_count": 0, "error": None}
        if not _is_logistics_question(standalone_question):
            return {"answer": OUT_OF_DOMAIN_RESPONSE, "sql": None, "row_count": 0, "error": None}

        # Generate SQL
        sql = generate_sql(standalone_question)
        logger.info("Generated SQL for '%s': %s", user_question[:60], sql)

        if sql.strip().upper() == "CANNOT_ANSWER":
            return {"answer": UNCLEAR_QUERY_RESPONSE, "sql": None, "row_count": 0, "error": None}

        if not is_safe_sql(sql):
            return {"answer": "I cannot perform that type of operation.", "sql": sql, "row_count": 0, "error": "Unsafe SQL blocked"}

        # Execute SQL
        try:
            data = execute_sql(sql, uid)
        except Exception as db_error:
            logger.warning("SQL failed, retrying: %s | SQL: %s", db_error, sql)
            try:
                sql = generate_sql(standalone_question, retry_error=str(db_error))
                if not is_safe_sql(sql):
                    raise ValueError("Unsafe SQL on retry")
                data = execute_sql(sql, uid)
            except Exception as retry_error:
                logger.error("Retry also failed: %s", retry_error)
                return {"answer": UNCLEAR_QUERY_RESPONSE, "sql": sql, "row_count": 0, "error": str(retry_error)}

        # ID-aware retry for zero-row lookups
        if not data and _has_entity_id_lookup_pattern(user_question):
            try:
                id_hint = (
                    "Previous SQL returned 0 rows. IDs may be alphanumeric (e.g., D72). "
                    "Regenerate with tolerant ID matching using ::text and regexp_replace."
                )
                retry_sql = generate_sql(user_question, retry_error=id_hint)
                if is_safe_sql(retry_sql):
                    retry_data = execute_sql(retry_sql, uid)
                    if retry_data:
                        sql = retry_sql
                        data = retry_data
            except Exception:
                pass

        if not data:
            result = {"answer": NO_DATA_RESPONSE, "sql": sql, "row_count": 0, "error": None}
            _set_cached_result(user_question, result, session_id=session_id, uid=uid)
            if session_id:
                save_message(session_id, uid, "user", user_question)
                save_message(session_id, uid, "assistant", NO_DATA_RESPONSE)
            return result

        answer = generate_answer(standalone_question, data)
        result = {"answer": answer, "sql": sql, "row_count": len(data), "error": None}
        _set_cached_result(user_question, result, session_id=session_id, uid=uid)
        if session_id:
            save_message(session_id, uid, "user", user_question)
            save_message(session_id, uid, "assistant", answer)
        return result

    except Exception as exc:
        logger.error("run_chat_query failed: %s", exc)
        return {"answer": "Something went wrong. Please try again.", "sql": None, "row_count": 0, "error": str(exc)}
