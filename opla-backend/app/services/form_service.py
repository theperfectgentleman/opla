from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.form import Form, FormStatus
import uuid
from typing import List, Optional, Dict
import re

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

class ProjectService:
    @staticmethod
    def create_project(db: Session, org_id: uuid.UUID, name: str, description: Optional[str] = None) -> Project:
        project = Project(
            org_id=org_id,
            name=name,
            description=description
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def get_org_projects(db: Session, org_id: uuid.UUID) -> List[Project]:
        return db.query(Project).filter(Project.org_id == org_id).all()

class FormService:
    @staticmethod
    def create_form(db: Session, project_id: uuid.UUID, title: str, blueprint: Optional[Dict] = None) -> Form:
        base_slug = slugify(title)
        slug = base_slug
        counter = 1
        while db.query(Form).filter(Form.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
        form = Form(
            project_id=project_id,
            title=title,
            slug=slug,
            blueprint_draft=blueprint,
            status=FormStatus.DRAFT
        )
        db.add(form)
        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def update_blueprint(db: Session, form_id: uuid.UUID, blueprint: Dict) -> Form:
        form = db.query(Form).filter(Form.id == form_id).first()
        if form:
            form.blueprint_draft = blueprint
            db.commit()
            db.refresh(form)
        return form

    @staticmethod
    def get_form(db: Session, form_id: uuid.UUID) -> Optional[Form]:
        return db.query(Form).filter(Form.id == form_id).first()

    @staticmethod
    def publish_form(db: Session, form_id: uuid.UUID) -> Form:
        form = db.query(Form).filter(Form.id == form_id).first()
        if form:
            form.blueprint_live = form.blueprint_draft
            form.status = FormStatus.LIVE
            form.version += 1
            db.commit()
            db.refresh(form)
        return form

    @staticmethod
    def get_project_forms(db: Session, project_id: uuid.UUID) -> List[Form]:
        return db.query(Form).filter(Form.project_id == project_id).all()
