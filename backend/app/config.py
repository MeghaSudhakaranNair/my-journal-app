from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException, status


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env")

SENTIMENT_MODEL_SOURCE = os.getenv(
    "SENTIMENT_MODEL_SOURCE",
    "local",
).strip().lower()

SENTIMENT_MODEL_VERSION = os.getenv(
    "SENTIMENT_MODEL_VERSION",
    "v4-e8",
)

SENTIMENT_CHUNK_MAX_TOKENS = int(
    os.getenv("SENTIMENT_CHUNK_MAX_TOKENS", "128")
)

SENTIMENT_MODEL_REPOSITORY = os.getenv(
    "SENTIMENT_MODEL_REPOSITORY",
    "MeghaSN-Projects/journal-sentiment-setfit-v4-e8",
).strip()

HF_TOKEN = os.getenv("HF_TOKEN", "").strip()

_configured_sentiment_model_path = Path(
    os.getenv(
        "SENTIMENT_MODEL_PATH",
        "ml/models/journal-sentiment-v4-e8",
    )
).expanduser()

SENTIMENT_MODEL_PATH = (
    _configured_sentiment_model_path
    if _configured_sentiment_model_path.is_absolute()
    else PROJECT_ROOT / _configured_sentiment_model_path
).resolve()

logger = logging.getLogger("journal_api")
if os.getenv("JOURNAL_API_DEBUG", "").lower() == "true":
    logger.setLevel(logging.DEBUG)

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://my-journal-app-sage.vercel.app",
]


def get_supabase_config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not url or not publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not configured on the API server.",
        )
    return url, publishable_key
