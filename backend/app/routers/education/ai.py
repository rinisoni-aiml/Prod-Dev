from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.education.ai.sql_agents import ask_question
from groq import Groq
from jose import jwt
import os, traceback, logging

router = APIRouter()
logger = logging.getLogger(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
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


@router.get("/ask")
async def ask(question: str, user_id: str = Depends(get_user_id)):
    try:
        result = ask_question(question, user_id)
        prompt = f"""
A user asked a question about a school dataset.
Question: {question}
SQL Result: {result}
Instructions:
- Answer in a clear, friendly and conversational way
- If it is student information, present it nicely with each detail on a new line
- Use the actual values from the result
- Do not say "SQL result" or mention database or query
- If the result is empty or None, say the record was not found politely
- Just answer naturally as a helpful school assistant
"""
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a helpful school data assistant. Present information clearly and naturally. Never mention SQL, databases, or queries."},
                {"role": "user", "content": prompt}
            ]
        )
        return JSONResponse({"response": response.choices[0].message.content})
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return JSONResponse({"response": "Sorry, I couldn't find an answer. Please try rephrasing."})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)