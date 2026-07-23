from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import AnalyzeSentimentRequest, AnalyzeSentimentResponse
from app.nlp.analyzer import analyze_sentiment as score_sentiment

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


@app.post("/analyzeSentiment", response_model=AnalyzeSentimentResponse)
def analyze_sentiment_endpoint(
    body: AnalyzeSentimentRequest,
) -> AnalyzeSentimentResponse:
    text = body.text.strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Field `text` must be a non-empty string.",
        )

    score = score_sentiment(text)
    return AnalyzeSentimentResponse(sentimentScore=score)
