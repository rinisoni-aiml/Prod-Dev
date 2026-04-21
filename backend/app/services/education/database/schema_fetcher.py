from app.services.education.database.db import supabase


def get_all_tables():
    result = supabase.rpc("get_all_tables").execute()
    return [row["table_name"] for row in result.data]


def get_table_schema(table_name):
    result = supabase.rpc("get_table_schema", {"t_name": table_name}).execute()
    columns = result.data

    column_definitions = []
    for column in columns:
        name = column["column_name"]
        dtype = column["data_type"]
        if "Unnamed" in name:
            continue
        column_definitions.append(f'"{name}" ({dtype})')

    schema_text = f'"{table_name}" with columns:\n'
    for col in column_definitions:
        schema_text += f'  - {col}\n'

    return schema_text.strip()


def get_database_schema():
    tables = get_all_tables()
    schemas = [get_table_schema(t) for t in tables]
    return "\n\n".join(schemas)


def get_table_count():
    return len(get_all_tables())