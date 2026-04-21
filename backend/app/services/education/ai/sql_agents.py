import logging
from app.services.education.schema_index.table_selector import get_relevant_tables
from app.services.education.database.schema_fetcher import get_table_schema
from app.services.education.ai.sql_generator import generate_sql
from app.services.education.database.run_query import run_sql

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ask_question(question: str, user_id: str):
    logger.info(f"Question: {question} | User: {user_id}")

    tables = get_relevant_tables(question, user_id)
    logger.info(f"Relevant tables: {tables}")

    if not tables:
        return "No relevant tables found. Please upload a dataset first."

    schema = ""
    for table in tables:
        schema += get_table_schema(table) + "\n"
    logger.info(f"Schema fetched for tables: {tables}")

    sql_query = generate_sql(question, schema, tables)
    logger.info(f"Generated SQL: {sql_query}")

    result = run_sql(sql_query)
    logger.info(f"Query Result: {result}")

    return result