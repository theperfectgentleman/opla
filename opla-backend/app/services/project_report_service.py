from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

import uuid
from typing import Any

from app.models.org_member import OrgMember
from app.models.project import Project
from app.models.project_access import AccessorType
from app.models.project_report import ProjectReport, ProjectReportStatus
from app.models.team import Team
from app.services.project_access_service import ProjectAccessService


class ProjectReportService:
    @staticmethod
    def _validate_accessor(
        db: Session,
        project: Project,
        accessor_id: uuid.UUID | None,
        accessor_type: AccessorType | None,
        label: str,
    ) -> None:
        if accessor_id is None and accessor_type is None:
            return

        if accessor_id is None or accessor_type is None:
            raise HTTPException(status_code=400, detail=f"{label} accessor id and type must be provided together")

        if accessor_type == AccessorType.USER:
            membership = (
                db.query(OrgMember)
                .filter(OrgMember.org_id == project.org_id, OrgMember.user_id == accessor_id)
                .first()
            )
            if not membership:
                raise HTTPException(status_code=400, detail=f"{label} user is not a member of this organization")
            return

        team = (
            db.query(Team)
            .filter(Team.id == accessor_id, Team.org_id == project.org_id)
            .first()
        )
        if not team:
            raise HTTPException(status_code=400, detail=f"{label} team was not found in this organization")

    @staticmethod
    def list_reports(db: Session, project_id: uuid.UUID) -> list[ProjectReport]:
        return (
            db.query(ProjectReport)
            .filter(ProjectReport.project_id == project_id)
            .order_by(ProjectReport.updated_at.desc(), ProjectReport.created_at.desc())
            .all()
        )

    @staticmethod
    def get_report_or_404(db: Session, project_id: uuid.UUID, report_id: uuid.UUID) -> ProjectReport:
        report = (
            db.query(ProjectReport)
            .filter(ProjectReport.project_id == project_id, ProjectReport.id == report_id)
            .first()
        )
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report

    @staticmethod
    def create_report(
        db: Session,
        project: Project,
        *,
        title: str,
        description: str | None,
        content: list[dict[str, Any]] | None,
        created_by: uuid.UUID,
    ) -> ProjectReport:
        ProjectAccessService.ensure_project_is_mutable(project)
        report = ProjectReport(
            project_id=project.id,
            title=title.strip(),
            description=description.strip() if description else None,
            content=content or [],
            created_by=created_by,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def update_report(
        db: Session,
        project: Project,
        report: ProjectReport,
        *,
        title: str | None = None,
        description: str | None = None,
        content: list[dict[str, Any]] | None = None,
        status: ProjectReportStatus | None = None,
        lead_accessor_id: uuid.UUID | None = None,
        lead_accessor_type: AccessorType | None = None,
        assigned_accessor_id: uuid.UUID | None = None,
        assigned_accessor_type: AccessorType | None = None,
        guest_accessor_id: uuid.UUID | None = None,
        guest_accessor_type: AccessorType | None = None,
    ) -> ProjectReport:
        ProjectAccessService.ensure_project_is_mutable(project)
        ProjectReportService._validate_accessor(db, project, lead_accessor_id, lead_accessor_type, "Lead")
        ProjectReportService._validate_accessor(db, project, assigned_accessor_id, assigned_accessor_type, "Assigned")
        ProjectReportService._validate_accessor(db, project, guest_accessor_id, guest_accessor_type, "Guest")

        if title is not None:
            report.title = title.strip()
        if description is not None:
            report.description = description.strip() or None
        if content is not None:
            report.content = content
        if status is not None:
            report.status = status

        report.lead_accessor_id = lead_accessor_id
        report.lead_accessor_type = lead_accessor_type
        report.assigned_accessor_id = assigned_accessor_id
        report.assigned_accessor_type = assigned_accessor_type
        report.guest_accessor_id = guest_accessor_id
        report.guest_accessor_type = guest_accessor_type

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def delete_report(db: Session, project: Project, report: ProjectReport) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        db.delete(report)
        db.commit()