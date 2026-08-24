from __future__ import annotations

import logging
import os
from typing import Annotated, Dict, NamedTuple, Optional, Union

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv

from app.models import (
    JournalEntry,
    JournalEntryCreate,
    MoodResponse,
    MoodResponseRequest,
)
from app.nlp.analyzer import analyze_sentiment as measure_mood

load_dotenv()

logger = logging.getLogger("journal_api")
if os.getenv("JOURNAL_API_DEBUG", "").lower() == "true":
    logger.setLevel(logging.DEBUG)

app = FastAPI(title="Journal API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://my-journal-app-sage.vercel.app/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser(NamedTuple):
    id: str
    access_token: str


def get_supabase_config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    if not url or not publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not configured on the API server.",
        )
    return url, publishable_key


async def require_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials],
        Depends(bearer_scheme),
    ],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    supabase_url, publishable_key = get_supabase_config()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": publishable_key,
                    "Authorization": f"Bearer {credentials.credentials}",
                },
            )
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable.",
        ) from error

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = response.json().get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The access token does not identify a user.",
        )

    logger.debug("Authenticated Supabase user user_id=%s", user_id)
    return AuthenticatedUser(user_id, credentials.credentials)


def journal_entry_from_row(row: dict) -> JournalEntry:
    return JournalEntry(
        id=row["id"],
        userId=row["user_id"],
        content=row["content"],
        plainText=row["plain_text"],
        moodScore=row.get("mood_score"),
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


async def supabase_data_request(
    method: str,
    path: str,
    user: AuthenticatedUser,
    *,
    json: Optional[dict] = None,
    params: Optional[Dict[str, Union[str, int]]] = None,
    prefer: Optional[str] = None,
) -> httpx.Response:
    supabase_url, publishable_key = get_supabase_config()
    headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {user.access_token}",
    }
    if prefer:
        headers["Prefer"] = prefer

    logger.info(
        "Supabase data request method=%s path=%s user_id=%s",
        method,
        path,
        user.id,
    )
    logger.debug(
        "Supabase data request payload=%r params=%r",
        json,
        params,
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                method,
                f"{supabase_url}/rest/v1/{path}",
                headers=headers,
                json=json,
                params=params,
            )
    except httpx.RequestError as error:
        logger.exception(
            "Supabase data request failed before response method=%s path=%s",
            method,
            path,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Journal storage is unavailable.",
        ) from error

    logger.info(
        "Supabase data response method=%s path=%s status=%s",
        method,
        path,
        response.status_code,
    )
    logger.debug("Supabase data response body=%s", response.text)

    if response.is_error:
        logger.error(
            "Supabase rejected request method=%s path=%s status=%s body=%s",
            method,
            path,
            response.status_code,
            response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase rejected the journal operation.",
        )
    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/mood-response", response_model=MoodResponse)
def create_mood_response(body: MoodResponseRequest) -> MoodResponse:
    text = body.text.strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Field `text` must be a non-empty string.",
        )

    score = measure_mood(text)
    return MoodResponse(moodScore=score)


@app.post("/addjournal", response_model=JournalEntry, status_code=201)
@app.post(
    "/addjounal",
    response_model=JournalEntry,
    status_code=201,
    include_in_schema=False,
)
async def add_journal_entry(
    body: JournalEntryCreate,
    user: Annotated[AuthenticatedUser, Depends(require_user)],
) -> JournalEntry:
    plain_text = body.plainText.strip()
    if not plain_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A journal entry cannot be empty.",
        )

    logger.info(
        "Add journal request user_id=%s plain_text_length=%s mood_score=%s",
        user.id,
        len(plain_text),
        body.moodScore,
    )
    logger.debug("Add journal request body=%r", body.model_dump())

    response = await supabase_data_request(
        "POST",
        "journal_entries",
        user,
        json={
            "user_id": user.id,
            "content": body.content,
            "plain_text": plain_text,
            "mood_score": body.moodScore,
        },
        prefer="return=representation",
    )
    rows = response.json()
    if not isinstance(rows, list) or not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase did not return the saved journal entry.",
        )
    return journal_entry_from_row(rows[0])


@app.get("/getjournal", response_model=list[JournalEntry])
async def get_journal_entries(
    user: Annotated[AuthenticatedUser, Depends(require_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[JournalEntry]:
    response = await supabase_data_request(
        "GET",
        "journal_entries",
        user,
        params={
            "select": (
                "id,user_id,content,plain_text,mood_score,created_at,updated_at"
            ),
            "order": "created_at.desc",
            "limit": limit,
        },
    )
    rows = response.json()
    if not isinstance(rows, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase returned an invalid journal response.",
        )
    return [journal_entry_from_row(row) for row in rows]
