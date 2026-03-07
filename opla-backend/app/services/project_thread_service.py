from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

import uuid

from app.models.project import Project
from app.models.project_thread import ProjectThread
from app.services.project_access_service import ProjectAccessService


class ProjectThreadService:
    @staticmethod
    def list_threads(db: Session, project_id: uuid.UUID) -> list[ProjectThread]:
        return (
            db.query(ProjectThread)
            .filter(ProjectThread.project_id == project_id)
            .order_by(ProjectThread.updated_at.desc(), ProjectThread.created_at.desc())
            .all()
        )

    @staticmethod
    def get_thread_or_404(db: Session, project_id: uuid.UUID, thread_id: uuid.UUID) -> ProjectThread:
        thread = (
            db.query(ProjectThread)
            .filter(ProjectThread.project_id == project_id, ProjectThread.id == thread_id)
            .first()
        )
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        return thread

    @staticmethod
    def create_thread(
        db: Session,
        project: Project,
        *,
        title: str,
        summary: str | None,
        reply_count: int,
        created_by: uuid.UUID,
    ) -> ProjectThread:
        ProjectAccessService.ensure_project_is_mutable(project)
        thread = ProjectThread(
            project_id=project.id,
            title=title.strip(),
            summary=summary.strip() if summary else None,
            reply_count=reply_count,
            created_by=created_by,
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
        return thread

    @staticmethod
    def update_thread(
        db: Session,
        project: Project,
        thread: ProjectThread,
        *,
        title: str | None = None,
        summary: str | None = None,
        reply_count: int | None = None,
    ) -> ProjectThread:
        ProjectAccessService.ensure_project_is_mutable(project)

        if title is not None:
            thread.title = title.strip()
        if summary is not None:
            thread.summary = summary.strip() or None
        if reply_count is not None:
            thread.reply_count = reply_count

        db.commit()
        db.refresh(thread)
        return thread

    @staticmethod
    def delete_thread(db: Session, project: Project, thread: ProjectThread) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        db.delete(thread)
        db.commit()