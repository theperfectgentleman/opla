from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_user_org_role
from app.api.schemas.section_template import SectionTemplateCreate, SectionTemplateUpdate, SectionTemplateResponse
from app.services.section_template_service import SectionTemplateService
from app.models.user import User

router = APIRouter(prefix="/organizations/{org_id}/templates/section", tags=["section-templates"])

@router.post("", response_model=SectionTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_section_template(
    org_id: UUID,
    template_data: SectionTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_role = Depends(get_user_org_role)
):
    """Create a new section template"""
    return SectionTemplateService.create_template(db, org_id, template_data)

@router.get("", response_model=List[SectionTemplateResponse])
def get_section_templates(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_role = Depends(get_user_org_role)
):
    """Get all section templates for an organization available to the user"""
    return SectionTemplateService.get_org_templates(db, org_id, current_user.id)

@router.put("/{template_id}", response_model=SectionTemplateResponse)
def update_section_template(
    org_id: UUID,
    template_id: UUID,
    template_data: SectionTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_role = Depends(get_user_org_role)
):
    """Update a section template"""
    template = SectionTemplateService.get_template(db, template_id)
    if not template or template.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        
    return SectionTemplateService.update_template(db, template_id, template_data)

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_section_template(
    org_id: UUID,
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_role = Depends(get_user_org_role)
):
    """Delete a section template"""
    template = SectionTemplateService.get_template(db, template_id)
    if not template or template.org_id != org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        
    SectionTemplateService.delete_template(db, template_id)
    return None
