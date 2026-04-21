from .db import supabase


def save_metadata(table_name, columns, user_id):
    # Just insert — table already created in Supabase directly
    supabase.table("datasets_metadata").insert({
        "user_id": user_id,
        "table_name": table_name,
        "columns": ",".join(columns)
    }).execute()