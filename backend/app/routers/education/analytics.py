from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.education.database.schema_fetcher import get_all_tables, get_table_schema
from app.services.education.database.run_query import get_sample_rows, run_sql
from app.services.education.analytics.section_analyzer import get_section_tables, generate_section_analytics
from jose import jwt
import traceback, logging

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()

def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = jwt.decode(
        token,
        key="",
        options={
            "verify_signature": False,
            "verify_aud": False,
            "verify_exp": False
        }
    )
    return payload.get("sub")

async def build_section(section: str, user_id: str):
    short_id = user_id.replace("-", "")[:8]
    skip = ['datasets_metadata', 'schema_index', 'embeddings']
    all_tables = get_all_tables()
    # Only get this user's tables
    user_tables = [t for t in all_tables if t.startswith(f"{short_id}_")]
    tables = get_section_tables(section, user_tables, get_table_schema, skip)

    if not tables:
        return {"charts": [], "risks": [], "recommendations": [], "tables": []}

    schemas = []
    samples = []
    for table in tables:
        schema = get_table_schema(table)
        schemas.append(schema)
        rows = get_sample_rows(table, limit=3)
        samples.append({"table": table, "rows": rows})

    full_schema = "\n\n".join(schemas)
    insights = generate_section_analytics(section, full_schema, samples)

    charts = []
    for chart in insights.get("charts", []):
        try:
            data = run_sql(chart["sql"])
            charts.append({"title": chart["title"], "chart": chart["chart_type"], "data": data})
        except Exception as e:
            logger.error(f"Chart SQL failed: {e}")
            continue

    return {
        "charts": charts,
        "risks": insights.get("risks", []),
        "recommendations": insights.get("recommendations", []),
        "tables": tables
    }

@router.get("/{section}")
async def section_analytics(section: str, user_id: str = Depends(get_user_id)):
    if section not in ["academic", "admissions", "faculty", "placements"]:
        return JSONResponse({"error": "Invalid section"}, status_code=400)
    try:
        result = await build_section(section, user_id)
        return JSONResponse(result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)