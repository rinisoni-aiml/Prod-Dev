"""
LLM Utilities: Rate limiting, retry logic, and token usage logging.
Copied exactly from logistics-ai-main with no changes needed.
"""
import logging
import time
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

_last_llm_call_time: Optional[float] = None


def record_last_call() -> None:
    global _last_llm_call_time
    _last_llm_call_time = time.time()


def wait_before_call(delay_ms: int = 1000) -> None:
    global _last_llm_call_time
    if _last_llm_call_time is None:
        return
    elapsed_ms = (time.time() - _last_llm_call_time) * 1000
    remaining_ms = delay_ms - elapsed_ms
    if remaining_ms > 0:
        time.sleep(remaining_ms / 1000)


def retry_with_exponential_backoff(
    func: Callable,
    *args: Any,
    max_retries: int = 5,
    base_delay_sec: int = 2,
    **kwargs: Any,
) -> Any:
    for attempt in range(1, max_retries + 1):
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            error_msg = str(exc)
            is_429 = (
                "429" in error_msg
                or "Too Many Requests" in error_msg
                or (hasattr(exc, "status_code") and exc.status_code == 429)
            )
            if not is_429:
                raise
            if attempt < max_retries:
                delay_sec = base_delay_sec * (2 ** (attempt - 1))
                logger.warning("LLM rate limit (429). Retrying in %ds (attempt %d/%d)", delay_sec, attempt, max_retries)
                time.sleep(delay_sec)
                record_last_call()
            else:
                raise
    raise RuntimeError("Unexpected exit from retry loop")


def log_token_usage(table_name: str, prompt_tokens: int, completion_tokens: int, total_tokens: int, pass_num: int = 1) -> None:
    logger.info(
        "LLM token usage [table=%s, pass=%d] | prompt=%d | completion=%d | total=%d",
        table_name, pass_num, prompt_tokens, completion_tokens, total_tokens,
    )


def build_two_pass_strategy(all_columns: list, first_pass_mapping: dict) -> list:
    return [col for col in all_columns if col not in first_pass_mapping]
