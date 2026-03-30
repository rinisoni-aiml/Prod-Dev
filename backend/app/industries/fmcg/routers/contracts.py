from fastapi import APIRouter, Depends, HTTPException
from app.industries.fmcg.models.contracts import ContractCreate, ContractUpdate
from app.dependencies import get_current_user
from app.shared.utils.supabase_client import supabase

router = APIRouter()


@router.get("")
async def get_contracts(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("contracts").select("*").eq("created_by", uid).order("created_at", desc=True).execute()
        return resp.data or []
    except Exception:
        return []


@router.post("")
async def create_contract(contract: ContractCreate, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        data = contract.model_dump()
        data["start_date"] = str(data["start_date"])
        data["end_date"] = str(data["end_date"])
        data["created_by"] = uid
        resp = supabase.table("contracts").insert(data).execute()
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{contract_id}")
async def update_contract(contract_id: str, contract: ContractUpdate, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        data = contract.model_dump(exclude_unset=True)
        if "start_date" in data and data["start_date"]:
            data["start_date"] = str(data["start_date"])
        if "end_date" in data and data["end_date"]:
            data["end_date"] = str(data["end_date"])
        resp = supabase.table("contracts").update(data).eq("id", contract_id).eq("created_by", uid).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Contract not found")
        return resp.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{contract_id}")
async def delete_contract(contract_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        supabase.table("contracts").delete().eq("id", contract_id).eq("created_by", uid).execute()
        return {"message": "Contract deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
