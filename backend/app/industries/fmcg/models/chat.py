from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class ChatMessage(BaseModel):
    session_id: str | None = None
    message: str


class ChatResponse(BaseModel):
    session_id: str
    message: str
    response: str


class ChatSession(BaseModel):
    id: str
    title: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
