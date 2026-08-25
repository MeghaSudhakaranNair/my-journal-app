from fastapi import APIRouter, HTTPException

from app.models import MoodResponse, MoodResponseRequest
from app.nlp.analyzer import analyze_sentiment


router = APIRouter()


@router.post("/mood-response", response_model=MoodResponse)
def create_mood_response(body: MoodResponseRequest) -> MoodResponse:
    text = body.text.strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Field `text` must be a non-empty string.",
        )

    return MoodResponse(moodScore=analyze_sentiment(text))
