from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.services.education.database.schema_fetcher import get_all_tables
from app.services.education.database.run_query import run_sql
import traceback, logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/stats")
async def get_stats():
    try:
        all_tables = get_all_tables()
        skip = ['datasets_metadata', 'schema_index', 'embeddings']
        class_tables = [
            t for t in all_tables
            if t not in skip
            and not t.startswith('schema')
            and not t.startswith('dataset')
            and not t.startswith('embedding')
        ]
        total_students = 0
        valid_class_tables = []
        for table in class_tables:
            try:
                count = run_sql(f'SELECT COUNT(*) FROM "{table}"')
                total_students += int(count or 0)
                valid_class_tables.append(table)
            except Exception as e:
                logger.warning(f"Skipping {table}: {e}")
                continue
        return JSONResponse({
            "total_students": total_students,
            "total_classes": len(valid_class_tables),
            "tables": valid_class_tables
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)

@router.get("/tables_count")
async def tables_count():
    try:
        tables = get_all_tables()
        return JSONResponse({"count": len(tables), "tables": tables})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)