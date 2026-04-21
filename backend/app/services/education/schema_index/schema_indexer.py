import os
import shutil
import logging

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from app.services.education.database.db import supabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_embeddings = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        logger.info("⏳ Loading embedding model...")
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        logger.info("✅ Embedding model ready")
    return _embeddings


def get_index_path(user_id: str) -> str:
    short_id = user_id.replace("-", "")[:8]
    return f"schema_index_{short_id}"


def refresh_metadata(user_id: str):
    logger.info(f"🔄 Refreshing metadata for user {user_id}...")
    short_id = user_id.replace("-", "")[:8]
    prefix = f"{short_id}_"

    try:
        # Delete existing metadata for user
        supabase.table("datasets_metadata").delete().eq("user_id", user_id).execute()

        # Get all tables for this user from Supabase
        result = supabase.rpc("get_all_tables").execute()
        all_tables = [row["table_name"] for row in result.data]
        user_tables = [t for t in all_tables if t.startswith(prefix)]

        # For each table, get columns and insert metadata
        for table_name in user_tables:
            col_result = supabase.rpc("get_table_schema", {"t_name": table_name}).execute()
            columns = [row["column_name"] for row in col_result.data]
            columns_str = ", ".join(columns)

            supabase.table("datasets_metadata").insert({
                "user_id": user_id,
                "table_name": table_name,
                "columns": columns_str
            }).execute()

        logger.info("✅ Metadata refreshed!")

    except Exception as e:
        logger.error(f"❌ Error refreshing metadata: {e}")
        raise


def load_schema_docs(user_id: str):
    logger.info(f"🔄 Loading schema for user {user_id}...")
    docs = []
    try:
        result = supabase.table("datasets_metadata").select("table_name, columns").eq("user_id", user_id).execute()
        rows = result.data

        for row in rows:
            docs.append(
                Document(
                    page_content=f"Table {row['table_name']} has columns {row['columns']}",
                    metadata={"table": row["table_name"]}
                )
            )
        logger.info(f"✅ {len(docs)} schema documents loaded")

    except Exception as e:
        logger.error(f"❌ Error loading schema: {e}")
    return docs


def build_vector_index(user_id: str):
    logger.info(f"🚀 Building FAISS index for user {user_id}...")

    refresh_metadata(user_id)
    docs = load_schema_docs(user_id)

    if len(docs) == 0:
        logger.warning("⚠️ No schema found. Upload dataset first.")
        return

    try:
        embeddings = get_embeddings()
        index_path = get_index_path(user_id)

        if os.path.exists(index_path):
            shutil.rmtree(index_path)
            logger.info(f"🗑️ Old index deleted: {index_path}")

        vector_db = FAISS.from_documents(docs, embeddings)
        vector_db.save_local(index_path)
        logger.info(f"✅ Index saved at {index_path}")

    except Exception as e:
        logger.error(f"❌ Error building index: {e}")
        raise