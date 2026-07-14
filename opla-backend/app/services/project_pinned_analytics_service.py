from __future__ import annotations

import uuid
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.analytics import SavedQuestion
from app.models.project_pinned_analytics import ProjectPinnedAnalytics

PINNABLE_VIZ_TYPES = {"chart", "kpi", "goal", "table"}
MAX_PINS = 4


class ProjectPinnedAnalyticsService:
    @staticmethod
    def list_pins(db: Session, project_id: uuid.UUID) -> List[ProjectPinnedAnalytics]:
        return (
            db.query(ProjectPinnedAnalytics)
            .options(joinedload(ProjectPinnedAnalytics.question))
            .filter(ProjectPinnedAnalytics.project_id == project_id)
            .order_by(ProjectPinnedAnalytics.sort_order.asc(), ProjectPinnedAnalytics.created_at.asc())
            .all()
        )

    @staticmethod
    def replace_pins(
        db: Session,
        *,
        project_id: uuid.UUID,
        org_id: uuid.UUID,
        question_ids: List[uuid.UUID],
        created_by: uuid.UUID | None,
    ) -> List[ProjectPinnedAnalytics]:
        if len(question_ids) > MAX_PINS:
            raise HTTPException(status_code=400, detail=f"A project can pin at most {MAX_PINS} charts")
        if len(set(question_ids)) != len(question_ids):
            raise HTTPException(status_code=400, detail="Duplicate questions in pin list")

        if question_ids:
            questions = (
                db.query(SavedQuestion)
                .filter(
                    SavedQuestion.id.in_(question_ids),
                    SavedQuestion.org_id == org_id,
                    SavedQuestion.is_archived.is_(False),
                )
                .all()
            )
            by_id = {q.id: q for q in questions}
            if len(by_id) != len(question_ids):
                raise HTTPException(status_code=404, detail="One or more questions were not found in this organization")
            for qid in question_ids:
                question = by_id[qid]
                if question.viz_type not in PINNABLE_VIZ_TYPES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{question.title}' has viz_type '{question.viz_type}' and cannot be pinned",
                    )
                if question.project_id is not None and question.project_id != project_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{question.title}' belongs to another project",
                    )

        db.query(ProjectPinnedAnalytics).filter(ProjectPinnedAnalytics.project_id == project_id).delete()
        pins: List[ProjectPinnedAnalytics] = []
        for index, question_id in enumerate(question_ids):
            pin = ProjectPinnedAnalytics(
                project_id=project_id,
                question_id=question_id,
                sort_order=index,
                created_by=created_by,
            )
            db.add(pin)
            pins.append(pin)
        db.commit()
        return ProjectPinnedAnalyticsService.list_pins(db, project_id)
