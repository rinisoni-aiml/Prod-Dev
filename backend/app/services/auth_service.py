from app.utils.supabase_client import supabase


async def authenticate_user(email: str, password: str):
    """Sign in with Supabase Auth."""
    try:
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return response
    except Exception:
        return None


async def create_user(email: str, password: str, full_name: str):
    """Sign up via Supabase Auth."""
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": full_name}},
        })
        return response
    except Exception as e:
        raise Exception(f"Failed to create user: {str(e)}")
