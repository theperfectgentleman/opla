from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user, get_db, get_optional_user
from app.api.schemas.submission import SubmissionCreate, PublicSubmissionCreate, SubmissionOut
from app.api.schemas.form import FormOut
from app.services.submission_service import SubmissionService
from app.models.user import User
import uuid

router = APIRouter(tags=["submissions"])

@router.post("/submissions", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return SubmissionService.create_submission(
        db=db,
        form_id=submission_in.form_id,
        data=submission_in.data,
        user_id=current_user.id,
        metadata=submission_in.metadata
    )

@router.get("/public/forms/{slug}", response_model=FormOut)
def get_public_form(
    slug: str,
    db: Session = Depends(get_db)
):
    form = SubmissionService.get_form_by_slug(db, slug)
    if not form or not form.is_public:
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
    if not form or not form.is_public:
        raise HTTPException(status_code=404, detail="Form not found or not public")
        
    return SubmissionService.create_submission(
        db=db,
        form_id=form.id,
        data=submission_in.data,
        user_id=current_user.id if current_user else None,
        metadata=submission_in.metadata
    )
