from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class InterviewQuestion(BaseModel):
    id: str
    prompt: str
    kind: str = "text"  # text | choice
    options: Optional[List[str]] = None


class InterviewRequest(BaseModel):
    brief: str = Field(min_length=1)


class InterviewResponse(BaseModel):
    questions: List[InterviewQuestion]


class DraftRequest(BaseModel):
    brief: str = Field(min_length=1)
    answers: Optional[Dict[str, str]] = None


class DraftResponse(BaseModel):
    title: str
    markdown: str


class ReviseRequest(BaseModel):
    markdown: str = Field(min_length=1)
    instruction: str = Field(min_length=1)


class ReviseResponse(BaseModel):
    markdown: str


class CompileRequest(BaseModel):
    markdown: str = Field(min_length=1)


class CompileResponse(BaseModel):
    title: str
    blueprint: Dict[str, Any]
    warnings: List[str] = []


class GenerateRequest(BaseModel):
    markdown: str = Field(min_length=1)
    title: Optional[str] = None


class GenerateResponse(BaseModel):
    form: Dict[str, Any]
    warnings: List[str] = []
