from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_directory_item import ProjectDirectoryItem
from app.services.project_access_service import ProjectAccessService


class ProjectDirectoryService:
    @staticmethod
    def list_items(db: Session, project_id: uuid.UUID) -> list[ProjectDirectoryItem]:
        return (
            db.query(ProjectDirectoryItem)
            .filter(ProjectDirectoryItem.project_id == project_id)
            .order_by(ProjectDirectoryItem.is_active.desc(), ProjectDirectoryItem.label.asc())
            .all()
        )

    @staticmethod
    def get_item_or_404(db: Session, project_id: uuid.UUID, item_id: uuid.UUID) -> ProjectDirectoryItem:
        item = (
            db.query(ProjectDirectoryItem)
            .filter(ProjectDirectoryItem.project_id == project_id, ProjectDirectoryItem.id == item_id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Directory item not found")
        return item

    @staticmethod
    def create_item(
        db: Session,
        project: Project,
        *,
        sku_code: str,
        label: str,
        default_price: float | None,
        unit: str | None,
        brand: str | None,
        is_active: bool,
        price_editable: bool,
        metadata_json: dict | None,
        created_by: uuid.UUID,
    ) -> ProjectDirectoryItem:
        ProjectAccessService.ensure_project_is_mutable(project)
        item = ProjectDirectoryItem(
            project_id=project.id,
            sku_code=sku_code.strip(),
            label=label.strip(),
            default_price=default_price,
            unit=unit.strip() if unit else None,
            brand=brand.strip() if brand else None,
            is_active=is_active,
            price_editable=price_editable,
            metadata_json=metadata_json,
            created_by=created_by,
        )
        db.add(item)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail="SKU code already exists in this project") from exc
        db.refresh(item)
        return item

    @staticmethod
    def update_item(
        db: Session,
        project: Project,
        item: ProjectDirectoryItem,
        *,
        sku_code: str | None = None,
        label: str | None = None,
        default_price: float | None = None,
        unit: str | None = None,
        brand: str | None = None,
        is_active: bool | None = None,
        price_editable: bool | None = None,
        metadata_json: dict | None = None,
    ) -> ProjectDirectoryItem:
        ProjectAccessService.ensure_project_is_mutable(project)
        if sku_code is not None:
            item.sku_code = sku_code.strip()
        if label is not None:
            item.label = label.strip()
        if default_price is not None:
            item.default_price = default_price
        if unit is not None:
            item.unit = unit.strip() or None
        if brand is not None:
            item.brand = brand.strip() or None
        if is_active is not None:
            item.is_active = is_active
        if price_editable is not None:
            item.price_editable = price_editable
        if metadata_json is not None:
            item.metadata_json = metadata_json
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(status_code=409, detail="SKU code already exists in this project") from exc
        db.refresh(item)
        return item

    @staticmethod
    def delete_item(db: Session, project: Project, item: ProjectDirectoryItem) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        db.delete(item)
        db.commit()
