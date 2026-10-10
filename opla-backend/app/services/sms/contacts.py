"""Recipient list building: merge team members, CSV rows and typed numbers.

Pure functions so the API, the preview and the tests share one implementation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional

from app.services.sms.phone import normalize_phone

NAME_TOKEN = re.compile(r"\{\s*name\s*\}", re.IGNORECASE)


@dataclass
class ContactInput:
    phone: str
    name: Optional[str] = None
    source: str = "manual"  # team | csv | manual
    user_id: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None


@dataclass
class Recipient:
    phone: str
    name: Optional[str]
    sources: list[str] = field(default_factory=list)
    user_id: Optional[str] = None
    team_ids: list[str] = field(default_factory=list)
    team_names: list[str] = field(default_factory=list)


@dataclass
class Rejected:
    input: str
    name: Optional[str]
    source: str
    reason: str


@dataclass
class AudienceResult:
    recipients: list[Recipient] = field(default_factory=list)
    invalid: list[Rejected] = field(default_factory=list)
    unsupported: list[Rejected] = field(default_factory=list)
    opted_out: list[Rejected] = field(default_factory=list)
    duplicates_removed: int = 0


def _clean_name(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    text = " ".join(str(name).split())
    return text or None


def build_audience(
    contacts: Iterable[ContactInput],
    *,
    opted_out: set[str] | None = None,
    supports: Callable[[str], bool] | None = None,
) -> AudienceResult:
    """Normalise, deduplicate (first one wins, later ones fill a missing name) and filter."""
    opted_out = opted_out or set()
    result = AudienceResult()
    by_phone: dict[str, Recipient] = {}
    seen_rejected: set[str] = set()

    for contact in contacts:
        name = _clean_name(contact.name)
        parsed = normalize_phone(contact.phone)
        if not parsed.ok:
            result.invalid.append(Rejected(str(contact.phone or "").strip(), name, contact.source, parsed.reason or "Invalid"))
            continue
        phone = parsed.e164
        assert phone is not None

        existing = by_phone.get(phone)
        if existing is not None:
            result.duplicates_removed += 1
            if not existing.name and name:
                existing.name = name
            if contact.source not in existing.sources:
                existing.sources.append(contact.source)
            if contact.team_id and contact.team_id not in existing.team_ids:
                existing.team_ids.append(contact.team_id)
                if contact.team_name:
                    existing.team_names.append(contact.team_name)
            if contact.user_id and not existing.user_id:
                existing.user_id = contact.user_id
            continue

        if phone in seen_rejected:
            result.duplicates_removed += 1
            continue
        if phone in opted_out:
            seen_rejected.add(phone)
            result.opted_out.append(Rejected(phone, name, contact.source, "Opted out of SMS"))
            continue
        if supports is not None and not supports(phone):
            seen_rejected.add(phone)
            result.unsupported.append(
                Rejected(phone, name, contact.source, "The SMS provider cannot deliver to this country")
            )
            continue

        recipient = Recipient(
            phone=phone,
            name=name,
            sources=[contact.source],
            user_id=contact.user_id,
            team_ids=[contact.team_id] if contact.team_id else [],
            team_names=[contact.team_name] if contact.team_name else [],
        )
        by_phone[phone] = recipient
        result.recipients.append(recipient)

    return result


def has_name_token(message: str) -> bool:
    return bool(NAME_TOKEN.search(message or ""))


def first_name(name: Optional[str]) -> Optional[str]:
    cleaned = _clean_name(name)
    return cleaned.split(" ")[0] if cleaned else None


def render_message(template: str, name: Optional[str], fallback: str = "") -> str:
    """Replace ``{name}`` with the recipient's first name (or the fallback)."""
    if not has_name_token(template):
        return template
    value = first_name(name) or (fallback or "").strip()
    rendered = NAME_TOKEN.sub(value, template)
    if not value:
        # "Hi {name}, …" with no name → "Hi, …"
        rendered = re.sub(r"[ \t]+([,.!?])", r"\1", rendered)
        rendered = re.sub(r"[ \t]{2,}", " ", rendered)
    return rendered.strip()
