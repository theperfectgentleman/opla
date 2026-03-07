from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import Float, and_, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.analytics import AnalyticsDashboard, DashboardCard, SavedQuestion
from app.models.form import Form
from app.models.form_dataset import FormDataset, FormDatasetField, FormDatasetFieldStatus, FormDatasetStatus
from app.models.project import Project
from app.models.submission import Submission


ALLOWED_AGG_FNS = {
    "count": lambda col: func.count(col),
    "sum": lambda col: func.sum(cast(col, Float)),
    "avg": lambda col: func.avg(cast(col, Float)),
    "min": lambda col: func.min(col),
    "max": lambda col: func.max(col),
    "count_distinct": lambda col: func.count(col.distinct()),
}


class AnalyticsService:
    @staticmethod
    def list_sources(db: Session, org_id: uuid.UUID) -> list[dict]:
        datasets = (
            db.query(FormDataset)
            .options(
                selectinload(FormDataset.fields),
                selectinload(FormDataset.form).selectinload(Form.project),
            )
            .join(Form, Form.id == FormDataset.form_id)
            .join(Project, Project.id == Form.project_id)
            .filter(
                Project.org_id == org_id,
                FormDataset.status == FormDatasetStatus.ACTIVE,
            )
            .order_by(FormDataset.updated_at.desc())
            .all()
        )

        sources: list[dict] = []
        for dataset in datasets:
            record_count = (
                db.query(func.count(Submission.id))
                .filter(Submission.dataset_id == dataset.id)
                .scalar()
            )
            if record_count is None:
                record_count = (
                    db.query(func.count(Submission.id))
                    .filter(Submission.form_id == dataset.form_id)
                    .scalar()
                    or 0
                )

            fields = [
                {
                    "field_identifier": field.field_identifier,
                    "field_key": field.field_key,
                    "label": field.label,
                    "field_type": field.field_type,
                }
                for field in dataset.fields
                if field.status == FormDatasetFieldStatus.ACTIVE
            ]

            sources.append(
                {
                    "dataset_id": dataset.id,
                    "form_id": dataset.form_id,
                    "dataset_name": dataset.name,
                    "dataset_slug": dataset.slug,
                    "form_title": dataset.form.title if dataset.form else dataset.name,
                    "project_id": dataset.form.project_id if dataset.form else None,
                    "project_name": dataset.form.project.name if dataset.form and dataset.form.project else None,
                    "fields": fields,
                    "record_count": record_count,
                }
            )

        return sources

    @staticmethod
    def execute_query(
        db: Session,
        org_id: uuid.UUID,
        dataset_id: uuid.UUID,
        select_fields: list[str],
        filters: Optional[dict] = None,
        group_by: Optional[list[str]] = None,
        aggregates: Optional[list[dict]] = None,
        order_by: Optional[list[dict]] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> dict:
        dataset = (
            db.query(FormDataset)
            .options(selectinload(FormDataset.fields))
            .join(Form, Form.id == FormDataset.form_id)
            .join(Project, Project.id == Form.project_id)
            .filter(
                FormDataset.id == dataset_id,
                Project.org_id == org_id,
                FormDataset.status == FormDatasetStatus.ACTIVE,
            )
            .first()
        )
        if not dataset:
            raise ValueError("DATASET_NOT_FOUND")

        allowed_fields = {
            field.field_key: field
            for field in dataset.fields
            if field.status == FormDatasetFieldStatus.ACTIVE
        }
        meta_columns = {
            "_submission_id": Submission.id.label("_submission_id"),
            "_submitted_at": Submission.created_at.label("_submitted_at"),
            "_user_id": Submission.user_id.label("_user_id"),
            "_form_version": Submission.form_version_number.label("_form_version"),
        }

        def resolve_column(key: str):
            if key in meta_columns:
                return meta_columns[key]
            if key not in allowed_fields:
                raise ValueError(f"FIELD_NOT_ALLOWED:{key}")
            return Submission.data[key].as_string().label(key)

        selected_columns = []
        order_aliases = {}
        group_by = group_by or []
        aggregates = aggregates or []
        order_by = order_by or []

        if aggregates:
            for group_key in group_by:
                col = resolve_column(group_key)
                selected_columns.append(col)
                order_aliases[group_key] = col
            for aggregate in aggregates:
                function_name = aggregate["fn"]
                if function_name not in ALLOWED_AGG_FNS:
                    raise ValueError(f"AGG_NOT_ALLOWED:{function_name}")
                col = resolve_column(aggregate["field"])
                alias = aggregate.get("alias") or f"{function_name}_{aggregate['field']}"
                expr = ALLOWED_AGG_FNS[function_name](col).label(alias)
                selected_columns.append(expr)
                order_aliases[alias] = expr
        elif select_fields:
            for field_key in select_fields:
                col = resolve_column(field_key)
                selected_columns.append(col)
                order_aliases[field_key] = col
        else:
            selected_columns.extend([meta_columns["_submission_id"], meta_columns["_submitted_at"]])
            order_aliases["_submission_id"] = meta_columns["_submission_id"]
            order_aliases["_submitted_at"] = meta_columns["_submitted_at"]
            for field_key in allowed_fields:
                col = Submission.data[field_key].as_string().label(field_key)
                selected_columns.append(col)
                order_aliases[field_key] = col

        dataset_filter = Submission.dataset_id == dataset.id
        has_dataset_rows = db.query(Submission.id).filter(dataset_filter).first() is not None
        base_filter = dataset_filter if has_dataset_rows else Submission.form_id == dataset.form_id

        query = select(*selected_columns).where(base_filter)

        if filters:
            where_clause = AnalyticsService._build_where(filters, allowed_fields)
            if where_clause is not None:
                query = query.where(where_clause)

        if aggregates and group_by:
            query = query.group_by(*(resolve_column(group_key) for group_key in group_by))

        for ordering in order_by:
            key = ordering["field"]
            col = order_aliases.get(key)
            if col is None:
                col = resolve_column(key)
            query = query.order_by(col.desc() if ordering.get("direction", "asc") == "desc" else col.asc())

        total_count = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
        result = db.execute(query.limit(limit).offset(offset))
        rows = [dict(row._mapping) for row in result]

        for row in rows:
            for key, value in list(row.items()):
                if isinstance(value, uuid.UUID):
                    row[key] = str(value)
                elif hasattr(value, "isoformat"):
                    row[key] = value.isoformat()

        columns_meta = AnalyticsService._build_columns_meta(allowed_fields, meta_columns, select_fields, group_by, aggregates)
        return {
            "columns": columns_meta,
            "rows": rows,
            "total_count": total_count,
            "truncated": total_count > offset + limit,
        }

    @staticmethod
    def _build_columns_meta(allowed_fields: dict[str, FormDatasetField], meta_columns: dict, select_fields: list[str], group_by: list[str], aggregates: list[dict]) -> list[dict]:
        if aggregates:
            meta = []
            for group_key in group_by:
                field = allowed_fields.get(group_key)
                meta.append({
                    "key": group_key,
                    "label": field.label if field and field.label else group_key,
                    "type": field.field_type if field and field.field_type else "text",
                })
            for aggregate in aggregates:
                alias = aggregate.get("alias") or f"{aggregate['fn']}_{aggregate['field']}"
                meta.append({"key": alias, "label": alias, "type": "number"})
            return meta

        if select_fields:
            meta = []
            for field_key in select_fields:
                if field_key in meta_columns:
                    meta.append({"key": field_key, "label": field_key, "type": "meta"})
                    continue
                field = allowed_fields[field_key]
                meta.append({
                    "key": field_key,
                    "label": field.label or field_key,
                    "type": field.field_type or "text",
                })
            return meta

        meta = [
            {"key": "_submission_id", "label": "ID", "type": "uuid"},
            {"key": "_submitted_at", "label": "Submitted", "type": "datetime"},
        ]
        for field_key, field in allowed_fields.items():
            meta.append({
                "key": field_key,
                "label": field.label or field_key,
                "type": field.field_type or "text",
            })
        return meta

    @staticmethod
    def _build_where(rule_group: dict, allowed_fields: dict[str, FormDatasetField]):
        combinator = rule_group.get("combinator", "and")
        rules = rule_group.get("rules", [])
        clauses = []

        for rule in rules:
            if "combinator" in rule:
                nested = AnalyticsService._build_where(rule, allowed_fields)
                if nested is not None:
                    clauses.append(nested)
                continue

            field_key = rule.get("field")
            operator = rule.get("operator")
            value = rule.get("value")
            if not field_key or not operator or field_key not in allowed_fields:
                continue

            column = Submission.data[field_key].as_string()
            clause = AnalyticsService._apply_operator(column, operator, value)
            if clause is not None:
                clauses.append(clause)

        if not clauses:
            return None
        return or_(*clauses) if combinator == "or" else and_(*clauses)

    @staticmethod
    def _apply_operator(column, operator: str, value):
        if operator in {"=", "equal"}:
            return column == value
        if operator in {"!=", "notEqual"}:
            return column != value
        if operator in {">", "greaterThan"}:
            return cast(column, Float) > float(value)
        if operator in {"<", "lessThan"}:
            return cast(column, Float) < float(value)
        if operator in {">=", "greaterThanOrEqual"}:
            return cast(column, Float) >= float(value)
        if operator in {"<=", "lessThanOrEqual"}:
            return cast(column, Float) <= float(value)
        if operator == "contains":
            return column.ilike(f"%{value}%")
        if operator == "beginsWith":
            return column.ilike(f"{value}%")
        if operator == "endsWith":
            return column.ilike(f"%{value}")
        if operator in {"null", "isEmpty"}:
            return column.is_(None)
        if operator in {"notNull", "isNotEmpty"}:
            return column.isnot(None)
        if operator == "between":
            values = value if isinstance(value, list) else [item.strip() for item in str(value).split(",")]
            if len(values) == 2:
                return and_(cast(column, Float) >= float(values[0]), cast(column, Float) <= float(values[1]))
            return None
        if operator == "in":
            values = value if isinstance(value, list) else [item.strip() for item in str(value).split(",")]
            return column.in_(values)
        if operator == "notIn":
            values = value if isinstance(value, list) else [item.strip() for item in str(value).split(",")]
            return column.notin_(values)
        return None

    @staticmethod
    def create_question(db: Session, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> SavedQuestion:
        question = SavedQuestion(org_id=org_id, created_by=user_id, **data)
        db.add(question)
        db.commit()
        db.refresh(question)
        return question

    @staticmethod
    def get_question(db: Session, question_id: uuid.UUID) -> Optional[SavedQuestion]:
        return db.query(SavedQuestion).filter(SavedQuestion.id == question_id).first()

    @staticmethod
    def list_questions(db: Session, org_id: uuid.UUID, project_id: Optional[uuid.UUID] = None) -> list[SavedQuestion]:
        query = db.query(SavedQuestion).filter(
            SavedQuestion.org_id == org_id,
            SavedQuestion.is_archived.is_(False),
        )
        if project_id:
            query = query.filter(SavedQuestion.project_id == project_id)
        return query.order_by(SavedQuestion.updated_at.desc()).all()

    @staticmethod
    def update_question(db: Session, question: SavedQuestion, data: dict) -> SavedQuestion:
        for key, value in data.items():
            setattr(question, key, value)
        db.commit()
        db.refresh(question)
        return question

    @staticmethod
    def delete_question(db: Session, question: SavedQuestion) -> None:
        db.delete(question)
        db.commit()

    @staticmethod
    def create_dashboard(db: Session, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> AnalyticsDashboard:
        cards_data = data.pop("cards", [])
        dashboard = AnalyticsDashboard(org_id=org_id, created_by=user_id, **data)
        db.add(dashboard)
        db.flush()
        for card_data in cards_data:
            db.add(DashboardCard(dashboard_id=dashboard.id, **card_data))
        db.commit()
        db.refresh(dashboard)
        return dashboard

    @staticmethod
    def get_dashboard(db: Session, dashboard_id: uuid.UUID) -> Optional[AnalyticsDashboard]:
        return (
            db.query(AnalyticsDashboard)
            .options(selectinload(AnalyticsDashboard.cards).selectinload(DashboardCard.question))
            .filter(AnalyticsDashboard.id == dashboard_id)
            .first()
        )

    @staticmethod
    def list_dashboards(db: Session, org_id: uuid.UUID, project_id: Optional[uuid.UUID] = None) -> list[AnalyticsDashboard]:
        query = (
            db.query(AnalyticsDashboard)
            .options(selectinload(AnalyticsDashboard.cards).selectinload(DashboardCard.question))
            .filter(
                AnalyticsDashboard.org_id == org_id,
                AnalyticsDashboard.is_archived.is_(False),
            )
        )
        if project_id:
            query = query.filter(AnalyticsDashboard.project_id == project_id)
        return query.order_by(AnalyticsDashboard.updated_at.desc()).all()

    @staticmethod
    def update_dashboard(db: Session, dashboard: AnalyticsDashboard, data: dict) -> AnalyticsDashboard:
        cards_data = data.pop("cards", None)
        for key, value in data.items():
            setattr(dashboard, key, value)

        if cards_data is not None:
            db.query(DashboardCard).filter(DashboardCard.dashboard_id == dashboard.id).delete()
            for card_data in cards_data:
                db.add(DashboardCard(dashboard_id=dashboard.id, **card_data))

        db.commit()
        db.refresh(dashboard)
        return dashboard

    @staticmethod
    def delete_dashboard(db: Session, dashboard: AnalyticsDashboard) -> None:
        db.delete(dashboard)
        db.commit()
