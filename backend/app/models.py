from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


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


class ProfileUpdate(BaseModel):
    firstName: str = Field(default="", max_length=100)
    lastName: str = Field(default="", max_length=100)
    username: str = Field(min_length=1, max_length=100)
    phone: str = Field(default="", max_length=32)
    addressLine1: str = Field(default="", max_length=200)
    addressLine2: str = Field(default="", max_length=200)
    city: str = Field(default="", max_length=100)
    region: str = Field(default="", max_length=100)
    postalCode: str = Field(default="", max_length=32)
    country: str = Field(default="", max_length=100)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        phone = value.strip()
        if not phone:
            return phone
        digits = "".join(character for character in phone if character.isdigit())
        allowed = all(character.isdigit() or character in "+-(). " for character in phone)
        if not allowed or not phone.startswith("+") and "+" in phone or not 7 <= len(digits) <= 15:
            raise ValueError("Enter a valid phone number containing 7 to 15 digits.")
        return phone

    @field_validator("postalCode")
    @classmethod
    def validate_postal_code(cls, value: str) -> str:
        postal_code = value.strip()
        if postal_code and not re.fullmatch(r"\d{5}(?:-\d{4})?", postal_code):
            raise ValueError(
                "Enter a valid ZIP code, such as 12345 or 12345-6789."
            )
        return postal_code


class Profile(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    username: str
    phone: str
    addressLine1: str
    addressLine2: str
    city: str
    region: str
    postalCode: str
    country: str
    emailChangePending: bool = False
