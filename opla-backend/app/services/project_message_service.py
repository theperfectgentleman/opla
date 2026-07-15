from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.project import Project
from app.models.project_access import AccessorType, ProjectAccess
from app.models.project_message_channel import ProjectMessageChannel
from app.models.project_message import ProjectMessage, ProjectMessageNotification
from app.models.team import Team
from app.models.user import User
from app.services.project_access_service import ProjectAccessService

AUTHOR_EDIT_WINDOW = timedelta(hours=24)
MENTION_PATTERN = re.compile(r"@([\w][\w.\-]*)")


class ProjectMessageService:
    @staticmethod
    def list_channels(db: Session, project_id: uuid.UUID) -> list[ProjectMessageChannel]:
        ProjectMessageService.ensure_project_channels(db, project_id, commit=True)
        return (
            db.query(ProjectMessageChannel)
            .options(joinedload(ProjectMessageChannel.team))
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.archived_at.is_(None),
                ProjectMessageChannel.kind.in_(("general", "team")),
            )
            .order_by(
                ProjectMessageChannel.kind.asc(),
                ProjectMessageChannel.title.asc(),
            )
            .all()
        )

    @staticmethod
    def get_channel_or_404(db: Session, project_id: uuid.UUID, channel_id: uuid.UUID) -> ProjectMessageChannel:
        channel = (
            db.query(ProjectMessageChannel)
            .options(joinedload(ProjectMessageChannel.team))
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.id == channel_id,
                ProjectMessageChannel.archived_at.is_(None),
            )
            .first()
        )
        if not channel:
            raise HTTPException(status_code=404, detail="Message channel not found")
        return channel

    @staticmethod
    def get_general_channel(db: Session, project_id: uuid.UUID) -> ProjectMessageChannel:
        ProjectMessageService.ensure_project_channels(db, project_id, commit=True)
        channel = (
            db.query(ProjectMessageChannel)
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.kind == "general",
                ProjectMessageChannel.archived_at.is_(None),
            )
            .first()
        )
        if not channel:
            raise HTTPException(status_code=500, detail="General channel missing")
        return channel

    @staticmethod
    def ensure_project_channels(
        db: Session,
        project_id: uuid.UUID,
        *,
        created_by: uuid.UUID | None = None,
        commit: bool = True,
    ) -> list[ProjectMessageChannel]:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        general = (
            db.query(ProjectMessageChannel)
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.kind == "general",
                ProjectMessageChannel.archived_at.is_(None),
            )
            .first()
        )
        if not general:
            legacy = (
                db.query(ProjectMessageChannel)
                .filter(ProjectMessageChannel.project_id == project_id)
                .order_by(ProjectMessageChannel.updated_at.desc(), ProjectMessageChannel.created_at.desc())
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
                general = ProjectMessageChannel(
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
            for t in db.query(ProjectMessageChannel)
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.kind == "team",
                ProjectMessageChannel.archived_at.is_(None),
                ProjectMessageChannel.team_id.isnot(None),
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
                ProjectMessageChannel(
                    project_id=project_id,
                    title=team.name,
                    summary=f"Discussion for {team.name}",
                    reply_count=0,
                    kind="team",
                    team_id=team_id,
                    created_by=created_by,
                )
            )

        for team_id, channel in existing_team_channels.items():
            if team_id not in team_by_id:
                channel.archived_at = datetime.utcnow()

        leftovers = (
            db.query(ProjectMessageChannel)
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.archived_at.is_(None),
                ~ProjectMessageChannel.kind.in_(("general", "team")),
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
            db.query(ProjectMessageChannel)
            .filter(
                ProjectMessageChannel.project_id == project_id,
                ProjectMessageChannel.archived_at.is_(None),
                ProjectMessageChannel.kind.in_(("general", "team")),
            )
            .order_by(ProjectMessageChannel.kind.asc(), ProjectMessageChannel.title.asc())
            .all()
        )

    @staticmethod
    def list_messages(
        db: Session,
        project_id: uuid.UUID,
        channel_id: uuid.UUID,
        *,
        limit: int = 50,
        before: datetime | None = None,
    ) -> list[ProjectMessage]:
        ProjectMessageService.get_channel_or_404(db, project_id, channel_id)
        q = (
            db.query(ProjectMessage)
            .options(joinedload(ProjectMessage.author))
            .filter(
                ProjectMessage.project_id == project_id,
                ProjectMessage.channel_id == channel_id,
            )
        )
        if before:
            q = q.filter(ProjectMessage.created_at < before)
        return q.order_by(ProjectMessage.created_at.desc()).limit(limit).all()

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
    def _refresh_reply_count(db: Session, channel: ProjectMessageChannel) -> None:
        count = (
            db.query(ProjectMessage)
            .filter(
                ProjectMessage.channel_id == channel.id,
                ProjectMessage.deleted_at.is_(None),
            )
            .count()
        )
        channel.reply_count = count
        channel.updated_at = datetime.utcnow()

    @staticmethod
    def post_message(
        db: Session,
        project: Project,
        channel: ProjectMessageChannel,
        *,
        author: User,
        body: str,
        mentioned_user_ids: list[uuid.UUID] | None = None,
    ) -> ProjectMessage:
        ProjectAccessService.ensure_project_is_mutable(project)
        text = (body or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Message body is required")
        if len(text) > 8000:
            raise HTTPException(status_code=400, detail="Message is too long")

        mentions = ProjectMessageService._resolve_mentions(
            db, project, body=text, mentioned_user_ids=mentioned_user_ids
        )
        message = ProjectMessage(
            channel_id=channel.id,
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
                ProjectMessageNotification(
                    user_id=uid,
                    project_id=project.id,
                    channel_id=channel.id,
                    message_id=message.id,
                    kind="mention",
                )
            )

        ProjectMessageService._refresh_reply_count(db, channel)
        if not channel.summary:
            channel.summary = text[:180]
        db.commit()
        db.refresh(message)
        return (
            db.query(ProjectMessage)
            .options(joinedload(ProjectMessage.author))
            .filter(ProjectMessage.id == message.id)
            .first()
        )

    @staticmethod
    def _can_author_mutate(message: ProjectMessage, user_id: uuid.UUID) -> bool:
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
        message: ProjectMessage,
        *,
        actor: User,
        body: str,
        mentioned_user_ids: list[uuid.UUID] | None = None,
    ) -> ProjectMessage:
        ProjectAccessService.ensure_project_is_mutable(project)
        if message.deleted_at:
            raise HTTPException(status_code=400, detail="Cannot edit a deleted message")
        if not ProjectMessageService._can_author_mutate(message, actor.id):
            raise HTTPException(status_code=403, detail="Authors can edit messages within 24 hours only")

        text = (body or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Message body is required")
        if len(text) > 8000:
            raise HTTPException(status_code=400, detail="Message is too long")

        mentions = ProjectMessageService._resolve_mentions(
            db, project, body=text, mentioned_user_ids=mentioned_user_ids
        )
        message.body = text
        message.mentions_json = mentions or None
        message.edited_at = datetime.utcnow()
        db.commit()
        db.refresh(message)
        return (
            db.query(ProjectMessage)
            .options(joinedload(ProjectMessage.author))
            .filter(ProjectMessage.id == message.id)
            .first()
        )

    @staticmethod
    def delete_message(
        db: Session,
        project: Project,
        message: ProjectMessage,
        *,
        actor: User,
    ) -> ProjectMessage:
        ProjectAccessService.ensure_project_is_mutable(project)
        if message.deleted_at:
            return message

        is_author_window = ProjectMessageService._can_author_mutate(message, actor.id)
        is_editor = ProjectMessageService._is_project_editor(db, project, actor.id)
        if not is_author_window and not is_editor:
            raise HTTPException(
                status_code=403,
                detail="Authors can delete within 24 hours; editors can delete anytime",
            )

        message.deleted_at = datetime.utcnow()
        message.deleted_by = actor.id
        channel = ProjectMessageService.get_channel_or_404(db, project.id, message.channel_id)
        ProjectMessageService._refresh_reply_count(db, channel)
        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def get_message_or_404(
        db: Session, project_id: uuid.UUID, message_id: uuid.UUID
    ) -> ProjectMessage:
        message = (
            db.query(ProjectMessage)
            .options(joinedload(ProjectMessage.author))
            .filter(
                ProjectMessage.project_id == project_id,
                ProjectMessage.id == message_id,
            )
            .first()
        )
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        return message

    @staticmethod
    def list_notifications(
        db: Session, user_id: uuid.UUID, *, unread_only: bool = False, limit: int = 50
    ) -> list[ProjectMessageNotification]:
        q = db.query(ProjectMessageNotification).filter(ProjectMessageNotification.user_id == user_id)
        if unread_only:
            q = q.filter(ProjectMessageNotification.read_at.is_(None))
        return q.order_by(ProjectMessageNotification.created_at.desc()).limit(limit).all()

    @staticmethod
    def mark_notification_read(
        db: Session, user_id: uuid.UUID, notification_id: uuid.UUID
    ) -> ProjectMessageNotification:
        note = (
            db.query(ProjectMessageNotification)
            .filter(
                ProjectMessageNotification.id == notification_id,
                ProjectMessageNotification.user_id == user_id,
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

    @staticmethod
    def create_channel(
        db: Session,
        project: Project,
        *,
        title: str,
        summary: str | None,
        reply_count: int,
        created_by: uuid.UUID,
    ) -> ProjectMessageChannel:
        raise HTTPException(
            status_code=400,
            detail="Free-form message channels are disabled. Channels are seeded as General plus one per project team.",
        )

    @staticmethod
    def update_channel(
        db: Session,
        project: Project,
        channel: ProjectMessageChannel,
        *,
        title: str | None = None,
        summary: str | None = None,
        reply_count: int | None = None,
    ) -> ProjectMessageChannel:
        ProjectAccessService.ensure_project_is_mutable(project)
        if channel.kind == "general":
            raise HTTPException(status_code=400, detail="General channel cannot be renamed")
        if title is not None and channel.kind != "team":
            channel.title = title.strip()
        if summary is not None:
            channel.summary = summary.strip() or None
        if reply_count is not None:
            channel.reply_count = reply_count
        db.commit()
        db.refresh(channel)
        return channel

    @staticmethod
    def delete_channel(db: Session, project: Project, channel: ProjectMessageChannel) -> None:
        ProjectAccessService.ensure_project_is_mutable(project)
        if channel.kind in ("general", "team"):
            raise HTTPException(status_code=400, detail="System channels cannot be deleted")
        channel.archived_at = datetime.utcnow()
        db.commit()
