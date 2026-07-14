from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.project import Project
from app.models.project_access import AccessorType, ProjectAccess
from app.models.project_thread import ProjectThread
from app.models.project_thread_message import ProjectThreadMessage, ProjectThreadNotification
from app.models.team import Team
from app.models.user import User
from app.services.project_access_service import ProjectAccessService

AUTHOR_EDIT_WINDOW = timedelta(hours=24)
MENTION_PATTERN = re.compile(r"@([\w][\w.\-]*)")


class ProjectThreadService:
    @staticmethod
    def list_threads(db: Session, project_id: uuid.UUID) -> list[ProjectThread]:
        ProjectThreadService.ensure_project_channels(db, project_id, commit=True)
        return (
            db.query(ProjectThread)
            .options(joinedload(ProjectThread.team))
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.archived_at.is_(None),
                ProjectThread.kind.in_(("general", "team")),
            )
            .order_by(
                # General first, then team channels by title
                ProjectThread.kind.asc(),
                ProjectThread.title.asc(),
            )
            .all()
        )

    @staticmethod
    def get_thread_or_404(db: Session, project_id: uuid.UUID, thread_id: uuid.UUID) -> ProjectThread:
        thread = (
            db.query(ProjectThread)
            .options(joinedload(ProjectThread.team))
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.id == thread_id,
                ProjectThread.archived_at.is_(None),
            )
            .first()
        )
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        return thread

    @staticmethod
    def get_general_channel(db: Session, project_id: uuid.UUID) -> ProjectThread:
        ProjectThreadService.ensure_project_channels(db, project_id, commit=True)
        thread = (
            db.query(ProjectThread)
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.kind == "general",
                ProjectThread.archived_at.is_(None),
            )
            .first()
        )
        if not thread:
            raise HTTPException(status_code=500, detail="General channel missing")
        return thread

    @staticmethod
    def ensure_project_channels(
        db: Session,
        project_id: uuid.UUID,
        *,
        created_by: uuid.UUID | None = None,
        commit: bool = True,
    ) -> list[ProjectThread]:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        general = (
            db.query(ProjectThread)
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.kind == "general",
                ProjectThread.archived_at.is_(None),
            )
            .first()
        )
        if not general:
            # Revive a legacy stub if present
            legacy = (
                db.query(ProjectThread)
                .filter(ProjectThread.project_id == project_id)
                .order_by(ProjectThread.updated_at.desc(), ProjectThread.created_at.desc())
                .first()
            )
            if legacy and legacy.kind in (None, "general", "legacy") and legacy.team_id is None:
                legacy.kind = "general"
                legacy.title = "General"
                legacy.summary = legacy.summary or "Project-wide discussion"
                legacy.archived_at = None
                legacy.team_id = None
                general = legacy
            else:
                general = ProjectThread(
                    project_id=project_id,
                    title="General",
                    summary="Project-wide discussion",
                    reply_count=0,
                    kind="general",
                    created_by=created_by,
                )
                db.add(general)
                db.flush()

        team_ids = [
            rule.accessor_id
            for rule in db.query(ProjectAccess)
            .filter(
                ProjectAccess.project_id == project_id,
                ProjectAccess.accessor_type == AccessorType.TEAM,
            )
            .all()
        ]
        teams = (
            db.query(Team).filter(Team.id.in_(team_ids)).all()
            if team_ids
            else []
        )
        team_by_id = {t.id: t for t in teams}

        existing_team_channels = {
            t.team_id: t
            for t in db.query(ProjectThread)
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.kind == "team",
                ProjectThread.archived_at.is_(None),
                ProjectThread.team_id.isnot(None),
            )
            .all()
        }

        for team_id in team_ids:
            team = team_by_id.get(team_id)
            if not team:
                continue
            channel = existing_team_channels.get(team_id)
            if channel:
                if channel.title != team.name:
                    channel.title = team.name
                continue
            db.add(
                ProjectThread(
                    project_id=project_id,
                    title=team.name,
                    summary=f"Discussion for {team.name}",
                    reply_count=0,
                    kind="team",
                    team_id=team_id,
                    created_by=created_by,
                )
            )

        # Archive team channels whose team access was revoked
        for team_id, channel in existing_team_channels.items():
            if team_id not in team_by_id:
                channel.archived_at = datetime.utcnow()

        # Archive leftover free-form stubs
        leftovers = (
            db.query(ProjectThread)
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.archived_at.is_(None),
                ~ProjectThread.kind.in_(("general", "team")),
            )
            .all()
        )
        for stub in leftovers:
            stub.archived_at = datetime.utcnow()

        if commit:
            db.commit()
        else:
            db.flush()

        return (
            db.query(ProjectThread)
            .filter(
                ProjectThread.project_id == project_id,
                ProjectThread.archived_at.is_(None),
                ProjectThread.kind.in_(("general", "team")),
            )
            .order_by(ProjectThread.kind.asc(), ProjectThread.title.asc())
            .all()
        )

    @staticmethod
    def list_messages(
        db: Session,
        project_id: uuid.UUID,
        thread_id: uuid.UUID,
        *,
        limit: int = 50,
        before: datetime | None = None,
    ) -> list[ProjectThreadMessage]:
        ProjectThreadService.get_thread_or_404(db, project_id, thread_id)
        q = (
            db.query(ProjectThreadMessage)
            .options(joinedload(ProjectThreadMessage.author))
            .filter(
                ProjectThreadMessage.project_id == project_id,
                ProjectThreadMessage.thread_id == thread_id,
            )
        )
        if before:
            q = q.filter(ProjectThreadMessage.created_at < before)
        return q.order_by(ProjectThreadMessage.created_at.desc()).limit(limit).all()

    @staticmethod
    def _resolve_mentions(
        db: Session,
        project: Project,
        *,
        body: str,
        mentioned_user_ids: list[uuid.UUID] | None,
    ) -> list[dict]:
        user_ids: set[uuid.UUID] = set(mentioned_user_ids or [])

        tokens = {m.group(1).lower() for m in MENTION_PATTERN.finditer(body or "")}
        if tokens:
            from app.services.project_attention_service import ProjectAttentionService

            candidate_ids = ProjectAttentionService._expected_user_ids(db, project.id)
            candidates = (
                db.query(User).filter(User.id.in_(list(candidate_ids))).all()
                if candidate_ids
                else []
            )
            for user in candidates:
                name = (user.full_name or "").lower().strip()
                compact = name.replace(" ", "")
                first = name.split()[0] if name else ""
                email_local = (user.email or "").split("@")[0].lower() if user.email else ""
                for token in tokens:
                    if token == compact or token == first or (email_local and token == email_local):
                        user_ids.add(user.id)

        if not user_ids:
            return []

        users = db.query(User).filter(User.id.in_(list(user_ids))).all()
        return [{"user_id": str(u.id), "full_name": u.full_name} for u in users]

    @staticmethod
    def _refresh_reply_count(db: Session, thread: ProjectThread) -> None:
        count = (
            db.query(ProjectThreadMessage)
            .filter(
                ProjectThreadMessage.thread_id == thread.id,
                ProjectThreadMessage.deleted_at.is_(None),
            )
            .count()
        )
        thread.reply_count = count
        thread.updated_at = datetime.utcnow()

    @staticmethod
    def post_message(
        db: Session,
        project: Project,
        thread: ProjectThread,
        *,
        author: User,
        body: str,
        mentioned_user_ids: list[uuid.UUID] | None = None,
    ) -> ProjectThreadMessage:
        ProjectAccessService.ensure_project_is_mutable(project)
        text = (body or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Message body is required")
        if len(text) > 8000:
            raise HTTPException(status_code=400, detail="Message is too long")

        mentions = ProjectThreadService._resolve_mentions(
            db, project, body=text, mentioned_user_ids=mentioned_user_ids
        )
        message = ProjectThreadMessage(
            thread_id=thread.id,
            project_id=project.id,
            author_id=author.id,
            body=text,
            mentions_json=mentions or None,
        )
        db.add(message)
        db.flush()

        for mention in mentions:
            uid = uuid.UUID(mention["user_id"])
            if uid == author.id:
                continue
            db.add(
                ProjectThreadNotification(
                    user_id=uid,
                    project_id=project.id,
                    thread_id=thread.id,
                    message_id=message.id,
                    kind="mention",
                )
            )

        ProjectThreadService._refresh_reply_count(db, thread)
        if not thread.summary:
            thread.summary = text[:180]
        db.commit()
        db.refresh(message)
        return (
            db.query(ProjectThreadMessage)
            .options(joinedload(ProjectThreadMessage.author))
            .filter(ProjectThreadMessage.id == message.id)
            .first()
        )

    @staticmethod
    def _can_author_mutate(message: ProjectThreadMessage, user_id: uuid.UUID) -> bool:
        if message.author_id != user_id:
            return False
        if not message.created_at:
            return False
        return datetime.utcnow() - message.created_at <= AUTHOR_EDIT_WINDOW

    @staticmethod
    def _is_project_editor(db: Session, project: Project, user_id: uuid.UUID) -> bool:
        try:
            ProjectAccessService.ensure_can_edit_project(db, user_id, project.id)
            return True
        except HTTPException:
            return False

    @staticmethod
    def edit_message(
        db: Session,
        project: Project,
        message: ProjectThreadMessage,
        *,
        actor: User,
        body: str,
        mentioned_user_ids: list[uuid.UUID] | None = None,
    ) -> ProjectThreadMessage:
        ProjectAccessService.ensure_project_is_mutable(project)
        if message.deleted_at:
            raise HTTPException(status_code=400, detail="Cannot edit a deleted message")
        if not ProjectThreadService._can_author_mutate(message, actor.id):
            raise HTTPException(status_code=403, detail="Authors can edit messages within 24 hours only")

        text = (body or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Message body is required")
        if len(text) > 8000:
            raise HTTPException(status_code=400, detail="Message is too long")

        mentions = ProjectThreadService._resolve_mentions(
            db, project, body=text, mentioned_user_ids=mentioned_user_ids
        )
        message.body = text
        message.mentions_json = mentions or None
        message.edited_at = datetime.utcnow()
        db.commit()
        db.refresh(message)
        return (
            db.query(ProjectThreadMessage)
            .options(joinedload(ProjectThreadMessage.author))
            .filter(ProjectThreadMessage.id == message.id)
            .first()
        )

    @staticmethod
    def delete_message(
        db: Session,
        project: Project,
        message: ProjectThreadMessage,
        *,
        actor: User,
    ) -> ProjectThreadMessage:
        ProjectAccessService.ensure_project_is_mutable(project)
        if message.deleted_at:
            return message

        is_author_window = ProjectThreadService._can_author_mutate(message, actor.id)
        is_editor = ProjectThreadService._is_project_editor(db, project, actor.id)
        if not is_author_window and not is_editor:
            raise HTTPException(
                status_code=403,
                detail="Authors can delete within 24 hours; editors can delete anytime",
            )

        message.deleted_at = datetime.utcnow()
        message.deleted_by = actor.id
        thread = ProjectThreadService.get_thread_or_404(db, project.id, message.thread_id)
        ProjectThreadService._refresh_reply_count(db, thread)
        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def get_message_or_404(
        db: Session, project_id: uuid.UUID, message_id: uuid.UUID
    ) -> ProjectThreadMessage:
        message = (
            db.query(ProjectThreadMessage)
            .options(joinedload(ProjectThreadMessage.author))
            .filter(
                ProjectThreadMessage.project_id == project_id,
                ProjectThreadMessage.id == message_id,
            )
            .first()
        )
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        return message

    @staticmethod
    def list_notifications(
        db: Session, user_id: uuid.UUID, *, unread_only: bool = False, limit: int = 50
    ) -> list[ProjectThreadNotification]:
        q = db.query(ProjectThreadNotification).filter(ProjectThreadNotification.user_id == user_id)
        if unread_only:
            q = q.filter(ProjectThreadNotification.read_at.is_(None))
        return q.order_by(ProjectThreadNotification.created_at.desc()).limit(limit).all()

    @staticmethod
    def mark_notification_read(
        db: Session, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> ProjectThreadNotification:
        note = (
            db.query(ProjectThreadNotification)
            .filter(
                ProjectThreadNotification.id == notification_id,
                ProjectThreadNotification.user_id == user_id,
            )
            .first()
        )
        if not note:
            raise HTTPException(status_code=404, detail="Notification not found")
        if not note.read_at:
            note.read_at = datetime.utcnow()
            db.commit()
            db.refresh(note)
        return note

    # --- Legacy stubs (no free-form channel create in v1) ---

    @staticmethod
    def create_thread(
        db: Session,
        project: Project,
        *,
        title: str,
        summary: str | None,
        reply_count: int,
        created_by: uuid.UUID,
    ) -> ProjectThread:
        raise HTTPException(
            status_code=400,
            detail="Free-form threads are disabled. Channels are seeded as General plus one per project team.",
        )

    @staticmethod
    def update_thread(
        db: Session,
        project: Project,
        thread: ProjectThread,
        *,
        title: str | None = None,
        summary: str | None = None,
        reply_count: int | None = None,
    ) -> ProjectThread:
        ProjectAccessService.ensure_project_is_mutable(project)
        if thread.kind == "general":
            raise HTTPException(status_code=400, detail="General channel cannot be renamed")
        if title is not None and thread.kind != "team":
            thread.title = title.strip()
        if summary is not None:
            thread.summary = summary.strip() or None
        if reply_count is not None:
            thread.reply_count = reply_count
        db.commit()
        db.refresh(thread)
        return thread

    @staticmethod
    def delete_thread(db: Session, project: Project, thread: ProjectThread) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        if thread.kind in ("general", "team"):
            raise HTTPException(status_code=400, detail="System channels cannot be deleted")
        thread.archived_at = datetime.utcnow()
        db.commit()
