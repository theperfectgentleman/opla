"""SMS providers for project broadcasts.

``SMS_PROVIDER`` picks one, like JoTurk:

* unset / ``none`` → ``DisabledSmsProvider``: Broadcasts shows "SMS is off" and nothing is sent.
* ``mnotify`` → ``MnotifySmsProvider`` (BMS Africa quick SMS, Ghana numbers only).
  Needs ``MNOTIFY_API_KEY`` and an approved ``MNOTIFY_SENDER_ID`` (max 11 characters).
* ``fake`` → ``FakeSmsProvider``: accepts every send without network access. For local
  development and tests only; it is refused when ``ENVIRONMENT=production``.

The mNotify key travels as a query parameter and is redacted from every error and log.
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Optional, Protocol

import httpx

from app.core.config import settings
from app.services.sms.phone import to_mnotify_recipient

logger = logging.getLogger(__name__)
# httpx logs full request URLs at INFO, and mNotify takes the API key as a query parameter.
logging.getLogger("httpx").setLevel(logging.WARNING)

MNOTIFY_DEFAULT_BASE_URL = "https://api.mnotify.com/api"
SENDER_ID_MAX = 11


@dataclass
class SendResult:
    success: bool
    provider_ref: Optional[str] = None
    error: Optional[str] = None
    credits_used: Optional[float] = None
    # Phones (E.164) the provider said it rejected while accepting the rest.
    rejected: set[str] = field(default_factory=set)


@dataclass
class BalanceResult:
    success: bool
    balance: Optional[float] = None
    bonus: Optional[float] = None
    error: Optional[str] = None


class SmsProvider(Protocol):
    name: str
    sender_id: str

    def is_configured(self) -> bool: ...
    def config_issue(self) -> Optional[str]: ...
    def supports(self, e164: str) -> bool: ...
    def send(self, phones: list[str], message: str) -> SendResult: ...
    def get_balance(self) -> BalanceResult: ...


def redact(text: object, secrets: list[str]) -> str:
    value = "" if text is None else str(text)
    value = re.sub(r"([?&]key=)[^&\s\"']+", r"\1[redacted]", value, flags=re.IGNORECASE)
    for secret in secrets:
        if secret and len(secret) >= 4:
            value = value.replace(secret, "[redacted]")
    return value


class DisabledSmsProvider:
    name = "none"
    sender_id = ""

    def __init__(self, issue: str = "SMS is not enabled on this server (set SMS_PROVIDER=mnotify)."):
        self._issue = issue

    def is_configured(self) -> bool:
        return False

    def config_issue(self) -> Optional[str]:
        return self._issue

    def supports(self, e164: str) -> bool:
        return True

    def send(self, phones: list[str], message: str) -> SendResult:
        return SendResult(False, error=self._issue)

    def get_balance(self) -> BalanceResult:
        return BalanceResult(False, error=self._issue)


class FakeSmsProvider:
    """Accepts every message. Records sends in memory so tests can assert on them."""

    name = "fake"

    def __init__(self, sender_id: str = "Opla", fail_phones: set[str] | None = None, balance: float = 1000):
        self.sender_id = sender_id
        self.fail_phones = set(fail_phones or set())
        self.balance = balance
        self.sent: list[tuple[list[str], str]] = []

    def is_configured(self) -> bool:
        return True

    def config_issue(self) -> Optional[str]:
        return None

    def supports(self, e164: str) -> bool:
        return True

    def send(self, phones: list[str], message: str) -> SendResult:
        failing = [p for p in phones if p in self.fail_phones]
        if failing and len(failing) == len(phones):
            return SendResult(False, error="Fake provider rejected this batch")
        accepted = [p for p in phones if p not in self.fail_phones]
        self.sent.append((accepted, message))
        self.balance -= len(accepted)
        return SendResult(
            True,
            provider_ref=f"fake-{uuid.uuid4().hex[:12]}",
            credits_used=float(len(accepted)),
            rejected=set(failing),
        )

    def get_balance(self) -> BalanceResult:
        return BalanceResult(True, balance=self.balance, bonus=0)


class MnotifySmsProvider:
    """BMS Africa mNotify quick SMS (``POST /sms/quick``), ported from JoTurk's MnotifySmsService."""

    name = "mnotify"

    def __init__(
        self,
        api_key: str,
        sender_id: str,
        base_url: str = MNOTIFY_DEFAULT_BASE_URL,
        client: httpx.Client | None = None,
        timeout: float = 20.0,
    ):
        self.api_key = (api_key or "").strip()
        self.sender_id = (sender_id or "").strip()
        self.base_url = (base_url or MNOTIFY_DEFAULT_BASE_URL).strip().rstrip("/") or MNOTIFY_DEFAULT_BASE_URL
        self.client = client
        self.timeout = timeout

    # -- config -------------------------------------------------------------
    def config_issue(self) -> Optional[str]:
        if not self.api_key:
            return "MNOTIFY_API_KEY is not set."
        if not self.sender_id:
            return "MNOTIFY_SENDER_ID is not set. Register a sender ID with mNotify first."
        if len(self.sender_id) > SENDER_ID_MAX:
            return f"MNOTIFY_SENDER_ID must be at most {SENDER_ID_MAX} characters."
        return None

    def is_configured(self) -> bool:
        return self.config_issue() is None

    def supports(self, e164: str) -> bool:
        return to_mnotify_recipient(e164) is not None

    # -- http ---------------------------------------------------------------
    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        params = dict(kwargs.pop("params", {}) or {})
        params["key"] = self.api_key
        url = f"{self.base_url}{path}"
        if self.client is not None:
            return self.client.request(method, url, params=params, timeout=self.timeout, **kwargs)
        with httpx.Client() as client:
            return client.request(method, url, params=params, timeout=self.timeout, **kwargs)

    def _safe(self, value: object) -> str:
        return redact(value, [self.api_key])

    def send(self, phones: list[str], message: str) -> SendResult:
        issue = self.config_issue()
        if issue:
            return SendResult(False, error=issue)

        local_by_e164 = {p: to_mnotify_recipient(p) for p in phones}
        unsupported = {p for p, local in local_by_e164.items() if local is None}
        recipients = [local for local in local_by_e164.values() if local]
        if not recipients:
            return SendResult(False, error="mNotify only delivers to Ghana numbers")

        body = {"recipient": recipients, "sender": self.sender_id, "message": message}
        try:
            response = self._request("POST", "/sms/quick", json=body)
        except httpx.HTTPError as exc:
            error = self._safe(exc) or "mNotify request failed"
            logger.error("mNotify SMS send failed: %s", error)
            return SendResult(False, error=error)

        try:
            data = response.json()
        except ValueError:
            data = {}
        status = str(data.get("status") or "").lower()
        summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
        campaign_id = summary.get("_id")

        if response.status_code < 400 and status == "success" and campaign_id:
            rejected = set(unsupported)
            numbers_sent = summary.get("numbers_sent")
            if isinstance(numbers_sent, list) and numbers_sent:
                sent_digits = {re.sub(r"\D", "", str(n))[-9:] for n in numbers_sent}
                for e164, local in local_by_e164.items():
                    if local and local[-9:] not in sent_digits:
                        rejected.add(e164)
            credits = summary.get("credit_used")
            return SendResult(
                True,
                provider_ref=str(campaign_id),
                credits_used=float(credits) if isinstance(credits, (int, float)) else None,
                rejected=rejected,
            )

        message_text = data.get("message") or f"mNotify did not accept the message (HTTP {response.status_code})"
        code = data.get("code")
        error = self._safe(f"{message_text}{f' (code {code})' if code else ''}")
        logger.error("mNotify SMS rejected: %s", error)
        return SendResult(False, error=error)

    def get_balance(self) -> BalanceResult:
        if not self.api_key:
            return BalanceResult(False, error="MNOTIFY_API_KEY is not set.")
        try:
            response = self._request("GET", "/balance/sms")
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            error = self._safe(exc) or "mNotify balance request failed"
            logger.error("mNotify balance failed: %s", error)
            return BalanceResult(False, error=error)
        if str(data.get("status") or "").lower() != "success":
            return BalanceResult(False, error=self._safe(data.get("message") or "mNotify balance request failed"))

        def _num(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        return BalanceResult(True, balance=_num(data.get("balance")), bonus=_num(data.get("bonus")))


_override: SmsProvider | None = None


def set_sms_provider_override(provider: SmsProvider | None) -> None:
    """Tests inject a provider here; ``None`` restores env-based selection."""
    global _override
    _override = provider


def get_sms_provider() -> SmsProvider:
    if _override is not None:
        return _override

    name = (settings.SMS_PROVIDER or "").strip().lower()
    if name in ("", "none", "off", "disabled"):
        return DisabledSmsProvider()
    if name == "mnotify":
        return MnotifySmsProvider(
            api_key=settings.MNOTIFY_API_KEY,
            sender_id=settings.MNOTIFY_SENDER_ID,
            base_url=settings.MNOTIFY_BASE_URL,
        )
    if name == "fake":
        if settings.ENVIRONMENT.lower() == "production":
            return DisabledSmsProvider("SMS_PROVIDER=fake is not allowed in production.")
        return FakeSmsProvider(sender_id=settings.MNOTIFY_SENDER_ID or "Opla")
    return DisabledSmsProvider(f"Unknown SMS_PROVIDER '{name}'. Use mnotify.")
