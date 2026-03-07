from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.api.schemas.submission import SubmissionCreate, PublicSubmissionCreate, SubmissionOut
from app.api.schemas.form import FormRuntimeOut
from app.api.schemas.dataset import LookupOptionsOut
from app.services.dataset_service import DatasetService
from app.services.submission_service import SubmissionService
from app.services.project_access_service import ProjectAccessService
from app.services.form_service import FormService
from app.models.user import User
from app.models.form import FormStatus
from app.models.project import ProjectStatus
import uuid

router = APIRouter(tags=["submissions"])

@router.post("/submissions", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, submission_in.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_submit_form(db, current_user.id, form)

    try:
        return SubmissionService.create_submission(
            db=db,
            form_id=submission_in.form_id,
            data=submission_in.data,
            user_id=current_user.id,
            metadata=submission_in.metadata
        )
    except ValueError as exc:
        if str(exc) == "FORM_NOT_PUBLISHED":
            raise HTTPException(status_code=409, detail="Form is not deployed") from exc
        if str(exc) == "PROJECT_NOT_ACTIVE":
            raise HTTPException(status_code=409, detail="Project is not active") from exc
        raise

@router.get("/public/forms/{slug}", response_model=FormRuntimeOut)
def get_public_form(
    slug: str,
    db: Session = Depends(get_db)
):
    form = SubmissionService.get_form_by_slug(db, slug)
    if (
        not form
        or not form.is_public
        or not form.blueprint_live
        or form.status != FormStatus.LIVE
        or form.project.status != ProjectStatus.ACTIVE
    ):
        raise HTTPException(status_code=404, detail="Form not found or not public")
    return form

@router.post("/public/submissions/{slug}", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_public_submission(
    slug: str,
    submission_in: PublicSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user) # might be logged in user filling public form
):
    form = SubmissionService.get_form_by_slug(db, slug)
    if (
        not form
        or not form.is_public
        or not form.blueprint_live
        or form.status != FormStatus.LIVE
        or form.project.status != ProjectStatus.ACTIVE
    ):
        raise HTTPException(status_code=404, detail="Form not found or not public")

    try:
        return SubmissionService.create_submission(
            db=db,
            form_id=form.id,
            data=submission_in.data,
            user_id=current_user.id if current_user else None,
            metadata=submission_in.metadata
        )
    except ValueError as exc:
        if str(exc) == "FORM_NOT_PUBLISHED":
            raise HTTPException(status_code=409, detail="Form is not deployed") from exc
        if str(exc) == "PROJECT_NOT_ACTIVE":
            raise HTTPException(status_code=409, detail="Project is not active") from exc
        raise


@router.get("/public/forms/{slug}/lookup-sources/{dataset_id}/options", response_model=LookupOptionsOut)
def get_public_lookup_options(
    slug: str,
    dataset_id: uuid.UUID,
    label_field: str,
    value_field: str,
    search: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    bounded_limit = max(1, min(limit, 500))
    return DatasetService.get_public_lookup_options(
        db,
        slug=slug,
        dataset_id=dataset_id,
        label_field=label_field,
        value_field=value_field,
        search=search,
        limit=bounded_limit,
    )
