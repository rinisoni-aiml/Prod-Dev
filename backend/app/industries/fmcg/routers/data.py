from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase
import uuid

router = APIRouter()


@router.get("/sources")
async def get_data_sources(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("data_files").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return resp.data or []
    except Exception:
        return []


@router.delete("/sources/{file_id}")
async def delete_data_source(file_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        # Get file record first to delete from storage
        resp = supabase.table("data_files").select("storage_path").eq("id", file_id).eq("user_id", uid).single().execute()
        if resp.data and resp.data.get("storage_path"):
            supabase.storage.from_("data-files").remove([resp.data["storage_path"]])
        supabase.table("data_files").delete().eq("id", file_id).eq("user_id", uid).execute()
        return {"message": "File deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    """Upload a CSV/XLSX file to Supabase Storage and record metadata."""
    uid = str(current_user.id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed = {".csv", ".xlsx", ".xls"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    try:
        content = await file.read()
        storage_path = f"{uid}/{uuid.uuid4()}{ext}"
        supabase.storage.from_("data-files").upload(storage_path, content, {"content-type": file.content_type})

        record = {
            "user_id": uid,
            "file_name": file.filename,
            "storage_path": storage_path,
            "file_size": len(content),
        }
        resp = supabase.table("data_files").insert(record).execute()
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
