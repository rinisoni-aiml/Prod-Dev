from fastapi import APIRouter, HTTPException, Depends, status
from app.models.auth import LoginRequest, SignupRequest, TokenResponse, ProfileUpdate
from app.services.auth_service import authenticate_user, create_user
from app.dependencies import get_current_user
from app.utils.supabase_client import supabase

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    response = await authenticate_user(request.email, request.password)
    if not response or not response.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(access_token=response.session.access_token)


@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignupRequest):
    try:
        response = await create_user(request.email, request.password, request.full_name)
        if not response or not response.session:
            raise HTTPException(status_code=400, detail="Signup failed — check your details")
        return TokenResponse(access_token=response.session.access_token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/profile")
async def get_profile(current_user=Depends(get_current_user)):
    try:
        resp = supabase.table("profiles").select("*").eq("id", str(current_user.id)).single().execute()
        return resp.data
    except Exception:
        # Return basic info from auth token if profile row doesn't exist yet
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": (current_user.user_metadata or {}).get("full_name"),
        }


@router.patch("/profile")
async def update_profile(update: ProfileUpdate, current_user=Depends(get_current_user)):
    try:
        data = update.model_dump(exclude_unset=True)
        resp = supabase.table("profiles").update(data).eq("id", str(current_user.id)).execute()
        return resp.data[0] if resp.data else data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
