from datetime import datetime
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.org_member import OrgMember
from app.models.project import Project
from app.models.project_access import AccessorType
from app.models.project_task import ProjectTask, ProjectTaskStatus
from app.models.team import Team
from app.models.team_member import TeamMember
from app.services.project_access_service import ProjectAccessService


class ProjectTaskService:
    @staticmethod
    def _validate_timeline(starts_at: datetime | None, due_at: datetime | None) -> None:
        if starts_at and due_at and due_at < starts_at:
            raise HTTPException(status_code=400, detail="Task due date must be after the start date")

    @staticmethod
    def _validate_assignment(
        db: Session,
        project: Project,
        assigned_accessor_id: uuid.UUID | None,
        assigned_accessor_type: AccessorType | None,
    ) -> None:
        if assigned_accessor_id is None and assigned_accessor_type is None:
            return

        if assigned_accessor_id is None or assigned_accessor_type is None:
            raise HTTPException(status_code=400, detail="Assigned accessor id and type must be provided together")

        if assigned_accessor_type == AccessorType.USER:
            membership = (
                db.query(OrgMember)
                .filter(OrgMember.org_id == project.org_id, OrgMember.user_id == assigned_accessor_id)
                .first()
            )
            if not membership:
                raise HTTPException(status_code=400, detail="Assigned user is not a member of this organization")
            return

        team = (
            db.query(Team)
            .filter(Team.id == assigned_accessor_id, Team.org_id == project.org_id)
            .first()
        )
        if not team:
            raise HTTPException(status_code=400, detail="Assigned team was not found in this organization")

    @staticmethod
    def list_tasks(db: Session, project_id: uuid.UUID) -> list[ProjectTask]:
        return (
            db.query(ProjectTask)
            .filter(ProjectTask.project_id == project_id)
            .order_by(ProjectTask.due_at.asc(), ProjectTask.created_at.desc())
            .all()
        )

    @staticmethod
    def get_task_or_404(db: Session, project_id: uuid.UUID, task_id: uuid.UUID) -> ProjectTask:
        task = (
            db.query(ProjectTask)
            .filter(ProjectTask.project_id == project_id, ProjectTask.id == task_id)
            .first()
        )
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return task

    @staticmethod
    def create_task(
        db: Session,
        project: Project,
        *,
        title: str,
        description: str | None,
        starts_at: datetime | None,
        due_at: datetime | None,
        assigned_accessor_id: uuid.UUID | None,
        assigned_accessor_type: AccessorType | None,
        created_by: uuid.UUID,
    ) -> ProjectTask:
        ProjectAccessService.ensure_project_is_mutable(project)
        ProjectTaskService._validate_timeline(starts_at, due_at)
        ProjectTaskService._validate_assignment(db, project, assigned_accessor_id, assigned_accessor_type)

        task = ProjectTask(
            project_id=project.id,
            title=title.strip(),
            description=description.strip() if description else None,
            starts_at=starts_at,
            due_at=due_at,
            assigned_accessor_id=assigned_accessor_id,
            assigned_accessor_type=assigned_accessor_type,
            created_by=created_by,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def _user_can_update_assigned_task(db: Session, task: ProjectTask, user_id: uuid.UUID) -> bool:
        if task.assigned_accessor_type == AccessorType.USER and task.assigned_accessor_id == user_id:
            return True

        if task.assigned_accessor_type == AccessorType.TEAM and task.assigned_accessor_id:
            membership = (
                db.query(TeamMember)
                .filter(TeamMember.team_id == task.assigned_accessor_id, TeamMember.user_id == user_id)
                .first()
            )
            return membership is not None

        return False

    @staticmethod
    def ensure_can_update_task(
        db: Session,
        user_id: uuid.UUID,
        project_id: uuid.UUID,
        task: ProjectTask,
    ) -> Project:
        try:
            project = ProjectAccessService.ensure_can_edit_project(db, user_id, project_id)
            ProjectAccessService.ensure_project_is_mutable(project)
            return project
        except HTTPException:
            project = ProjectAccessService.ensure_can_view_project(db, user_id, project_id)
            ProjectAccessService.ensure_project_is_mutable(project)
            if ProjectTaskService._user_can_update_assigned_task(db, task, user_id):
                return project
            raise HTTPException(status_code=403, detail="You do not have permission to update this task")

    @staticmethod
    def update_task(
        db: Session,
        project: Project,
        task: ProjectTask,
        *,
        title: str | None = None,
        description: str | None = None,
        status: ProjectTaskStatus | None = None,
        starts_at: datetime | None = None,
        due_at: datetime | None = None,
        assigned_accessor_id: uuid.UUID | None = None,
        assigned_accessor_type: AccessorType | None = None,
        replace_assignment: bool = False,
    ) -> ProjectTask:
        ProjectAccessService.ensure_project_is_mutable(project)

        next_starts_at = starts_at if starts_at is not None else task.starts_at
        next_due_at = due_at if due_at is not None else task.due_at
        ProjectTaskService._validate_timeline(next_starts_at, next_due_at)

        if title is not None:
            task.title = title.strip()
        if description is not None:
            task.description = description.strip() or None
        if starts_at is not None:
            task.starts_at = starts_at
        if due_at is not None:
            task.due_at = due_at
        if status is not None:
            task.status = status
            task.completed_at = datetime.utcnow() if status == ProjectTaskStatus.DONE else None

        if replace_assignment:
            ProjectTaskService._validate_assignment(db, project, assigned_accessor_id, assigned_accessor_type)
            task.assigned_accessor_id = assigned_accessor_id
            task.assigned_accessor_type = assigned_accessor_type

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def delete_task(db: Session, project: Project, task: ProjectTask) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        db.delete(task)
        db.commit()