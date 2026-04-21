import pandas as pd
import logging
import re
import time

from ..database.db import supabase
from ..database.metadata import save_metadata
from app.services.education.schema_index.schema_indexer import build_vector_index

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def clean_table_name(filename: str, user_id: str):
    name = filename.replace(".xlsx", "").replace(".csv", "").replace(".xls", "").lower()
    name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    short_id = user_id.replace("-", "")[:8]
    return f"{short_id}_{name}"


def clean_column_name(col: str) -> str:
    """Clean column names to be valid SQL identifiers"""
    col = str(col).strip()
    col = re.sub(r"[^a-zA-Z0-9_]", "_", col)
    if col[0].isdigit():
        col = f"col_{col}"
    return col


def ingest_excel(file, filename, user_id):
    try:
        logger.info(f"📖 Reading file: {filename} for user: {user_id}")
        df = pd.read_excel(file)

        # Clean column names
        df.columns = [clean_column_name(col) for col in df.columns]

        # Replace NaN with None for JSON compatibility
        df = df.where(pd.notnull(df), None)

        table_name = clean_table_name(filename, user_id)
        logger.info(f"📋 Creating table: {table_name}")

        # Step 1: Drop table if exists
        drop_query = f'DROP TABLE IF EXISTS "{table_name}"'
        supabase.rpc("run_raw_sql", {"query": drop_query}).execute()
        logger.info("✅ Old table dropped")

        # Step 2: Create new table
        columns_sql = ", ".join([f'"{col}" TEXT' for col in df.columns])
        create_query = f'CREATE TABLE "{table_name}" ({columns_sql})'
        supabase.rpc("run_raw_sql", {"query": create_query}).execute()
        logger.info("✅ New table created")

        # Step 3: Reload Supabase schema cache and wait
        supabase.rpc("run_raw_sql", {"query": "NOTIFY pgrst, 'reload schema'"}).execute()
        time.sleep(3)
        logger.info("✅ Schema cache reloaded")

        # Step 4: Insert rows in batches of 500
        records = df.to_dict(orient="records")
        batch_size = 500
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            supabase.table(table_name).insert(batch).execute()
            logger.info(f"✅ Inserted rows {i} to {i + len(batch)}")

        logger.info("✅ Table stored in Supabase")

        # Step 5: Save metadata
        save_metadata(table_name, df.columns.tolist(), user_id)
        logger.info("✅ Metadata saved")

        # Step 6: Build vector index
        logger.info("⏳ Building vector index...")
        build_vector_index(user_id)
        logger.info("✅ Schema index updated")

        return table_name

    except Exception as e:
        logger.error(f"❌ Upload failed: {e}")
        raise e