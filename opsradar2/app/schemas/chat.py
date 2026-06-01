from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)
