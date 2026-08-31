from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from starlette.concurrency import run_in_threadpool

from app.auth import AuthenticatedUser, require_user
from app.config import logger
from app.database import supabase_data_request
from app.models import JournalEntry, JournalEntryCreate
from app.nlp.setfit_analyzer import SentimentModelError, SentimentResult
from app.nlp.setfit_analyzer import analyze_submitted_sentiment


router = APIRouter()


def journal_entry_from_row(row: dict) -> JournalEntry:
    return JournalEntry(
        id=row["id"],
        userId=row["user_id"],
        content=row["content"],
        plainText=row["plain_text"],
        moodScore=row.get("mood_score"),
        sentimentLabel=row.get("sentiment_label"),
        sentimentConfidence=row.get("sentiment_confidence"),
        sentimentScores=row.get("sentiment_scores"),
        sentimentModel=row.get("sentiment_model"),
        sentimentChunks=row.get("sentiment_chunks"),
        sentimentTokens=row.get("sentiment_tokens"),
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


@router.post("/addjournal", response_model=JournalEntry, status_code=201)
@router.post(
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

    sentiment: SentimentResult | None = None
    try:
        sentiment = await run_in_threadpool(
            analyze_submitted_sentiment,
            plain_text,
        )
    except SentimentModelError:
        logger.exception(
            "Sentiment analysis unavailable; saving journal without analysis "
            "user_id=%s plain_text_length=%s",
            user.id,
            len(plain_text),
        )
    except Exception:
        logger.exception(
            "Unexpected sentiment analysis error; saving journal without analysis "
            "user_id=%s plain_text_length=%s",
            user.id,
            len(plain_text),
        )

    sentiment_values = {
        "sentiment_label": sentiment.label if sentiment else None,
        "sentiment_confidence": sentiment.confidence if sentiment else None,
        "sentiment_scores": sentiment.scores if sentiment else None,
        "sentiment_model": sentiment.model_version if sentiment else None,
        "sentiment_chunks": sentiment.chunks_analyzed if sentiment else None,
        "sentiment_tokens": sentiment.tokens_analyzed if sentiment else None,
    }

    response = await supabase_data_request(
        "POST",
        "journal_entries",
        user,
        json={
            "user_id": user.id,
            "content": body.content,
            "plain_text": plain_text,
            "mood_score": body.moodScore,
            **sentiment_values,
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


@router.get("/getjournal", response_model=list[JournalEntry])
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
                "id,user_id,content,plain_text,mood_score,sentiment_label,"
                "sentiment_confidence,sentiment_scores,sentiment_model,"
                "sentiment_chunks,sentiment_tokens,created_at,updated_at"
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
