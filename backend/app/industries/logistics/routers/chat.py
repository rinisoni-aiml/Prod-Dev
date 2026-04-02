"""
Logistics AI Chat Router — /api/logistics/v1/ai/*
Uses the full LLM text-to-SQL pipeline from text_to_sql_service.
Chat history is persisted to Supabase lg_chat_messages.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.industries.logistics.models.schemas import AIChatRequest
from app.industries.logistics.services.ai.text_to_sql_service import (
    run_chat_query,
    get_all_sessions,
    get_history,
    delete_session,
)

router = APIRouter()


# ─── Chat ─────────────────────────────────────────────────────────────────────

@router.post("/chat")
async def ask_ai(body: AIChatRequest, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    session_id = body.session_id or str(uuid.uuid4())
    question = body.question.strip()
    try:
        result = run_chat_query(question, session_id, uid)
        return {"data": {"session_id": session_id, **result}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Sessions ─────────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        sessions = get_all_sessions(uid)
        return {"data": sessions}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        messages = get_history(session_id, uid)
        return {"data": messages}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str, current_user=Depends(get_current_user)):
    uid = str(current_user.id)
    try:
        delete_session(session_id, uid)
        return {"data": {"deleted": True}}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
