from app.services.education.database.db import supabase
from decimal import Decimal


def safe_value(val):
    """convert any non-JSON-serializable value to a safe type"""
    if isinstance(val, Decimal):
        return float(val)
    if hasattr(val, 'isoformat'):  # datetime, date
        return val.isoformat()
    if val is None:
        return None
    return val


def get_sample_rows(table_name, limit=5):
    result = supabase.table(table_name).select("*").limit(limit).execute()
    rows = result.data
    return [[safe_value(v) for v in row.values()] for row in rows]


def run_sql(sql):
    result = supabase.rpc("run_raw_sql", {"query": sql}).execute()
    rows = result.data

    if not rows:
        return None

    # single value result
    if len(rows) == 1 and len(rows[0]) == 1:
        return safe_value(list(rows[0].values())[0])

    # multiple rows
    return [[safe_value(v) for v in row.values()] for row in rows]