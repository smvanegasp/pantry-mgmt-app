"""Read a product photo into pantry-item fields with a multimodal model.

Providers, picked by the first key configured in this order:
- Groq (GROQ_API_KEY, GROQ_MODEL), OpenAI-compatible chat completions in JSON mode
- OpenAI (OPENAI_API_KEY, OPENAI_MODEL), Responses API with strict Structured Outputs
- Gemini (GEMINI_API_KEY, GEMINI_MODEL), generateContent with a JSON schema
`call_model` is the only provider-specific entry point.
"""

import base64
import json
import os
from datetime import date
from typing import Literal

import httpx
from pydantic import BaseModel, ValidationError

DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"
DEFAULT_OPENAI_MODEL = "gpt-6-luna"
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
TIMEOUT_SECONDS = 30


class RecognitionUnavailable(Exception):
    """Recognition isn't configured (no API key)."""


class RecognitionFailed(Exception):
    """The model call failed or returned something unusable."""


class ModelAnswer(BaseModel):
    isProduct: bool
    # Models sometimes return null for non-products.
    name: str | None
    categoryName: str | None
    mode: Literal["level", "count"]
    count: int | None = None
    expiresOn: date | None


# Strict-mode friendly: every field required, nullability via type arrays, no extra keys.
SCHEMA = {
    "type": "object",
    "properties": {
        "isProduct": {
            "type": "boolean",
            "description": "False if the photo doesn't show a food or household pantry product.",
        },
        "name": {
            "type": "string",
            "description": "An existing pantry item's exact name if it's the same product; otherwise a "
            "short name a person would use, brand first if visible, e.g. 'Barilla spaghetti'.",
        },
        "categoryName": {
            "type": ["string", "null"],
            "description": "One of the existing categories, a short new category name if none fit, or null.",
        },
        "mode": {"type": "string", "enum": ["level", "count"]},
        "count": {
            "type": ["integer", "null"],
            "description": "For mode=count: how many units are visible, or null if unclear.",
        },
        "expiresOn": {
            "type": ["string", "null"],
            "description": "Printed expiration date as YYYY-MM-DD, or null.",
        },
    },
    "required": ["isProduct", "name", "categoryName", "mode", "count", "expiresOn"],
    "additionalProperties": False,
}


# Enough for any real pantry; keeps the prompt small if a demo is stuffed with items.
MAX_ITEM_NAMES = 300


def _prompt(categories: list[str], items: list[str], today: date) -> str:
    listed = ", ".join(categories) if categories else "(none yet)"
    have = "; ".join(items[:MAX_ITEM_NAMES]) if items else "(none yet)"
    return f"""You help someone log items in their home pantry from a photo.
Today is {today.isoformat()}. Their existing categories: {listed}.
Products already in their pantry: {have}.

Return:
- name: if the photo shows the same product as one already in their pantry, that name exactly
  as written above (a different brand or size of the same thing counts as the same product;
  a different product does not, e.g. "Almond milk" is not "Milk"). Otherwise what they'd call
  it (brand + product, e.g. "Barilla spaghetti"); no sizes or marketing text.
- categoryName: the best matching existing category, exactly as written above. If none fits,
  suggest a short new one (e.g. "Condiments"). Null only if you can't tell.
- mode: "level" for things used a bit at a time (rice, oil, flour, coffee, sauces);
  "count" for things counted in units (cans, eggs, bottles, boxes, bars).
- count: for "count", how many units are visible; otherwise null.
- expiresOn: the printed expiration / best-before / use-by date as YYYY-MM-DD. If only month
  and year are printed, use the last day of that month. Ignore lot numbers and production
  dates. Null if no expiration date is readable.
- isProduct: false if this isn't a pantry product (a person, a room, a blank photo)."""


def _groq(key: str, image: bytes, mime_type: str, prompt: str) -> str:
    # Groq's JSON mode guarantees valid JSON but not the shape, so the schema goes in the
    # prompt; recognize() validates the answer either way.
    data_url = f"data:{mime_type};base64,{base64.b64encode(image).decode()}"
    instructions = f"{prompt}\n\nReply with only a JSON object matching this schema:\n{json.dumps(SCHEMA)}"
    body = {
        "model": os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL),
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": instructions},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0,
    }
    response = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json=body,
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _openai(key: str, image: bytes, mime_type: str, prompt: str) -> str:
    data_url = f"data:{mime_type};base64,{base64.b64encode(image).decode()}"
    body = {
        "model": os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
        # Reading a label needs little reasoning; low effort keeps it fast and cheap.
        "reasoning": {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "low")},
        "text": {
            "format": {"type": "json_schema", "name": "pantry_item", "schema": SCHEMA, "strict": True}
        },
    }
    response = httpx.post(
        "https://api.openai.com/v1/responses",
        headers={"Authorization": f"Bearer {key}"},
        json=body,
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    for item in response.json()["output"]:
        if item.get("type") == "message":
            for part in item["content"]:
                if part.get("type") == "output_text":
                    return part["text"]
    raise ValueError("no output text")


def _gemini(key: str, image: bytes, mime_type: str, prompt: str) -> str:
    model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image).decode()}},
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": SCHEMA},
    }
    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key},
        json=body,
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"]


def call_model(image: bytes, mime_type: str, prompt: str) -> dict:
    """One structured call to whichever provider is configured; returns the parsed JSON."""
    if key := os.environ.get("GROQ_API_KEY"):
        provider = _groq
    elif key := os.environ.get("OPENAI_API_KEY"):
        provider = _openai
    elif key := os.environ.get("GEMINI_API_KEY"):
        provider = _gemini
    else:
        raise RecognitionUnavailable()
    try:
        return json.loads(provider(key, image, mime_type, prompt))
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as err:
        # Never include the request (it carries the key) in errors or logs.
        status_code = getattr(getattr(err, "response", None), "status_code", None)
        raise RecognitionFailed(
            f"model call failed ({type(err).__name__}, status {status_code})"
        ) from None


def recognize(
    image: bytes, mime_type: str, categories: list[str], items: list[str], today: date
) -> ModelAnswer:
    raw = call_model(image, mime_type, _prompt(categories, items, today))
    try:
        return ModelAnswer(**raw)
    except (ValidationError, TypeError):
        raise RecognitionFailed("model returned an unexpected shape") from None
