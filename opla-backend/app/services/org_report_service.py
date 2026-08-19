from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.analytics import OrgReport


class OrgReportService:
    @staticmethod
    def list_reports(db: Session, org_id: uuid.UUID) -> list[OrgReport]:
        return (
            db.query(OrgReport)
            .filter(OrgReport.org_id == org_id)
            .order_by(OrgReport.updated_at.desc())
            .all()
        )

    @staticmethod
    def get_report(db: Session, org_id: uuid.UUID, report_id: uuid.UUID) -> OrgReport | None:
        return (
            db.query(OrgReport)
            .filter(OrgReport.id == report_id, OrgReport.org_id == org_id)
            .first()
        )

    @staticmethod
    def create_report(db: Session, org_id: uuid.UUID, user_id: uuid.UUID | None, data: dict) -> OrgReport:
        report = OrgReport(
            org_id=org_id,
            created_by=user_id,
            title=str(data.get("title") or "Untitled report").strip() or "Untitled report",
            description=data.get("description") or "",
            status=data.get("status") or "draft",
            source_project_ids=data.get("source_project_ids") or data.get("sourceProjectIds") or [],
            team_grants=data.get("team_grants") or data.get("teamGrants") or [],
            comments=data.get("comments") or [],
            content=data.get("content") or [],
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def update_report(db: Session, report: OrgReport, data: dict) -> OrgReport:
        mapping = {
            "title": "title",
            "description": "description",
            "status": "status",
            "source_project_ids": "source_project_ids",
            "sourceProjectIds": "source_project_ids",
            "team_grants": "team_grants",
            "teamGrants": "team_grants",
            "comments": "comments",
            "content": "content",
        }
        for key, attr in mapping.items():
            if key in data and data[key] is not None:
                setattr(report, attr, data[key])
        report.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def serialize(report: OrgReport) -> dict:
        return {
            "id": str(report.id),
            "orgId": str(report.org_id),
            "title": report.title,
            "description": report.description or "",
            "status": report.status,
            "sourceProjectIds": report.source_project_ids or [],
            "teamGrants": report.team_grants or [],
            "comments": report.comments or [],
            "content": report.content or [],
            "updatedAt": report.updated_at.isoformat() if report.updated_at else "",
            "createdAt": report.created_at.isoformat() if report.created_at else "",
        }
