import os
from langchain_community.vectorstores import FAISS
from app.services.education.schema_index.schema_indexer import get_embeddings, get_index_path


def get_relevant_tables(question: str, user_id: str):
    index_path = get_index_path(user_id)

    if not os.path.exists(index_path):
        print(f"FAISS index not found for user {user_id}")
        return []

    embeddings = get_embeddings()

    vector_db = FAISS.load_local(
        index_path,
        embeddings,
        allow_dangerous_deserialization=True
    )

    docs = vector_db.similarity_search(question, k=5)

    tables = list(dict.fromkeys(
        [doc.metadata["table"] for doc in docs]
    ))

    return tables