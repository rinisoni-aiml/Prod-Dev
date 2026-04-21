from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.education.analytics.analytics_engine import build_dashboard
from jose import jwt
import traceback

router = APIRouter()
security = HTTPBearer()

def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = jwt.decode(
        token,
        key="",
        options={
            "verify_signature": False,
            "verify_aud": False,
            "verify_exp": False
        }
    )
    return payload.get("sub")

@router.get("/generate_dashboard")
async def generate_dashboard(user_id: str = Depends(get_user_id)):
    try:
        dashboard = build_dashboard(user_id)
        return JSONResponse({"dashboard": dashboard})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)