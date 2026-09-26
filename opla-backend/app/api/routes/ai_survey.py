"""AI survey builder endpoints: interview → draft → revise → compile → generate."""

from __future__ import annotations

import logging
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
from app.models.org_member import OrgMember
from app.models.user import User
from app.services import ai_credit_service, ai_survey_service
from app.services.ai_credit_catalog import AI_SURVEY_DRAFT, AI_SURVEY_INTERVIEW, AI_SURVEY_REVISE
from app.services.ai_credit_service import InsufficientAiCredits, UnknownAiAction
from app.services.form_service import FormService
from app.services.project_access_service import ProjectAccessService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/survey", tags=["ai-survey"])
project_router = APIRouter(prefix="/projects/{project_id}/ai-survey", tags=["ai-survey"])


def _require_org_member(db: Session, organization_id: uuid.UUID, user: User) -> None:
    member = (
        db.query(OrgMember)
        .filter(OrgMember.org_id == organization_id, OrgMember.user_id == user.id)
        .first()
    )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )


def _spend_for_ai(db: Session, organization_id: uuid.UUID, user: User, action_key: str):
    """Shared spend-or-reject for AI survey model calls. Compile and generate are local."""
    _require_org_member(db, organization_id, user)
    try:
        return ai_credit_service.spend_or_reject(
            db,
            organization_id,
            action_key,
            user.id,
        )
    except InsufficientAiCredits as exc:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=exc.as_detail(),
        ) from exc
    except UnknownAiAction as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


def _refund_after_failure(db: Session, entry) -> None:
    if entry is None or int(entry.amount) == 0:
        return
    try:
        ai_credit_service.refund_spend(
            db,
            entry,
            note="Refund: the AI action failed before a result was returned",
        )
    except Exception:
        logger.exception("Failed to refund AI credits for ledger %s", getattr(entry, "id", None))


@router.post("/interview", response_model=InterviewResponse)
def interview(
    body: InterviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _spend_for_ai(db, body.organization_id, current_user, AI_SURVEY_INTERVIEW)
    try:
        questions = ai_survey_service.generate_interview_questions(body.brief)
    except ai_survey_service.AiSurveyServiceError as exc:
        _refund_after_failure(db, entry)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception:
        _refund_after_failure(db, entry)
        raise
    return InterviewResponse(questions=questions)


@router.post("/draft", response_model=DraftResponse)
def draft(
    body: DraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _spend_for_ai(db, body.organization_id, current_user, AI_SURVEY_DRAFT)
    try:
        result = ai_survey_service.draft_survey_markdown(body.brief, body.answers)
    except ai_survey_service.AiSurveyServiceError as exc:
        _refund_after_failure(db, entry)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception:
        _refund_after_failure(db, entry)
        raise
    return DraftResponse(title=result["title"], markdown=result["markdown"])


@router.post("/revise", response_model=ReviseResponse)
def revise(
    body: ReviseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _spend_for_ai(db, body.organization_id, current_user, AI_SURVEY_REVISE)
    try:
        markdown = ai_survey_service.revise_survey_markdown(body.markdown, body.instruction)
    except ai_survey_service.AiSurveyServiceError as exc:
        _refund_after_failure(db, entry)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception:
        _refund_after_failure(db, entry)
        raise
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
