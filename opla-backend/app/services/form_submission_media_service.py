from __future__ import annotations

import json
import re
import uuid
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.form_submission_media import FormSubmissionMedia
from app.models.submission import Submission

MEDIA_FIELD_TYPES = {
    "photo_capture",
    "file_upload",
    "audio_recorder",
    "signature_pad",
    "image",
    "photo",
    "video",
    "video_capture",
    "audio",
    "signature",
}

VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".aac", ".ogg", ".webm"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp"}


class FormSubmissionMediaService:
    @staticmethod
    def _normalize_type(value: Any) -> str:
        return re.sub(r"[\s-]+", "_", str(value or "").strip().lower())

    @staticmethod
    def _walk_media_fields(nodes: Any, out: list[dict[str, str]]) -> None:
        if not isinstance(nodes, list):
            return
        for node in nodes:
            if not isinstance(node, dict):
                continue
            field_type = FormSubmissionMediaService._normalize_type(node.get("type"))
            bind = node.get("bind") or node.get("id")
            if field_type in MEDIA_FIELD_TYPES and bind:
                out.append(
                    {
                        "bind": str(bind),
                        "type": field_type,
                        "label": str(node.get("label") or node.get("title") or bind),
                    }
                )
            children = node.get("children") or node.get("fields") or node.get("items")
            FormSubmissionMediaService._walk_media_fields(children, out)
            ui = node.get("ui")
            if isinstance(ui, list):
                FormSubmissionMediaService._walk_media_fields(ui, out)

    @staticmethod
    def media_fields_from_blueprint(blueprint: Any) -> list[dict[str, str]]:
        fields: list[dict[str, str]] = []
        if not isinstance(blueprint, dict):
            return fields
        ui = blueprint.get("ui")
        if isinstance(ui, list):
            FormSubmissionMediaService._walk_media_fields(ui, fields)
        elif isinstance(ui, dict):
            FormSubmissionMediaService._walk_media_fields(ui.get("children") or ui.get("sections"), fields)
        # de-dupe by bind (last wins)
        by_bind: dict[str, dict[str, str]] = {}
        for field in fields:
            by_bind[field["bind"]] = field
        return list(by_bind.values())

    @staticmethod
    def _extension(path: str | None) -> str:
        if not path:
            return ""
        clean = path.split("?", 1)[0].split("#", 1)[0]
        name = clean.rsplit("/", 1)[-1]
        if "." not in name:
            return ""
        return f".{name.rsplit('.', 1)[-1].lower()}"

    @staticmethod
    def _guess_kind(field_type: str, url: str | None, filename: str | None, mime_type: str | None) -> str:
        if field_type in {"signature_pad", "signature"}:
            return "signature"
        if field_type in {"audio_recorder", "audio"}:
            return "audio"
        if field_type in {"photo_capture", "image", "photo"}:
            return "image"
        if field_type in {"video", "video_capture"}:
            return "video"

        mime = (mime_type or "").lower()
        if mime.startswith("image/"):
            return "image"
        if mime.startswith("audio/"):
            return "audio"
        if mime.startswith("video/"):
            return "video"

        ext = FormSubmissionMediaService._extension(filename or url)
        if ext in IMAGE_EXTENSIONS:
            return "image"
        if ext in AUDIO_EXTENSIONS:
            return "audio"
        if ext in VIDEO_EXTENSIONS:
            return "video"
        return "file"

    @staticmethod
    def _normalize_value(raw: Any) -> dict[str, Any] | None:
        if raw is None:
            return None
        if isinstance(raw, str):
            text = raw.strip()
            if not text or text in {"signed", "null", "undefined"}:
                if text == "signed":
                    return {"url": None, "filename": None, "payload": {"signed": True}}
                return None
            # signature stroke JSON
            if text.startswith("[") or text.startswith("{"):
                try:
                    parsed = json.loads(text)
                    return FormSubmissionMediaService._normalize_value(parsed)
                except Exception:
                    pass
            # bare filename without scheme — still index as opaque
            return {"url": text, "filename": text.rsplit("/", 1)[-1], "payload": text}

        if isinstance(raw, dict):
            if raw.get("simulated") and not raw.get("uri") and not raw.get("url") and not raw.get("src"):
                return {"url": raw.get("uri"), "filename": None, "payload": raw, "mime_type": raw.get("mime_type"), "byte_size": raw.get("size")}
            url = raw.get("uri") or raw.get("url") or raw.get("src") or raw.get("href")
            filename = raw.get("name") or raw.get("filename")
            if isinstance(url, str):
                url = url.strip() or None
            if not url and not raw.get("signed") and "M " not in str(raw):
                # empty object
                if not filename:
                    return {"url": None, "filename": None, "payload": raw}
            return {
                "url": url,
                "filename": filename,
                "mime_type": raw.get("mime_type") or raw.get("type"),
                "byte_size": raw.get("size") or raw.get("byte_size"),
                "payload": raw,
            }

        if isinstance(raw, list):
            # signature strokes
            return {"url": None, "filename": None, "payload": raw}

        return None

    @staticmethod
    def extract_items_for_submission(
        *,
        form: Form,
        submission: Submission,
    ) -> list[dict[str, Any]]:
        fields = FormSubmissionMediaService.media_fields_from_blueprint(form.blueprint_live)
        data = submission.data if isinstance(submission.data, dict) else {}
        items: list[dict[str, Any]] = []
        for field in fields:
            bind = field["bind"]
            if bind not in data:
                continue
            normalized = FormSubmissionMediaService._normalize_value(data.get(bind))
            if not normalized:
                continue
            url = normalized.get("url")
            filename = normalized.get("filename")
            mime_type = normalized.get("mime_type")
            # Skip empty non-signature values with no url/payload signal
            if field["type"] not in {"signature_pad", "signature"} and not url and not filename:
                continue
            kind = FormSubmissionMediaService._guess_kind(field["type"], url, filename, mime_type)
            items.append(
                {
                    "field_bind": bind,
                    "field_label": field["label"],
                    "field_type": field["type"],
                    "media_kind": kind,
                    "url": url,
                    "filename": filename,
                    "mime_type": mime_type,
                    "byte_size": normalized.get("byte_size"),
                    "payload": normalized.get("payload"),
                }
            )
        return items

    @staticmethod
    def index_submission(db: Session, form: Form, submission: Submission, *, commit: bool = True) -> list[FormSubmissionMedia]:
        project_id = form.project_id
        if not project_id:
            return []

        extracted = FormSubmissionMediaService.extract_items_for_submission(form=form, submission=submission)
        existing = {
            row.field_bind: row
            for row in db.query(FormSubmissionMedia)
            .filter(FormSubmissionMedia.submission_id == submission.id)
            .all()
        }
        kept_binds = set()
        result: list[FormSubmissionMedia] = []
        for item in extracted:
            kept_binds.add(item["field_bind"])
            row = existing.get(item["field_bind"])
            if row is None:
                row = FormSubmissionMedia(
                    submission_id=submission.id,
                    form_id=form.id,
                    project_id=project_id,
                    field_bind=item["field_bind"],
                    field_label=item["field_label"],
                    field_type=item["field_type"],
                    media_kind=item["media_kind"],
                    url=item["url"],
                    filename=item["filename"],
                    mime_type=item["mime_type"],
                    byte_size=item["byte_size"],
                    payload=item["payload"],
                    created_at=submission.created_at,
                )
                db.add(row)
            else:
                row.field_label = item["field_label"]
                row.field_type = item["field_type"]
                row.media_kind = item["media_kind"]
                row.url = item["url"]
                row.filename = item["filename"]
                row.mime_type = item["mime_type"]
                row.byte_size = item["byte_size"]
                row.payload = item["payload"]
            result.append(row)

        for bind, row in existing.items():
            if bind not in kept_binds:
                db.delete(row)

        if commit:
            db.commit()
            for row in result:
                db.refresh(row)
        else:
            db.flush()
        return result

    @staticmethod
    def ensure_form_indexed(db: Session, form: Form, *, limit: int = 500) -> None:
        submissions = (
            db.query(Submission)
            .filter(Submission.form_id == form.id)
            .order_by(Submission.created_at.desc())
            .limit(limit)
            .all()
        )
        if not submissions:
            return
        indexed_ids = {
            row[0]
            for row in db.query(FormSubmissionMedia.submission_id)
            .filter(FormSubmissionMedia.form_id == form.id)
            .distinct()
            .all()
        }
        # Also treat submissions that were scanned and had zero media as "done"
        # by checking a sentinel — for v1, re-scan any not in indexed_ids once.
        changed = False
        for submission in submissions:
            if submission.id in indexed_ids:
                continue
            items = FormSubmissionMediaService.extract_items_for_submission(form=form, submission=submission)
            if not items:
                # mark as scanned by inserting nothing — leave unindexed; avoid loops by
                # only scanning submissions newer than last media or always skip empty.
                continue
            FormSubmissionMediaService.index_submission(db, form, submission, commit=False)
            changed = True
        if changed:
            db.commit()

    @staticmethod
    def list_form_media(
        db: Session,
        form: Form,
        *,
        limit: int = 100,
        media_kind: str | None = None,
        ensure_index: bool = True,
    ) -> list[FormSubmissionMedia]:
        if ensure_index:
            FormSubmissionMediaService.ensure_form_indexed(db, form)
        query = db.query(FormSubmissionMedia).filter(FormSubmissionMedia.form_id == form.id)
        if media_kind:
            query = query.filter(FormSubmissionMedia.media_kind == media_kind)
        return query.order_by(FormSubmissionMedia.created_at.desc()).limit(limit).all()

    @staticmethod
    def list_project_media(
        db: Session,
        project_id: uuid.UUID,
        *,
        limit: int = 24,
        media_kind: str | None = None,
        ensure_index: bool = True,
    ) -> list[FormSubmissionMedia]:
        if ensure_index:
            forms = db.query(Form).filter(Form.project_id == project_id).all()
            for form in forms:
                FormSubmissionMediaService.ensure_form_indexed(db, form, limit=200)
        query = db.query(FormSubmissionMedia).filter(FormSubmissionMedia.project_id == project_id)
        if media_kind:
            query = query.filter(FormSubmissionMedia.media_kind == media_kind)
        return query.order_by(FormSubmissionMedia.created_at.desc()).limit(limit).all()

    @staticmethod
    def is_previewable_url(url: str | None) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        return parsed.scheme in {"http", "https", "data", "blob"}
