from __future__ import annotations

from datetime import date, datetime
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_attendance import ProjectAttendanceRecord, ProjectAttendanceStatus
from app.services.project_access_service import ProjectAccessService


class ProjectAttendanceService:
    @staticmethod
    def _validate_location(location: dict | None) -> dict:
        if not isinstance(location, dict):
            raise HTTPException(status_code=400, detail="Attendance location is required")

        latitude = location.get("latitude")
        longitude = location.get("longitude")
        if latitude is None or longitude is None:
            raise HTTPException(status_code=400, detail="Attendance location must include latitude and longitude")

        return {
            "latitude": float(latitude),
            "longitude": float(longitude),
            "accuracy_meters": float(location["accuracy_meters"]) if location.get("accuracy_meters") is not None else None,
            "label": str(location["label"]).strip() if location.get("label") else None,
        }

    @staticmethod
    def _get_day_record(
        db: Session,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        attendance_date: date,
    ) -> ProjectAttendanceRecord | None:
        return (
            db.query(ProjectAttendanceRecord)
            .filter(
                ProjectAttendanceRecord.project_id == project_id,
                ProjectAttendanceRecord.user_id == user_id,
                ProjectAttendanceRecord.attendance_date == attendance_date,
            )
            .first()
        )

    @staticmethod
    def list_records(
        db: Session,
        project_id: uuid.UUID,
        target_date: date | None = None,
    ) -> list[ProjectAttendanceRecord]:
        query = db.query(ProjectAttendanceRecord).filter(ProjectAttendanceRecord.project_id == project_id)
        if target_date is not None:
            query = query.filter(ProjectAttendanceRecord.attendance_date == target_date)
        return query.order_by(ProjectAttendanceRecord.check_in_at.desc()).all()

    @staticmethod
    def get_record_for_user_day(
        db: Session,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        target_date: date,
    ) -> ProjectAttendanceRecord | None:
        return ProjectAttendanceService._get_day_record(db, project_id, user_id, target_date)

    @staticmethod
    def check_in(
        db: Session,
        project: Project,
        *,
        user_id: uuid.UUID,
        timestamp: datetime,
        location: dict,
        note: str | None,
        image_uri: str | None,
        signature: str | None,
    ) -> ProjectAttendanceRecord:
        ProjectAccessService.ensure_project_is_mutable(project)
        attendance_date = timestamp.date()
        existing = ProjectAttendanceService._get_day_record(db, project.id, user_id, attendance_date)
        if existing is not None:
            return existing

        record = ProjectAttendanceRecord(
            project_id=project.id,
            user_id=user_id,
            attendance_date=attendance_date,
            status=ProjectAttendanceStatus.CHECKED_IN,
            check_in_at=timestamp,
            check_in_location_json=ProjectAttendanceService._validate_location(location),
            check_in_note=note.strip() if note else None,
            check_in_image_uri=image_uri.strip() if image_uri else None,
            check_in_signature=signature.strip() if signature else None,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def check_out(
        db: Session,
        project: Project,
        *,
        user_id: uuid.UUID,
        timestamp: datetime,
        location: dict,
        note: str | None,
        image_uri: str | None,
        signature: str | None,
    ) -> ProjectAttendanceRecord:
        ProjectAccessService.ensure_project_is_mutable(project)
        attendance_date = timestamp.date()
        record = ProjectAttendanceService._get_day_record(db, project.id, user_id, attendance_date)
        if record is None:
            raise HTTPException(status_code=404, detail="No attendance check-in found for this day")
        if record.check_out_at is not None:
            return record
        if timestamp < record.check_in_at:
            raise HTTPException(status_code=400, detail="Check-out time cannot be before check-in time")

        record.check_out_at = timestamp
        record.check_out_location_json = ProjectAttendanceService._validate_location(location)
        record.check_out_note = note.strip() if note else None
        record.check_out_image_uri = image_uri.strip() if image_uri else None
        record.check_out_signature = signature.strip() if signature else None
        record.status = ProjectAttendanceStatus.CHECKED_OUT
        db.commit()
        db.refresh(record)
        return record