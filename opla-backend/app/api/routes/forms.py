from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict
from app.api.dependencies import get_current_user, get_db
from app.api.schemas.form import FormCreateIn, FormOut
from app.services.form_service import FormService
from app.models.user import User
import uuid

router = APIRouter(prefix="/forms", tags=["forms"])
project_router = APIRouter(prefix="/projects/{project_id}/forms", tags=["forms"])

@project_router.post("", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def create_form(
    project_id: uuid.UUID,
    form_in: FormCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, verify project edit access
    return FormService.create_form(
        db=db,
        project_id=project_id,
        title=form_in.title,
        blueprint=form_in.blueprint
    )

@project_router.get("", response_model=List[FormOut])
def list_project_forms(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, verify project access
    return FormService.get_project_forms(db, project_id)

@router.get("/{form_id}", response_model=FormOut)
def get_form(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    form = FormService.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@router.put("/{form_id}/blueprint", response_model=FormOut)
def update_form_blueprint(
    form_id: uuid.UUID,
    blueprint: Dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, verify project edit access
    form = FormService.update_blueprint(db, form_id, blueprint)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

@router.patch("/{form_id}/blueprint", response_model=FormOut)
def update_form_blueprint_patch(
    form_id: uuid.UUID,
    blueprint: Dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return update_form_blueprint(form_id, blueprint, db, current_user)

@router.post("/{form_id}/publish", response_model=FormOut)
def publish_form(
    form_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, verify project edit access
    form = FormService.publish_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form
