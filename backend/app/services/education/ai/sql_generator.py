import os
import logging
import re

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY", "")
os.environ["LANGCHAIN_PROJECT"] = "aidataanalyst"

logger = logging.getLogger(__name__)

client = ChatGroq(
    model="llama-3.1-8b-instant",
    groq_api_key=os.getenv("GROQ_API_KEY")
)


def fix_column_case(sql_query: str, schema: str):
    columns = re.findall(r'"(.*?)"', schema)
    for col in columns:
        pattern = r'"{1,}' + re.escape(col) + r'"{1,}'
        sql_query = re.sub(pattern, f'"{col}"', sql_query)
        bare_pattern = r'(?<!")\b' + re.escape(col) + r'\b(?!")'
        sql_query = re.sub(bare_pattern, f'"{col}"', sql_query)
    return sql_query


def needs_quoting(table_name: str) -> bool:
    """Tables with special chars or starting with digits need quoting."""
    return not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table_name)


def fix_table_quotes(sql_query: str, tables: list) -> str:
    """Ensure tables that need quoting are quoted, others are unquoted."""
    for table in tables:
        if needs_quoting(table):
            # Make sure it IS quoted
            # Replace unquoted version with quoted
            bare_pattern = r'(?<!")\b' + re.escape(table) + r'\b(?!")'
            sql_query = re.sub(bare_pattern, f'"{table}"', sql_query)
        else:
            # Remove unnecessary quotes
            sql_query = sql_query.replace(f'"{table}"', table)
    return sql_query


def deduplicate_schema(schema: str, tables: list) -> str:
    blocks = schema.strip().split("\n\n")
    seen_columns = set()
    unique_blocks = []
    duplicate_tables = []

    for block in blocks:
        lines = block.split("\n")
        cols = "\n".join(lines[1:]).strip()
        if cols not in seen_columns:
            seen_columns.add(cols)
            unique_blocks.append(block)
        else:
            table_name = lines[0].replace('"', '').replace(' with columns:', '').strip()
            duplicate_tables.append(table_name)

    result = "\n\n".join(unique_blocks)
    if duplicate_tables:
        result += f"\n\nNOTE: These tables have the same columns as above: {', '.join(duplicate_tables)}"
    return result


def generate_sql(question: str, schema: str, tables: list):
    try:
        logger.info("Generating SQL...")

        deduped_schema = deduplicate_schema(schema, tables)
        logger.info(f"Schema chars after dedup: {len(deduped_schema)}")

        # Build quoting instructions based on table names
        table_instructions = []
        for t in tables:
            if needs_quoting(t):
                table_instructions.append(f'"{t}" (MUST be quoted)')
            else:
                table_instructions.append(f'{t} (no quotes needed)')

        prompt = f"""
PostgreSQL SQL generator. Return ONLY raw SQL, no markdown, no explanation.

RULES:
- Only use given tables and columns
- Quote column names: "Column_Name"
- Table quoting: follow the instructions per table below
- Column names are CASE-SENSITIVE

TABLES:
{chr(10).join(table_instructions)}

SCHEMA:
{deduped_schema}

QUESTION: {question}

SQL:
"""

        response = client.invoke([
            SystemMessage(content=(
                "You generate ONLY raw PostgreSQL SQL queries. "
                "No markdown. No explanation. No ```sql fences. "
                "Always quote column names with exactly one pair of double quotes. "
                "For table names, follow the quoting instructions provided."
            )),
            HumanMessage(content=prompt)
        ])

        sql_query = response.content.strip()
        sql_query = re.sub(r"```(?:sql)?", "", sql_query).replace("```", "").strip()
        sql_query = fix_column_case(sql_query, schema)
        sql_query = fix_table_quotes(sql_query, tables)

        logger.info(f"Generated SQL:\n{sql_query}")

        if not any(table in sql_query for table in tables):
            raise ValueError(f"Invalid SQL: No allowed table found.\nSQL: {sql_query}")

        forbidden = ["DROP", "DELETE", "TRUNCATE", "ALTER", "INSERT", "UPDATE"]
        if any(word in sql_query.upper() for word in forbidden):
            raise ValueError("Dangerous SQL detected and blocked.")

        return sql_query

    except Exception as e:
        logger.error(f"SQL Generation Failed: {e}")
        raise