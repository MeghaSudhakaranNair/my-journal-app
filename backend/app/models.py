from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MoodResponseRequest(BaseModel):
    text: str = Field(min_length=1)


class MoodResponse(BaseModel):
    moodScore: float = Field(ge=-1.0, le=1.0)


SentimentLabel = Literal["negative", "neutral", "positive"]


class SentimentScores(BaseModel):
    negative: float = Field(ge=0.0, le=1.0)
    neutral: float = Field(ge=0.0, le=1.0)
    positive: float = Field(ge=0.0, le=1.0)


class JournalEntryCreate(BaseModel):
    content: dict[str, Any]
    plainText: str = Field(min_length=1, max_length=100_000)
    moodScore: Optional[float] = Field(default=None, ge=-1.0, le=1.0)


class JournalEntry(BaseModel):
    id: UUID
    userId: UUID
    content: dict[str, Any]
    plainText: str
    moodScore: Optional[float]
    sentimentLabel: Optional[SentimentLabel] = None
    sentimentConfidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    sentimentScores: Optional[SentimentScores] = None
    sentimentModel: Optional[str] = None
    sentimentChunks: Optional[int] = Field(default=None, ge=1)
    sentimentTokens: Optional[int] = Field(default=None, ge=1)
    createdAt: datetime
    updatedAt: datetime
