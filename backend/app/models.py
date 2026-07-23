from pydantic import BaseModel, Field


class MoodResponseRequest(BaseModel):
    text: str = Field(min_length=1)


class MoodResponse(BaseModel):
    moodScore: float = Field(ge=-1.0, le=1.0)
