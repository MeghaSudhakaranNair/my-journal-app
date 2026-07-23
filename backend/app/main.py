from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import MoodResponse, MoodResponseRequest
from app.nlp.analyzer import analyze_sentiment as measure_mood

app = FastAPI(title="Journal API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
