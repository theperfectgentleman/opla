"""Phone normalisation for SMS broadcasts.

Same decision as JoTurk (backend/services/phoneFormat.js):

* Ghana numbers in any common shape collapse to one E.164 value, ``+233XXXXXXXXX``:
  ``0244123456``, ``233244123456``, ``+233244123456``, ``+233 0244 123 456``,
  ``00233244123456``. A 9-digit number that lost its leading 0 in Excel
  (``244123456``) is treated as Ghana too.
* Other countries are accepted only with an explicit country code (``+44…`` or
  ``0044…``) and stored as E.164. A local number without a country code that is
  not Ghana is rejected so the user can fix it.
* mNotify is a Ghana route, so ``to_mnotify_recipient`` only accepts Ghana numbers
  and returns the ``0XXXXXXXXX`` form its quick SMS API documents.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

_SEPARATORS = re.compile(r"[\s\-\.\(\)/]")
_E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_GHANA_NATIONAL = re.compile(r"^[2-5]\d{8}$")


@dataclass(frozen=True)
class PhoneResult:
    ok: bool
    e164: Optional[str] = None
    reason: Optional[str] = None
    is_ghana: bool = False


def _ghana(national: str) -> PhoneResult:
    if not _GHANA_NATIONAL.match(national):
        return PhoneResult(False, reason="Not a valid Ghana number (expected 0XXXXXXXXX or +233XXXXXXXXX)")
    return PhoneResult(True, e164=f"+233{national}", is_ghana=True)


def normalize_phone(raw: object) -> PhoneResult:
    if raw is None:
        return PhoneResult(False, reason="Missing phone number")
    text = str(raw).strip()
    if not text:
        return PhoneResult(False, reason="Missing phone number")

    compact = _SEPARATORS.sub("", text)
    if compact.startswith("00"):
        compact = "+" + compact[2:]
    has_plus = compact.startswith("+")
    body = compact[1:] if has_plus else compact
    if not body.isdigit():
        return PhoneResult(False, reason="Phone number contains letters or symbols")

    digits = body
    if digits.startswith("233"):
        rest = digits[3:]
        if len(rest) == 10 and rest.startswith("0"):
            rest = rest[1:]  # "+233 0244 …" written with the trunk 0
        if len(rest) != 9:
            return PhoneResult(False, reason="Ghana numbers need 9 digits after 233")
        return _ghana(rest)

    if has_plus:
        e164 = f"+{digits}"
        if not _E164.match(e164):
            return PhoneResult(False, reason="Not a valid international number")
        return PhoneResult(True, e164=e164, is_ghana=False)

    if len(digits) == 10 and digits.startswith("0"):
        return _ghana(digits[1:])
    if len(digits) == 9:
        return _ghana(digits)
    if digits.startswith("0"):
        return PhoneResult(False, reason="Ghana numbers starting with 0 must have 10 digits")
    return PhoneResult(False, reason="Add a country code (for example +44…) for numbers outside Ghana")


def to_mnotify_recipient(e164: str) -> Optional[str]:
    """``+233244123456`` → ``0244123456``. Returns None for non-Ghana numbers."""
    if isinstance(e164, str) and re.match(r"^\+233[2-5]\d{8}$", e164):
        return "0" + e164[4:]
    return None
