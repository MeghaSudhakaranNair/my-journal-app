from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from fastapi import HTTPException, status


load_dotenv()

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
