from __future__ import annotations

from datetime import date, datetime
import re
import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.form_automation_rule import FormAutomationAction, FormAutomationEvent, FormAutomationRule
from app.models.project_access import AccessorType
from app.models.project_task import ProjectTaskKind
from app.models.submission import Submission
from app.services.project_task_service import ProjectTaskService


class FormAutomationService:
    TEMPLATE_PATTERN = re.compile(r"\{\{\s*([^{}]+?)\s*\}\}")

    @staticmethod
    def list_rules(db: Session, form_id: uuid.UUID) -> list[FormAutomationRule]:
        return (
            db.query(FormAutomationRule)
            .filter(FormAutomationRule.form_id == form_id)
            .order_by(FormAutomationRule.created_at.asc())
            .all()
        )

    @staticmethod
    def get_rule(db: Session, form_id: uuid.UUID, rule_id: uuid.UUID) -> FormAutomationRule | None:
        return (
            db.query(FormAutomationRule)
            .filter(FormAutomationRule.form_id == form_id, FormAutomationRule.id == rule_id)
            .first()
        )

    @staticmethod
    def create_rule(
        db: Session,
        form: Form,
        *,
        name: str,
        description: Optional[str],
        event_type: FormAutomationEvent,
        action_type: FormAutomationAction,
        is_active: bool,
        conditions_json: Optional[dict[str, Any]],
        action_config_json: dict[str, Any],
        created_by: uuid.UUID,
    ) -> FormAutomationRule:
        rule = FormAutomationRule(
            form_id=form.id,
            name=name.strip(),
            description=description.strip() if description else None,
            event_type=event_type,
            action_type=action_type,
            is_active=is_active,
            conditions_json=conditions_json,
            action_config_json=action_config_json,
            created_by=created_by,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def update_rule(
        db: Session,
        rule: FormAutomationRule,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        event_type: Optional[FormAutomationEvent] = None,
        action_type: Optional[FormAutomationAction] = None,
        is_active: Optional[bool] = None,
        conditions_json: Optional[dict[str, Any]] = None,
        action_config_json: Optional[dict[str, Any]] = None,
    ) -> FormAutomationRule:
        if name is not None:
            rule.name = name.strip()
        if description is not None:
            rule.description = description.strip() or None
        if event_type is not None:
            rule.event_type = event_type
        if action_type is not None:
            rule.action_type = action_type
        if is_active is not None:
            rule.is_active = is_active
        if conditions_json is not None:
            rule.conditions_json = conditions_json
        if action_config_json is not None:
            rule.action_config_json = action_config_json

        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def delete_rule(db: Session, rule: FormAutomationRule) -> None:
        db.delete(rule)
        db.commit()

    @staticmethod
    def run_submission_event(
        db: Session,
        submission: Submission,
        event_type: FormAutomationEvent,
        *,
        actor_id: Optional[uuid.UUID] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> None:
        rules = (
            db.query(FormAutomationRule)
            .filter(
                FormAutomationRule.form_id == submission.form_id,
                FormAutomationRule.event_type == event_type,
                FormAutomationRule.is_active.is_(True),
            )
            .all()
        )
        if not rules or not submission.form:
            return

        event_context = {
            "submission": submission,
            "data": submission.data or {},
            "context": context or {},
        }

        for rule in rules:
            if not FormAutomationService._matches_conditions(rule.conditions_json, event_context):
                continue
            FormAutomationService._execute_action(db, submission.form, submission, rule, actor_id=actor_id, event_context=event_context)

    @staticmethod
    def _matches_conditions(conditions: Optional[dict[str, Any]], event_context: dict[str, Any]) -> bool:
        if not conditions:
            return True
        rules = conditions.get("rules") or []
        combinator = str(conditions.get("combinator") or "and").lower()
        evaluations: list[bool] = []

        for rule in rules:
            if isinstance(rule, dict) and "rules" in rule:
                evaluations.append(FormAutomationService._matches_conditions(rule, event_context))
            elif isinstance(rule, dict):
                evaluations.append(FormAutomationService._evaluate_rule(rule, event_context))

        if not evaluations:
            return True
        return any(evaluations) if combinator == "or" else all(evaluations)

    @staticmethod
    def _evaluate_rule(rule: dict[str, Any], event_context: dict[str, Any]) -> bool:
        field_path = rule.get("field")
        operator = str(rule.get("operator") or "equal")
        expected = rule.get("value")
        if not field_path:
            return False

        actual = FormAutomationService._resolve_path(event_context, str(field_path))

        if operator in {"=", "equal", "eq"}:
            return actual == expected
        if operator in {"!=", "notEqual", "neq"}:
            return actual != expected
        if operator in {">", "greaterThan", "gt"}:
            return actual is not None and float(actual) > float(expected)
        if operator in {"<", "lessThan", "lt"}:
            return actual is not None and float(actual) < float(expected)
        if operator in {">=", "greaterThanOrEqual", "gte"}:
            return actual is not None and float(actual) >= float(expected)
        if operator in {"<=", "lessThanOrEqual", "lte"}:
            return actual is not None and float(actual) <= float(expected)
        if operator == "contains":
            return actual is not None and str(expected) in str(actual)
        if operator == "in":
            values = expected if isinstance(expected, list) else [expected]
            return actual in values
        if operator in {"exists", "notNull", "isNotEmpty"}:
            return actual not in (None, "", [])
        if operator in {"null", "isEmpty"}:
            return actual in (None, "", [])
        return False

    @staticmethod
    def _execute_action(
        db: Session,
        form: Form,
        submission: Submission,
        rule: FormAutomationRule,
        *,
        actor_id: Optional[uuid.UUID],
        event_context: dict[str, Any],
    ) -> None:
        if rule.action_type != FormAutomationAction.CREATE_TASK:
            return

        config = rule.action_config_json or {}
        title = FormAutomationService._render_template(str(config.get("title_template") or "Follow up {{ submission.id }}"), event_context)
        description_template = config.get("description_template")
        description = FormAutomationService._render_template(str(description_template), event_context) if description_template else None
        kind = ProjectTaskKind(str(config.get("kind") or ProjectTaskKind.GENERAL.value))

        assigned_accessor_type = config.get("assigned_accessor_type")
        if assigned_accessor_type is not None:
            assigned_accessor_type = AccessorType(str(assigned_accessor_type))

        ProjectTaskService.create_task(
            db,
            form.project,
            title=title,
            description=description,
            kind=kind,
            starts_at=FormAutomationService._resolve_datetime_value(config, event_context, field_key="starts_at_field", value_key="starts_at_value"),
            due_at=FormAutomationService._resolve_datetime_value(config, event_context, field_key="due_at_field", value_key="due_at_value"),
            visit_date=FormAutomationService._resolve_date_value(config, event_context, field_key="visit_date_field", value_key="visit_date_value"),
            source_submission_id=submission.id,
            context_json=None,
            assigned_accessor_id=FormAutomationService._coerce_uuid(config.get("assigned_accessor_id")),
            assigned_accessor_type=assigned_accessor_type,
            created_by=actor_id or submission.user_id or rule.created_by,
            automation_rule_id=rule.id,
        )

    @staticmethod
    def _resolve_date_value(config: dict[str, Any], event_context: dict[str, Any], *, field_key: str, value_key: str) -> Optional[date]:
        raw_value = config.get(value_key)
        if raw_value is None and config.get(field_key):
            raw_value = FormAutomationService._resolve_path(event_context, str(config[field_key]))
        if raw_value in (None, ""):
            return None
        if isinstance(raw_value, date) and not isinstance(raw_value, datetime):
            return raw_value
        if isinstance(raw_value, datetime):
            return raw_value.date()
        return date.fromisoformat(str(raw_value))

    @staticmethod
    def _resolve_datetime_value(config: dict[str, Any], event_context: dict[str, Any], *, field_key: str, value_key: str) -> Optional[datetime]:
        raw_value = config.get(value_key)
        if raw_value is None and config.get(field_key):
            raw_value = FormAutomationService._resolve_path(event_context, str(config[field_key]))
        if raw_value in (None, ""):
            return None
        if isinstance(raw_value, datetime):
            return raw_value
        return datetime.fromisoformat(str(raw_value).replace("Z", "+00:00"))

    @staticmethod
    def _render_template(template: str, event_context: dict[str, Any]) -> str:
        def replace(match: re.Match[str]) -> str:
            value = FormAutomationService._resolve_path(event_context, match.group(1).strip())
            return "" if value is None else str(value)

        return FormAutomationService.TEMPLATE_PATTERN.sub(replace, template).strip()

    @staticmethod
    def _resolve_path(event_context: dict[str, Any], path: str) -> Any:
        parts = [part for part in path.split(".") if part]
        if not parts:
            return None
        current: Any = event_context
        if parts[0] not in event_context:
            parts = ["data", *parts]

        for part in parts:
            if current is None:
                return None
            if isinstance(current, dict):
                current = current.get(part)
            else:
                current = getattr(current, part, None)
        return current

    @staticmethod
    def _coerce_uuid(value: Any) -> Optional[uuid.UUID]:
        if value in (None, ""):
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))