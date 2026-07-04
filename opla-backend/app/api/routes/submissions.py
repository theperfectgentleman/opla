from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.api.schemas.submission import SubmissionCreate, PublicSubmissionCreate, SubmissionOut, SubmissionReviewUpdate
from app.api.schemas.form import CatalogLookupOptionsOut, FormRuntimeOut
from app.api.schemas.dataset import LookupOptionsOut
from app.services.catalog_form_service import CatalogFormService
from app.services.dataset_service import DatasetService
from app.services.submission_service import SubmissionService
from app.services.project_access_service import ProjectAccessService
from app.services.form_service import FormService
from app.models.user import User
from app.models.form import FormStatus
from app.models.project import ProjectStatus
from app.models.submission import SubmissionReviewStatus
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


@router.get("/forms/{form_id}/submissions", response_model=List[SubmissionOut])
def list_form_submissions(
    form_id: uuid.UUID,
    review_status: SubmissionReviewStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_review_form(db, current_user.id, form)
    return SubmissionService.list_form_submissions(db, form_id, review_status)


@router.patch("/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    submission_id: uuid.UUID,
    payload: SubmissionReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        submission = SubmissionService.get_submission_or_404(db, submission_id)
    except ValueError as exc:
        if str(exc) == "SUBMISSION_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Submission not found") from exc
        raise

    form = FormService.get_form(db, submission.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    ProjectAccessService.ensure_can_review_form(db, current_user.id, form)
    return SubmissionService.review_submission(
        db,
        submission_id,
        review_status=payload.review_status,
        reviewed_by=current_user.id,
        review_comment=payload.review_comment,
    )

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


@router.get("/public/forms/{slug}/catalog-lookup-sources/{catalog_form_id}/options", response_model=CatalogLookupOptionsOut)
def get_public_catalog_lookup_options(
    slug: str,
    catalog_form_id: uuid.UUID,
    search: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    bounded_limit = max(1, min(limit, 500))
    return CatalogFormService.get_public_lookup_options(
        db,
        slug=slug,
        catalog_form_id=catalog_form_id,
        search=search,
        limit=bounded_limit,
    )
