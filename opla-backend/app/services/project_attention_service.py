from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.project import Project
from app.models.project_access import AccessorType, ProjectAccess
from app.models.project_attendance import ProjectAttendanceRecord
from app.models.project_attention import (
    AttentionHookKind,
    AttentionItemStatus,
    AttentionSeverity,
    ProjectAttentionHook,
    ProjectAttentionItem,
)
from app.models.project_task import ProjectTask, ProjectTaskStatus
from app.models.project_message_channel import ProjectMessageChannel
from app.models.project_message import ProjectMessage
from app.models.submission import Submission, SubmissionReviewStatus
from app.models.team_member import TeamMember

DEFAULT_HOOKS: list[dict[str, Any]] = [
    {
        "kind": AttentionHookKind.PENDING_REVIEW_AGING.value,
        "severity_default": AttentionSeverity.WARNING.value,
        "config_json": {"warning_hours": 4, "critical_hours": 24},
    },
    {
        "kind": AttentionHookKind.TASK_BLOCKED.value,
        "severity_default": AttentionSeverity.CRITICAL.value,
        "config_json": {},
    },
    {
        "kind": AttentionHookKind.TASK_OVERDUE.value,
        "severity_default": AttentionSeverity.WARNING.value,
        "config_json": {"critical_hours_past_due": 24},
    },
    {
        "kind": AttentionHookKind.ATTENDANCE_GAP.value,
        "severity_default": AttentionSeverity.WARNING.value,
        "config_json": {"grace_minutes_after_window_start": 60},
    },
]

SEVERITY_RANK = {
    AttentionSeverity.INFO.value: 0,
    AttentionSeverity.WARNING.value: 1,
    AttentionSeverity.CRITICAL.value: 2,
}


class ProjectAttentionService:
    @staticmethod
    def seed_default_hooks(db: Session, project_id: uuid.UUID, *, commit: bool = False) -> list[ProjectAttentionHook]:
        existing = {
            hook.kind: hook
            for hook in db.query(ProjectAttentionHook).filter(ProjectAttentionHook.project_id == project_id).all()
        }
        created: list[ProjectAttentionHook] = []
        for spec in DEFAULT_HOOKS:
            if spec["kind"] in existing:
                continue
            hook = ProjectAttentionHook(
                project_id=project_id,
                kind=spec["kind"],
                severity_default=spec["severity_default"],
                enabled=True,
                is_system=True,
                config_json=spec["config_json"],
            )
            db.add(hook)
            created.append(hook)
        if commit:
            db.commit()
        else:
            db.flush()
        return created

    @staticmethod
    def ensure_default_hooks(db: Session, project_id: uuid.UUID) -> dict[str, ProjectAttentionHook]:
        ProjectAttentionService.seed_default_hooks(db, project_id, commit=False)
        hooks = db.query(ProjectAttentionHook).filter(ProjectAttentionHook.project_id == project_id).all()
        return {hook.kind: hook for hook in hooks}

    @staticmethod
    def list_hooks(db: Session, project_id: uuid.UUID) -> list[ProjectAttentionHook]:
        ProjectAttentionService.ensure_default_hooks(db, project_id)
        db.commit()
        return (
            db.query(ProjectAttentionHook)
            .filter(ProjectAttentionHook.project_id == project_id)
            .order_by(ProjectAttentionHook.created_at.asc())
            .all()
        )

    @staticmethod
    def create_custom_hook(
        db: Session,
        project_id: uuid.UUID,
        *,
        kind: str,
        severity_default: str = AttentionSeverity.WARNING.value,
        config_json: dict | None = None,
        enabled: bool = True,
    ) -> ProjectAttentionHook:
        kind = kind.strip()
        if not kind:
            raise HTTPException(status_code=400, detail="Hook kind is required")
        if severity_default not in SEVERITY_RANK:
            raise HTTPException(status_code=400, detail="Invalid severity")
        existing = (
            db.query(ProjectAttentionHook)
            .filter(ProjectAttentionHook.project_id == project_id, ProjectAttentionHook.kind == kind)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="A hook with this kind already exists on the project")

        hook = ProjectAttentionHook(
            project_id=project_id,
            kind=kind,
            severity_default=severity_default,
            enabled=enabled,
            is_system=False,
            config_json=config_json or {},
        )
        db.add(hook)
        db.commit()
        db.refresh(hook)
        return hook

    @staticmethod
    def _hook_enabled(hooks: dict[str, ProjectAttentionHook], kind: str) -> ProjectAttentionHook | None:
        hook = hooks.get(kind)
        if hook is None or not hook.enabled:
            return None
        return hook

    @staticmethod
    def _get_by_dedupe(db: Session, project_id: uuid.UUID, dedupe_key: str) -> ProjectAttentionItem | None:
        return (
            db.query(ProjectAttentionItem)
            .filter(
                ProjectAttentionItem.project_id == project_id,
                ProjectAttentionItem.dedupe_key == dedupe_key,
            )
            .first()
        )

    @staticmethod
    def _upsert_open_item(
        db: Session,
        *,
        project_id: uuid.UUID,
        hook: ProjectAttentionHook | None,
        kind: str,
        dedupe_key: str,
        severity: str,
        title: str,
        detail: str | None,
        deep_link: str | None,
        source_submission_id: uuid.UUID | None = None,
        source_task_id: uuid.UUID | None = None,
        source_attendance_id: uuid.UUID | None = None,
        source_channel_id: uuid.UUID | None = None,
        source_automation_rule_id: uuid.UUID | None = None,
    ) -> ProjectAttentionItem | None:
        existing = ProjectAttentionService._get_by_dedupe(db, project_id, dedupe_key)
        if existing and existing.status == AttentionItemStatus.DISMISSED.value:
            return existing

        hook_id = hook.id if hook is not None else None

        if existing is None:
            item = ProjectAttentionItem(
                project_id=project_id,
                hook_id=hook_id,
                kind=kind,
                dedupe_key=dedupe_key,
                severity=severity,
                title=title,
                detail=detail,
                deep_link=deep_link,
                status=AttentionItemStatus.OPEN.value,
                source_submission_id=source_submission_id,
                source_task_id=source_task_id,
                source_attendance_id=source_attendance_id,
                source_channel_id=source_channel_id,
                source_automation_rule_id=source_automation_rule_id,
            )
            db.add(item)
            return item

        if hook_id is not None:
            existing.hook_id = hook_id
        existing.kind = kind
        if SEVERITY_RANK.get(severity, 0) >= SEVERITY_RANK.get(existing.severity, 0) or existing.status != AttentionItemStatus.OPEN.value:
            existing.severity = severity
        existing.title = title
        existing.detail = detail
        existing.deep_link = deep_link or existing.deep_link
        existing.status = AttentionItemStatus.OPEN.value
        existing.dismissed_at = None
        existing.dismissed_by = None
        if source_submission_id is not None:
            existing.source_submission_id = source_submission_id
        if source_task_id is not None:
            existing.source_task_id = source_task_id
        if source_attendance_id is not None:
            existing.source_attendance_id = source_attendance_id
        if source_channel_id is not None:
            existing.source_channel_id = source_channel_id
        if source_automation_rule_id is not None:
            existing.source_automation_rule_id = source_automation_rule_id
        existing.updated_at = datetime.utcnow()
        return existing

    @staticmethod
    def upsert_automation_alert(
        db: Session,
        *,
        project: Project,
        rule: Any,
        submission: Any,
        title: str,
        detail: str | None,
        severity: str,
        deep_link: str | None,
        commit: bool = False,
    ) -> ProjectAttentionItem | None:
        """Create/update an attention item from a form automation create_alert action.

        Not part of DEFAULT_HOOKS reconcile — lives until dismissed.
        """
        valid = {
            AttentionSeverity.INFO.value,
            AttentionSeverity.WARNING.value,
            AttentionSeverity.CRITICAL.value,
        }
        severity_value = severity if severity in valid else AttentionSeverity.WARNING.value
        dedupe_key = f"automation:{rule.id}:{submission.id}"
        provenance = f"Automation · {getattr(rule, 'name', 'rule')}"
        merged_detail = detail.strip() if detail else None
        if merged_detail:
            merged_detail = f"{merged_detail}\n{provenance}"
        else:
            merged_detail = provenance

        item = ProjectAttentionService._upsert_open_item(
            db,
            project_id=project.id,
            hook=None,
            kind=AttentionHookKind.AUTOMATION_ALERT.value,
            dedupe_key=dedupe_key,
            severity=severity_value,
            title=title[:240] or "Automation alert",
            detail=merged_detail,
            deep_link=deep_link,
            source_submission_id=getattr(submission, "id", None),
            source_automation_rule_id=getattr(rule, "id", None),
        )
        if commit:
            db.commit()
            if item is not None:
                db.refresh(item)
        else:
            db.flush()
        return item

    @staticmethod
    def _resolve_if_open(db: Session, project_id: uuid.UUID, dedupe_key: str) -> None:
        existing = ProjectAttentionService._get_by_dedupe(db, project_id, dedupe_key)
        if existing and existing.status == AttentionItemStatus.OPEN.value:
            existing.status = AttentionItemStatus.RESOLVED.value
            existing.updated_at = datetime.utcnow()

    @staticmethod
    def _age_hours(created_at: datetime, now: datetime) -> float:
        return max(0.0, (now - created_at).total_seconds() / 3600.0)

    @staticmethod
    def _review_severity(age_hours: float, config: dict | None) -> str | None:
        cfg = config or {}
        warning_hours = float(cfg.get("warning_hours", 4))
        critical_hours = float(cfg.get("critical_hours", 24))
        if age_hours >= critical_hours:
            return AttentionSeverity.CRITICAL.value
        if age_hours >= warning_hours:
            return AttentionSeverity.WARNING.value
        return None

    @staticmethod
    def _expected_user_ids(db: Session, project_id: uuid.UUID) -> set[uuid.UUID]:
        rules = db.query(ProjectAccess).filter(ProjectAccess.project_id == project_id).all()
        user_ids: set[uuid.UUID] = set()
        team_ids: list[uuid.UUID] = []
        for rule in rules:
            if rule.accessor_type == AccessorType.USER:
                user_ids.add(rule.accessor_id)
            elif rule.accessor_type == AccessorType.TEAM:
                team_ids.append(rule.accessor_id)
        if team_ids:
            members = db.query(TeamMember.user_id).filter(TeamMember.team_id.in_(team_ids)).all()
            user_ids.update(row[0] for row in members)
        return user_ids

    @staticmethod
    def _ensure_attendance_channel(
        db: Session,
        project: Project,
        *,
        day: date,
        missing_count: int,
        expected_count: int,
        existing_channel_id: uuid.UUID | None,
        actor_id: uuid.UUID | None,
    ) -> uuid.UUID | None:
        from app.services.project_message_service import ProjectMessageService

        ProjectMessageService.ensure_project_channels(db, project.id, created_by=actor_id, commit=False)
        general = (
            db.query(ProjectMessageChannel)
            .filter(
                ProjectMessageChannel.project_id == project.id,
                ProjectMessageChannel.kind == "general",
                ProjectMessageChannel.archived_at.is_(None),
            )
            .first()
        )
        if not general:
            return existing_channel_id

        summary = (
            f"{missing_count} of {expected_count} expected people have not checked in on {day.isoformat()} "
            f"during the collection window. Follow up in General."
        )
        general.summary = summary
        general.updated_at = datetime.utcnow()

        # Avoid duplicate attendance posts for the same day when reconciling repeatedly.
        already = (
            db.query(ProjectMessage)
            .filter(
                ProjectMessage.channel_id == general.id,
                ProjectMessage.body.like(f"%Attendance gap — {day.isoformat()}%"),
                ProjectMessage.deleted_at.is_(None),
            )
            .first()
        )
        if not already:
            body = (
                f"Attendance gap — {day.isoformat()}\n"
                f"{missing_count} of {expected_count} expected people have not checked in during the collection window."
            )
            db.add(
                ProjectMessage(
                    channel_id=general.id,
                    project_id=project.id,
                    author_id=actor_id,
                    body=body,
                )
            )
            db.flush()
            ProjectMessageService._refresh_reply_count(db, general)

        return general.id

    @staticmethod
    def reconcile_project(
        db: Session,
        project: Project,
        *,
        actor_id: uuid.UUID | None = None,
        commit: bool = True,
    ) -> list[ProjectAttentionItem]:
        hooks = ProjectAttentionService.ensure_default_hooks(db, project.id)
        now = datetime.utcnow()
        active_keys: set[str] = set()

        review_hook = ProjectAttentionService._hook_enabled(hooks, AttentionHookKind.PENDING_REVIEW_AGING.value)
        if review_hook:
            pending = (
                db.query(Submission)
                .join(Form, Form.id == Submission.form_id)
                .filter(
                    Form.project_id == project.id,
                    Submission.review_status == SubmissionReviewStatus.SUBMITTED,
                )
                .all()
            )
            for submission in pending:
                age = ProjectAttentionService._age_hours(submission.created_at, now)
                severity = ProjectAttentionService._review_severity(age, review_hook.config_json)
                if not severity:
                    continue
                dedupe = f"pending_review:{submission.id}"
                active_keys.add(dedupe)
                ProjectAttentionService._upsert_open_item(
                    db,
                    project_id=project.id,
                    hook=review_hook,
                    kind=AttentionHookKind.PENDING_REVIEW_AGING.value,
                    dedupe_key=dedupe,
                    severity=severity,
                    title="Submission pending review",
                    detail=f"Awaiting review for {int(age)}h (submitted {submission.created_at.isoformat()}Z).",
                    deep_link=f"/projects/{project.id}?tab=ops&view=review",
                    source_submission_id=submission.id,
                )

        blocked_hook = ProjectAttentionService._hook_enabled(hooks, AttentionHookKind.TASK_BLOCKED.value)
        if blocked_hook:
            blocked_tasks = (
                db.query(ProjectTask)
                .filter(ProjectTask.project_id == project.id, ProjectTask.status == ProjectTaskStatus.BLOCKED)
                .all()
            )
            for task in blocked_tasks:
                dedupe = f"task_blocked:{task.id}"
                active_keys.add(dedupe)
                ProjectAttentionService._upsert_open_item(
                    db,
                    project_id=project.id,
                    hook=blocked_hook,
                    kind=AttentionHookKind.TASK_BLOCKED.value,
                    dedupe_key=dedupe,
                    severity=AttentionSeverity.CRITICAL.value,
                    title=f"Blocked task: {task.title}",
                    detail=task.description or "This task is marked blocked.",
                    deep_link=f"/projects/{project.id}?tab=ops&view=tasks",
                    source_task_id=task.id,
                )

        overdue_hook = ProjectAttentionService._hook_enabled(hooks, AttentionHookKind.TASK_OVERDUE.value)
        if overdue_hook:
            open_statuses = [ProjectTaskStatus.TODO, ProjectTaskStatus.IN_PROGRESS, ProjectTaskStatus.BLOCKED]
            overdue_tasks = (
                db.query(ProjectTask)
                .filter(
                    ProjectTask.project_id == project.id,
                    ProjectTask.status.in_(open_statuses),
                    ProjectTask.due_at.isnot(None),
                    ProjectTask.due_at < now,
                )
                .all()
            )
            cfg = overdue_hook.config_json or {}
            critical_hours = float(cfg.get("critical_hours_past_due", 24))
            for task in overdue_tasks:
                # Blocked items already covered; still allow overdue on blocked as separate signal? Skip blocked to reduce noise.
                if task.status == ProjectTaskStatus.BLOCKED:
                    continue
                hours_late = ProjectAttentionService._age_hours(task.due_at, now)
                severity = (
                    AttentionSeverity.CRITICAL.value
                    if hours_late >= critical_hours
                    else AttentionSeverity.WARNING.value
                )
                dedupe = f"task_overdue:{task.id}"
                active_keys.add(dedupe)
                ProjectAttentionService._upsert_open_item(
                    db,
                    project_id=project.id,
                    hook=overdue_hook,
                    kind=AttentionHookKind.TASK_OVERDUE.value,
                    dedupe_key=dedupe,
                    severity=severity,
                    title=f"Overdue task: {task.title}",
                    detail=f"Due {task.due_at.isoformat()}Z · {int(hours_late)}h overdue.",
                    deep_link=f"/projects/{project.id}?tab=ops&view=tasks",
                    source_task_id=task.id,
                )

        attendance_hook = ProjectAttentionService._hook_enabled(hooks, AttentionHookKind.ATTENDANCE_GAP.value)
        if attendance_hook and project.collection_start_date and project.collection_end_date:
            today = now.date()
            if project.collection_start_date <= today <= project.collection_end_date:
                window_start = project.collection_time_start or time(9, 0)
                window_end = project.collection_time_end or time(17, 0)
                cfg = attendance_hook.config_json or {}
                grace = int(cfg.get("grace_minutes_after_window_start", 60))
                start_dt = datetime.combine(today, window_start)
                end_dt = datetime.combine(today, window_end)
                grace_dt = start_dt + timedelta(minutes=grace)
                if start_dt <= now <= end_dt and now >= grace_dt:
                    expected = ProjectAttentionService._expected_user_ids(db, project.id)
                    if expected:
                        checked = {
                            row.user_id
                            for row in db.query(ProjectAttendanceRecord)
                            .filter(
                                ProjectAttendanceRecord.project_id == project.id,
                                ProjectAttendanceRecord.attendance_date == today,
                            )
                            .all()
                        }
                        missing = expected - checked
                        if missing:
                            dedupe = f"attendance_gap:{project.id}:{today.isoformat()}"
                            active_keys.add(dedupe)
                            existing = ProjectAttentionService._get_by_dedupe(db, project.id, dedupe)
                            channel_id = ProjectAttentionService._ensure_attendance_channel(
                                db,
                                project,
                                day=today,
                                missing_count=len(missing),
                                expected_count=len(expected),
                                existing_channel_id=existing.source_channel_id if existing else None,
                                actor_id=actor_id,
                            )
                            deep_link = (
                                f"/projects/{project.id}/hub?channel={channel_id}"
                                if channel_id
                                else f"/projects/{project.id}?tab=ops&view=tasks"
                            )
                            ProjectAttentionService._upsert_open_item(
                                db,
                                project_id=project.id,
                                hook=attendance_hook,
                                kind=AttentionHookKind.ATTENDANCE_GAP.value,
                                dedupe_key=dedupe,
                                severity=AttentionSeverity.WARNING.value,
                                title="Attendance gap during collection window",
                                detail=f"{len(missing)} of {len(expected)} expected people have not checked in today.",
                                deep_link=deep_link,
                                source_channel_id=channel_id,
                            )

        # Resolve open items whose conditions cleared (same kinds only)
        open_items = (
            db.query(ProjectAttentionItem)
            .filter(
                ProjectAttentionItem.project_id == project.id,
                ProjectAttentionItem.status == AttentionItemStatus.OPEN.value,
                ProjectAttentionItem.kind.in_([spec["kind"] for spec in DEFAULT_HOOKS]),
            )
            .all()
        )
        for item in open_items:
            if item.dedupe_key not in active_keys:
                item.status = AttentionItemStatus.RESOLVED.value
                item.updated_at = datetime.utcnow()

        if commit:
            db.commit()

        return ProjectAttentionService.list_open_items(db, project.id, reconcile=False)

    @staticmethod
    def list_open_items(
        db: Session,
        project_id: uuid.UUID,
        *,
        reconcile: bool = False,
        project: Project | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> list[ProjectAttentionItem]:
        if reconcile:
            if project is None:
                project = db.query(Project).filter(Project.id == project_id).first()
            if project is None:
                return []
            return ProjectAttentionService.reconcile_project(db, project, actor_id=actor_id, commit=True)

        items = (
            db.query(ProjectAttentionItem)
            .filter(
                ProjectAttentionItem.project_id == project_id,
                ProjectAttentionItem.status == AttentionItemStatus.OPEN.value,
            )
            .all()
        )
        items.sort(
            key=lambda item: (
                -SEVERITY_RANK.get(item.severity, 0),
                -(item.updated_at.timestamp() if item.updated_at else 0),
            )
        )
        return items

    @staticmethod
    def dismiss_item(
        db: Session,
        project_id: uuid.UUID,
        item_id: uuid.UUID,
        *,
        dismissed_by: uuid.UUID,
    ) -> ProjectAttentionItem:
        item = (
            db.query(ProjectAttentionItem)
            .filter(ProjectAttentionItem.project_id == project_id, ProjectAttentionItem.id == item_id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Attention item not found")
        if item.status != AttentionItemStatus.OPEN.value:
            return item
        item.status = AttentionItemStatus.DISMISSED.value
        item.dismissed_at = datetime.utcnow()
        item.dismissed_by = dismissed_by
        item.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def on_submission_created(db: Session, submission: Submission) -> None:
        try:
            form = submission.form or db.query(Form).filter(Form.id == submission.form_id).first()
            if not form:
                return
            # Aging thresholds gate creation; reconcile on next list will open when aged.
            ProjectAttentionService.ensure_default_hooks(db, form.project_id)
            db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def on_submission_reviewed(db: Session, submission: Submission) -> None:
        try:
            form = submission.form or db.query(Form).filter(Form.id == submission.form_id).first()
            if not form:
                return
            if submission.review_status != SubmissionReviewStatus.SUBMITTED:
                ProjectAttentionService._resolve_if_open(db, form.project_id, f"pending_review:{submission.id}")
                db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def on_task_changed(db: Session, task: ProjectTask) -> None:
        try:
            hooks = ProjectAttentionService.ensure_default_hooks(db, task.project_id)
            now = datetime.utcnow()

            blocked_hook = ProjectAttentionService._hook_enabled(hooks, AttentionHookKind.TASK_BLOCKED.value)
            if blocked_hook and task.status == ProjectTaskStatus.BLOCKED:
                ProjectAttentionService._upsert_open_item(
                    db,
                    project_id=task.project_id,
                    hook=blocked_hook,
                    kind=AttentionHookKind.TASK_BLOCKED.value,
                    dedupe_key=f"task_blocked:{task.id}",
                    severity=AttentionSeverity.CRITICAL.value,
                    title=f"Blocked task: {task.title}",
                    detail=task.description or "This task is marked blocked.",
                    deep_link=f"/projects/{task.project_id}?tab=ops&view=tasks",
                    source_task_id=task.id,
                )
            else:
                ProjectAttentionService._resolve_if_open(db, task.project_id, f"task_blocked:{task.id}")

            overdue_hook = ProjectAttentionService._hook_enabled(hooks, AttentionHookKind.TASK_OVERDUE.value)
            open_statuses = {ProjectTaskStatus.TODO, ProjectTaskStatus.IN_PROGRESS}
            if (
                overdue_hook
                and task.due_at
                and task.due_at < now
                and task.status in open_statuses
            ):
                cfg = overdue_hook.config_json or {}
                critical_hours = float(cfg.get("critical_hours_past_due", 24))
                hours_late = ProjectAttentionService._age_hours(task.due_at, now)
                severity = (
                    AttentionSeverity.CRITICAL.value
                    if hours_late >= critical_hours
                    else AttentionSeverity.WARNING.value
                )
                ProjectAttentionService._upsert_open_item(
                    db,
                    project_id=task.project_id,
                    hook=overdue_hook,
                    kind=AttentionHookKind.TASK_OVERDUE.value,
                    dedupe_key=f"task_overdue:{task.id}",
                    severity=severity,
                    title=f"Overdue task: {task.title}",
                    detail=f"Due {task.due_at.isoformat()}Z · {int(hours_late)}h overdue.",
                    deep_link=f"/projects/{task.project_id}?tab=ops&view=tasks",
                    source_task_id=task.id,
                )
            else:
                ProjectAttentionService._resolve_if_open(db, task.project_id, f"task_overdue:{task.id}")

            db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def on_attendance_changed(db: Session, project: Project, *, actor_id: uuid.UUID | None = None) -> None:
        try:
            ProjectAttentionService.reconcile_project(db, project, actor_id=actor_id, commit=True)
        except Exception:
            db.rollback()
