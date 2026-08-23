from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MoodResponseRequest(BaseModel):
    text: str = Field(min_length=1)


class MoodResponse(BaseModel):
    moodScore: float = Field(ge=-1.0, le=1.0)


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
    createdAt: datetime
    updatedAt: datetime
