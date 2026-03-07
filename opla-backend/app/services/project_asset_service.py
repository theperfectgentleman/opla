from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

import uuid

from app.models.project import Project
from app.models.project_asset import ProjectAsset, ProjectAssetKind
from app.services.project_access_service import ProjectAccessService


class ProjectAssetService:
    @staticmethod
    def list_assets(db: Session, project_id: uuid.UUID) -> list[ProjectAsset]:
        return (
            db.query(ProjectAsset)
            .filter(ProjectAsset.project_id == project_id)
            .order_by(ProjectAsset.updated_at.desc(), ProjectAsset.created_at.desc())
            .all()
        )

    @staticmethod
    def get_asset_or_404(db: Session, project_id: uuid.UUID, asset_id: uuid.UUID) -> ProjectAsset:
        asset = (
            db.query(ProjectAsset)
            .filter(ProjectAsset.project_id == project_id, ProjectAsset.id == asset_id)
            .first()
        )
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        return asset

    @staticmethod
    def create_asset(
        db: Session,
        project: Project,
        *,
        title: str,
        kind: ProjectAssetKind,
        summary: str | None,
        source_url: str | None,
        created_by: uuid.UUID,
    ) -> ProjectAsset:
        ProjectAccessService.ensure_project_is_mutable(project)
        asset = ProjectAsset(
            project_id=project.id,
            title=title.strip(),
            kind=kind,
            summary=summary.strip() if summary else None,
            source_url=source_url.strip() if source_url else None,
            created_by=created_by,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    @staticmethod
    def update_asset(
        db: Session,
        project: Project,
        asset: ProjectAsset,
        *,
        title: str | None = None,
        kind: ProjectAssetKind | None = None,
        summary: str | None = None,
        source_url: str | None = None,
    ) -> ProjectAsset:
        ProjectAccessService.ensure_project_is_mutable(project)

        if title is not None:
            asset.title = title.strip()
        if kind is not None:
            asset.kind = kind
        if summary is not None:
            asset.summary = summary.strip() or None
        if source_url is not None:
            asset.source_url = source_url.strip() or None

        db.commit()
        db.refresh(asset)
        return asset

    @staticmethod
    def delete_asset(db: Session, project: Project, asset: ProjectAsset) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        db.delete(asset)
        db.commit()