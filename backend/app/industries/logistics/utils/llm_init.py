"""
LLM Initialization with LangSmith Tracing

This module initializes ChatGroq with LangSmith tracing enabled.
When LANGSMITH_TRACING=true, all LLM calls are automatically logged to LangSmith dashboard,
showing token usage, latency, prompts, and responses.

Environment Variables Required:
- GROQ_API_KEY: Your Groq API key
- LANGSMITH_TRACING: Set to 'true' to enable tracing
- LANGSMITH_ENDPOINT: LangSmith API endpoint
- LANGSMITH_API_KEY: LangSmith API key
- LANGSMITH_PROJECT: LangSmith project name
"""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()
logger = logging.getLogger(__name__)

# Get environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LANGSMITH_TRACING = os.getenv("LANGSMITH_TRACING", "false").lower() == "true"


def get_llm(model: str = "llama-3.1-8b-instant", temperature: float = 0.0) -> ChatGroq:
    """
    Initialize and return a ChatGroq LLM instance with LangSmith tracing.

    LangSmith Integration:
    - Automatically enabled if LANGSMITH_TRACING=true
    - All calls logged to https://smith.langchain.com dashboard
    - Token usage tracked: input tokens, output tokens, total tokens
    - Latency measured for each call
    - Prompts and responses visible in dashboard

    Args:
        model: Groq model name (default: llama-3.1-8b-instant)
        temperature: Model temperature 0.0-2.0 (default: 0.0 for deterministic)

    Returns:
        ChatGroq instance ready for LLM calls
    """
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set. LLM calls will fail.")

    if LANGSMITH_TRACING:
        logger.info("LangSmith tracing enabled. Traces will be logged to LangSmith dashboard.")

    # LangSmith Tracing: AUTOMATIC
    # When LANGSMITH_TRACING=true, environment variables enable automatic tracing.
    # No additional code needed — all LLM calls are traced to the dashboard.

    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model=model,
        temperature=temperature,
        # Additional settings
        max_retries=2,  # Retry on transient failures
        timeout=30,  # 30 second timeout per request
    )

    return llm
