import logging
from app.services.education.database.run_query import run_sql, get_sample_rows
from app.services.education.database.schema_fetcher import get_all_tables, get_table_schema
from app.services.education.ai.analytics_generator import generate_analytics

logger = logging.getLogger(__name__)

SKIP_TABLES = ['datasets_metadata', 'schema_index', 'embeddings']


def get_user_tables(user_id: str) -> list:
    short_id = user_id.replace("-", "")[:8]
    all_tables = get_all_tables()
    return [t for t in all_tables if t.startswith(f"{short_id}_") and t not in SKIP_TABLES]


def build_dashboard(user_id: str):
    tables = get_user_tables(user_id)
    logger.info(f"Tables for user {user_id}: {tables}")

    if not tables:
        logger.warning("No tables found for user!")
        return {"kpis": [], "insights": [], "recommendations": []}

    schemas = []
    samples = []
    for table in tables:
        schema = get_table_schema(table)
        schemas.append(schema)
        cols_line = schema.split('\n')[0] if schema else ""
        col_names = [col.strip() for col in cols_line.split(',')]
        samples.append({"table": table, "columns": col_names})

    full_schema = "\n\n".join(schemas)
    analytics = generate_analytics(full_schema, samples)

    insights = analytics.get("insights", [])
    recs = analytics.get("recommendations", [])

    # ── Detect tables dynamically using flexible matching ─────────────
    class_tables  = [t for t in tables if "class" in t.lower() or "student" in t.lower()]
    fee_table     = next((t for t in tables if "fee" in t.lower() or "school" in t.lower()), None)
    faculty_table = next((t for t in tables if "faculty" in t.lower() or "staff" in t.lower()), None)
    attend_col    = "Attendance_Percentage"

    # ── KPI 1: Total Students ────────────────────────────────────────
    total_students = 0
    for t in class_tables:
        try:
            count = run_sql(f'SELECT COUNT(*) FROM "{t}"')
            total_students += int(count or 0)
        except Exception as e:
            logger.warning(f"Could not count {t}: {e}")

    # ── KPI 2: Avg Attendance ────────────────────────────────────────
    avg_attendance = None
    attend_totals = []
    for t in class_tables:
        try:
            avg = run_sql(f'SELECT AVG("{attend_col}") FROM "{t}"')
            if avg is not None:
                attend_totals.append(float(avg))
        except Exception as e:
            logger.warning(f"Could not get attendance from {t}: {e}")
    if attend_totals:
        avg_attendance = round(sum(attend_totals) / len(attend_totals), 1)

    # ── KPI 3: Total Fee Collected ───────────────────────────────────
    fee_total = None
    if fee_table:
        try:
            result = run_sql(f'SELECT SUM("Total Fee") FROM "{fee_table}"')
            if result is not None:
                fee_total = round(float(result), 0)
        except Exception:
            try:
                result = run_sql(f'''
                    SELECT SUM(
                        COALESCE("Admission Fee", 0) +
                        COALESCE("Tuition Fee", 0) +
                        COALESCE("Transport Fee", 0) +
                        COALESCE("Hostel Fee", 0) +
                        COALESCE("Miscellaneous Fees", 0)
                    )
                    FROM "{fee_table}"
                ''')
                if result is not None:
                    fee_total = round(float(result), 0)
            except Exception as e2:
                logger.warning(f"Fee KPI failed: {e2}")

    # ── KPI 4: Total Faculty ─────────────────────────────────────────
    faculty_count = None
    if faculty_table:
        try:
            faculty_count = int(run_sql(f'SELECT COUNT(*) FROM "{faculty_table}"') or 0)
        except Exception as e:
            logger.warning(f"Faculty KPI failed: {e}")

    kpi_results = [
        {"label": "Total Students", "value": total_students, "icon": "users", "color": "blue"},
        {"label": "Avg Attendance %", "value": avg_attendance if avg_attendance is not None else "—", "icon": "activity", "color": "green"},
        {"label": "Total Fee Collected", "value": fee_total if fee_total is not None else "—", "icon": "rupee", "color": "yellow"},
        {"label": "Total Faculty", "value": faculty_count if faculty_count is not None else "—", "icon": "target", "color": "purple"}
    ]

    logger.info(f"KPIs resolved: {kpi_results}")

    # ── Insights ─────────────────────────────────────────────────────
    insight_results = []
    for insight in insights:
        try:
            data = run_sql(insight["sql_query"])
            insight_results.append({
                "domain": insight.get("domain", "General"),
                "title": insight["title"],
                "detail": insight.get("detail", ""),
                "chart": insight.get("chart_type", "bar"),
                "severity": insight.get("severity", "info"),
                "data": data if isinstance(data, list) else []
            })
        except Exception as e:
            logger.error(f"Failed insight SQL [{insight.get('title')}]: {e}")
            insight_results.append({
                "domain": insight.get("domain", "General"),
                "title": insight["title"],
                "detail": insight.get("detail", ""),
                "chart": insight.get("chart_type", "bar"),
                "severity": insight.get("severity", "info"),
                "data": []
            })

    # ── Recommendations ──────────────────────────────────────────────
    rec_results = []
    for rec in recs:
        rec_results.append({
            "priority": rec.get("priority", "medium"),
            "domain": rec.get("domain", "General"),
            "title": rec["title"],
            "detail": rec.get("detail", ""),
            "action": rec.get("action", "")
        })

    return {
        "kpis": kpi_results,
        "insights": insight_results,
        "recommendations": rec_results
    }