print("🔥 EDUCATION DATA FILE LOADED")

from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.education.ingestion.excel_ingest import ingest_excel
from jose import jwt
import traceback, asyncio, io
from functools import partial

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


@router.get("/test")
async def test():
    return {"ok": True}


@router.get("/rebuild-index")
async def rebuild_index(user_id: str = Depends(get_user_id)):
    from app.services.education.schema_index.schema_indexer import build_vector_index
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: build_vector_index(user_id))
    return {"ok": True, "message": f"Index rebuilt for user {user_id}"}


@router.post("/upload")
async def upload(file: UploadFile = File(...), user_id: str = Depends(get_user_id)):
    print(f"🔵 Upload by user: {user_id}, file: {file.filename}")
    try:
        contents = await file.read()
        file_like = io.BytesIO(contents)
        loop = asyncio.get_event_loop()
        table = await loop.run_in_executor(
            None,
            partial(ingest_excel, file_like, file.filename, user_id)
        )
        return JSONResponse({
            "message": f"File '{file.filename}' uploaded into '{table}'.",
            "table": table
        })
    except Exception as e:
        print(f"🔴 Error: {e}")
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)