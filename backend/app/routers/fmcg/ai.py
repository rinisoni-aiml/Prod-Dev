from fastapi import APIRouter, Depends, HTTPException
from app.models.fmcg.chat import ChatMessage, ChatResponse, ChatSession
from app.dependencies import get_current_user
from app.services.fmcg.ai_service import generate_ai_response, generate_insights
from app.utils.supabase_client import supabase

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        session_id = message.session_id
        if not session_id:
            sess_resp = supabase.table("chat_sessions").insert({
                "user_id": uid,
                "title": message.message[:50],
            }).execute()
            session_id = sess_resp.data[0]["id"]

        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "user",
            "content": message.message,
        }).execute()

        ai_response = await generate_ai_response(message.message)

        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "assistant",
            "content": ai_response,
        }).execute()

        return ChatResponse(session_id=session_id, message=message.message, response=ai_response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def get_sessions(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("chat_sessions").select("*").eq("user_id", uid).order("updated_at", desc=True).execute()
        return resp.data or []
    except Exception:
        return []


@router.post("/sessions")
async def create_session(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        resp = supabase.table("chat_sessions").insert({"user_id": uid, "title": "New Chat"}).execute()
        return resp.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insights")
async def get_ai_insights(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        insights = await generate_insights(uid, supabase)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommendations")
async def get_recommendations(context: dict, current_user=Depends(get_current_user)):
    try:
        response = await generate_ai_response("Provide recommendations based on this supply chain data", context)
        return {"recommendations": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
