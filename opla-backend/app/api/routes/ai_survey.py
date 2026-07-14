"""AI survey builder endpoints: interview → draft → revise → compile → generate."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.ai_survey import (
    CompileRequest,
    CompileResponse,
    DraftRequest,
    DraftResponse,
    GenerateRequest,
    InterviewRequest,
    InterviewResponse,
    ReviseRequest,
    ReviseResponse,
)
from app.api.schemas.form import FormOut
from app.models.user import User
from app.services import ai_survey_service
from app.services.form_service import FormService
from app.services.project_access_service import ProjectAccessService

router = APIRouter(prefix="/ai/survey", tags=["ai-survey"])
project_router = APIRouter(prefix="/projects/{project_id}/ai-survey", tags=["ai-survey"])


@router.post("/interview", response_model=InterviewResponse)
def interview(
    body: InterviewRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        questions = ai_survey_service.generate_interview_questions(body.brief)
    except ai_survey_service.AiSurveyServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return InterviewResponse(questions=questions)


@router.post("/draft", response_model=DraftResponse)
def draft(
    body: DraftRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = ai_survey_service.draft_survey_markdown(body.brief, body.answers)
    except ai_survey_service.AiSurveyServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DraftResponse(title=result["title"], markdown=result["markdown"])


@router.post("/revise", response_model=ReviseResponse)
def revise(
    body: ReviseRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        markdown = ai_survey_service.revise_survey_markdown(body.markdown, body.instruction)
    except ai_survey_service.AiSurveyServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReviseResponse(markdown=markdown)


@router.post("/compile", response_model=CompileResponse)
def compile_markdown(
    body: CompileRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = ai_survey_service.compile_markdown(body.markdown)
    except ai_survey_service.AiSurveyServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CompileResponse(
        title=result.title,
        blueprint=result.blueprint,
        warnings=result.warnings,
    )


@project_router.post("/generate", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def generate_form(
    project_id: uuid.UUID,
    body: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ProjectAccessService.ensure_can_create_form(db, current_user.id, project_id)
    try:
        compiled = ai_survey_service.compile_markdown(body.markdown)
    except ai_survey_service.AiSurveyServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    title = (body.title or compiled.title or "AI Survey").strip()
    blueprint = compiled.blueprint
    meta = dict(blueprint.get("meta") or {})
    meta["title"] = title
    meta["app_id"] = str(project_id)
    meta["app_id_slug"] = f"project_{project_id}"
    blueprint["meta"] = meta

    form = FormService.create_form(
        db,
        project_id=project_id,
        title=title,
        blueprint=blueprint,
        kind="standard",
    )
    # Attach form id into meta for builder consumers
    draft = dict(form.blueprint_draft or {})
    draft_meta = dict(draft.get("meta") or {})
    draft_meta["form_id"] = str(form.id)
    draft_meta["title"] = form.title
    draft["meta"] = draft_meta
    form = FormService.update_blueprint(db, form.id, draft, target_slot=1)
    return form
