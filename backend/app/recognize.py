"""Read a product photo into pantry-item fields with a multimodal model (Gemini).

`call_model` is the only provider-specific part; swapping to another model means changing it.
"""

import base64
import json
import os
from datetime import date
from typing import Literal

import httpx
from pydantic import BaseModel, ValidationError

DEFAULT_MODEL = "gemini-3.8-flash"
TIMEOUT_SECONDS = 30


class RecognitionUnavailable(Exception):
    """Recognition isn't configured (no API key)."""


class RecognitionFailed(Exception):
    """The model call failed or returned something unusable."""


class ModelAnswer(BaseModel):
    isProduct: bool
    name: str
    categoryName: str | None
    mode: Literal["level", "count"]
    count: int | None = None
    expiresOn: date | None


SCHEMA = {
    "type": "object",
    "properties": {
        "isProduct": {
            "type": "boolean",
            "description": "False if the photo doesn't show a food or household pantry product.",
        },
        "name": {
            "type": "string",
            "description": "Short name a person would use, brand first if visible, e.g. 'Barilla spaghetti'.",
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
        "expiresOn": {"type": ["string", "null"], "format": "date"},
    },
    "required": ["isProduct", "name", "categoryName", "mode", "count", "expiresOn"],
}


def _prompt(categories: list[str], today: date) -> str:
    listed = ", ".join(categories) if categories else "(none yet)"
    return f"""You help someone log items in their home pantry from a photo.
Today is {today.isoformat()}. Their existing categories: {listed}.

Return:
- name: what they'd call it (brand + product, e.g. "Barilla spaghetti"); no sizes or marketing text.
- categoryName: the best matching existing category, exactly as written above. If none fits,
  suggest a short new one (e.g. "Condiments"). Null only if you can't tell.
- mode: "level" for things used a bit at a time (rice, oil, flour, coffee, sauces);
  "count" for things counted in units (cans, eggs, bottles, boxes, bars).
- count: for "count", how many units are visible; otherwise null.
- expiresOn: the printed expiration / best-before / use-by date as YYYY-MM-DD. If only month
  and year are printed, use the last day of that month. Ignore lot numbers and production
  dates. Null if no expiration date is readable.
- isProduct: false if this isn't a pantry product (a person, a room, a blank photo)."""


def call_model(image: bytes, mime_type: str, prompt: str) -> dict:
    """One structured generateContent call; returns the parsed JSON answer."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RecognitionUnavailable()
    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
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
    try:
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key},
            json=body,
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as err:
        # Never include the request (it carries the key) in errors or logs.
        status_code = getattr(getattr(err, "response", None), "status_code", None)
        raise RecognitionFailed(f"model call failed (status {status_code})") from None


def recognize(image: bytes, mime_type: str, categories: list[str], today: date) -> ModelAnswer:
    raw = call_model(image, mime_type, _prompt(categories, today))
    try:
        return ModelAnswer(**raw)
    except (ValidationError, TypeError):
        raise RecognitionFailed("model returned an unexpected shape") from None
