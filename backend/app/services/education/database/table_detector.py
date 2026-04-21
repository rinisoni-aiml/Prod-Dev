from app.services.education.database.db import supabase
import os
import logging
import faiss
import pickle
import numpy as np
from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

_embeddings = None

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    return _embeddings


def get_index_path(user_id: str) -> str:
    short_id = user_id.replace("-", "")[:8]
    return f"schema_index_{short_id}"


def get_relevant_tables(question: str, user_id: str) -> list:
    short_id = user_id.replace("-", "")[:8]

    try:
        # Try FAISS index first
        index_path = get_index_path(user_id)
        if os.path.exists(index_path):
            from langchain_community.vectorstores import FAISS
            embeddings = get_embeddings()
            vector_db = FAISS.load_local(
                index_path, embeddings, allow_dangerous_deserialization=True
            )
            docs = vector_db.similarity_search(question, k=3)
            tables = list({doc.metadata["table"] for doc in docs})
            if tables:
                logger.info(f"Tables from FAISS: {tables}")
                return tables
    except Exception as e:
        logger.warning(f"FAISS lookup failed: {e}")

    # Fallback: get tables from Supabase directly
    try:
        result = supabase.rpc("get_all_tables").execute()
        all_tables = [row["table_name"] for row in result.data]
        user_tables = [t for t in all_tables if t.startswith(f"{short_id}_")]
        logger.info(f"Tables from Supabase fallback: {user_tables}")
        return user_tables
    except Exception as e:
        logger.error(f"Supabase fallback failed: {e}")
        return []