from pydantic import BaseModel, Field


class AnalyzeSentimentRequest(BaseModel):
    text: str = Field(min_length=1)


class AnalyzeSentimentResponse(BaseModel):
    sentimentScore: float = Field(ge=-1.0, le=1.0)
