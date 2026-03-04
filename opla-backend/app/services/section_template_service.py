from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from uuid import UUID
from app.models.section_template import SectionTemplate, Visibility
from app.models.team_member import TeamMember
from app.api.schemas.section_template import SectionTemplateCreate, SectionTemplateUpdate

class SectionTemplateService:
    @staticmethod
    def create_template(db: Session, org_id: UUID, template_data: SectionTemplateCreate) -> SectionTemplate:
        db_template = SectionTemplate(
            org_id=org_id,
            **template_data.model_dump()
        )
        db.add(db_template)
        db.commit()
        db.refresh(db_template)
        return db_template

    @staticmethod
    def get_template(db: Session, template_id: UUID) -> Optional[SectionTemplate]:
        return db.query(SectionTemplate).filter(SectionTemplate.id == template_id).first()

    @staticmethod
    def get_org_templates(db: Session, org_id: UUID, user_id: UUID) -> List[SectionTemplate]:
        # User is a member of the org, we need to return:
        # 1. Templates with Visibility.ORGANIZATION
        # 2. Templates with Visibility.TEAM where the user is a member of one of the teams in team_ids
        
        # Get user's teams in this org
        user_teams = db.query(TeamMember.team_id).filter(
            TeamMember.user_id == user_id
        ).all()
        user_team_ids = [team.team_id for team in user_teams]

        query = db.query(SectionTemplate).filter(SectionTemplate.org_id == org_id)

        # Filter by visibility
        if not user_team_ids:
            query = query.filter(SectionTemplate.visibility == Visibility.ORGANIZATION)
        else:
            query = query.filter(
                or_(
                    SectionTemplate.visibility == Visibility.ORGANIZATION,
                    SectionTemplate.team_ids.overlap(user_team_ids)
                )
            )

        return query.all()

    @staticmethod
    def update_template(db: Session, template_id: UUID, template_data: SectionTemplateUpdate) -> Optional[SectionTemplate]:
        db_template = SectionTemplateService.get_template(db, template_id)
        if not db_template:
            return None
            
        update_data = template_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_template, key, value)
            
        db.commit()
        db.refresh(db_template)
        return db_template

    @staticmethod
    def delete_template(db: Session, template_id: UUID) -> bool:
        db_template = SectionTemplateService.get_template(db, template_id)
        if not db_template:
            return False
            
        db.delete(db_template)
        db.commit()
        return True
