"""Thin Groq OpenAI-compatible chat client."""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings


class GroqClientError(Exception):
    """Raised when Groq is misconfigured or the API call fails."""


def _retry_after_seconds(error_body: str, attempt: int) -> float:
    match = re.search(r"try again in ([0-9.]+)s", error_body or "", re.IGNORECASE)
    if match:
        return min(30.0, float(match.group(1)) + 0.5)
    return min(20.0, 2.5 * (attempt + 1))


def chat_completion(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.4,
    max_tokens: int = 4096,
    response_json: bool = False,
) -> str:
    if not settings.GROQ_API_KEY:
        raise GroqClientError(
            "GROQ_API_KEY is not configured. Add it to the environment to use AI survey features."
        )

    payload: Dict[str, Any] = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_json:
        payload["response_format"] = {"type": "json_object"}

    url = f"{settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    last_error: Optional[str] = None
    for attempt in range(5):
        try:
            with httpx.Client(timeout=90.0) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            raise GroqClientError(f"Failed to reach Groq API: {exc}") from exc

        if response.status_code == 429:
            last_error = response.text[:500]
            time.sleep(_retry_after_seconds(last_error, attempt))
            continue

        if response.status_code >= 400:
            detail = response.text[:500]
            raise GroqClientError(f"Groq API error ({response.status_code}): {detail}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise GroqClientError("Unexpected Groq response shape") from exc

        if not isinstance(content, str) or not content.strip():
            raise GroqClientError("Groq returned an empty response")
        return content.strip()

    raise GroqClientError(f"Groq API rate limited after retries: {last_error}")


def chat_completion_json(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> Dict[str, Any]:
    raw = chat_completion(
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        response_json=True,
    )
    cleaned = raw
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise GroqClientError(f"Groq returned invalid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise GroqClientError("Groq JSON response must be an object")
    return parsed
