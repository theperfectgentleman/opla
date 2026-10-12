"""Unit tests for SMS broadcast helpers: phone normalisation, segments, audience, mNotify adapter.

No database or network. Run: python -m pytest test_sms_broadcast_utils.py
"""

import json
import unittest

import httpx

from app.services.sms.contacts import ContactInput, build_audience, render_message
from app.services.sms.phone import normalize_phone, to_mnotify_recipient
from app.services.sms.providers import MnotifySmsProvider, redact
from app.services.sms.segments import count_segments


class PhoneNormalisationTests(unittest.TestCase):
    def test_ghana_shapes_collapse_to_one_e164(self):
        for raw in [
            "0244847831",
            "233244847831",
            "+233244847831",
            "+233 24 484 7831",
            "024-484-7831",
            "(024) 484 7831",
            "00233244847831",
            "+233 0244847831",
            "244847831",  # Excel dropped the leading zero
        ]:
            with self.subTest(raw=raw):
                result = normalize_phone(raw)
                self.assertTrue(result.ok, result.reason)
                self.assertEqual(result.e164, "+233244847831")
                self.assertTrue(result.is_ghana)

    def test_international_needs_country_code(self):
        uk = normalize_phone("+44 7700 900123")
        self.assertTrue(uk.ok)
        self.assertEqual(uk.e164, "+447700900123")
        self.assertFalse(uk.is_ghana)
        self.assertEqual(normalize_phone("0044 7700 900123").e164, "+447700900123")
        self.assertEqual(normalize_phone("+1 (415) 555-0100").e164, "+14155550100")

        local_foreign = normalize_phone("7700900123")
        self.assertFalse(local_foreign.ok)
        self.assertIn("country code", local_foreign.reason)

    def test_invalid_numbers_have_reasons(self):
        for raw in ["", None, "   ", "abc", "024484783", "02448478312", "23324484783", "+12", "1.2E+11", "0144847831"]:
            with self.subTest(raw=raw):
                result = normalize_phone(raw)
                self.assertFalse(result.ok)
                self.assertTrue(result.reason)

    def test_mnotify_recipient_is_local_ghana_form(self):
        self.assertEqual(to_mnotify_recipient("+233244847831"), "0244847831")
        self.assertIsNone(to_mnotify_recipient("+447700900123"))


class SegmentCounterTests(unittest.TestCase):
    def test_gsm_boundaries(self):
        self.assertEqual(count_segments("").parts, 0)
        self.assertEqual(count_segments("a").parts, 1)
        one = count_segments("a" * 160)
        self.assertEqual((one.encoding, one.parts, one.remaining), ("gsm7", 1, 0))
        self.assertEqual(count_segments("a" * 161).parts, 2)
        self.assertEqual(count_segments("a" * 306).parts, 2)
        self.assertEqual(count_segments("a" * 307).parts, 3)

    def test_extension_characters_count_double(self):
        info = count_segments("€" * 80)
        self.assertEqual(info.encoding, "gsm7")
        self.assertEqual(info.length, 160)
        self.assertEqual(info.parts, 1)
        self.assertEqual(count_segments("€" * 81).parts, 2)

    def test_unicode_boundaries(self):
        self.assertEqual(count_segments("ɛ" * 70).encoding, "unicode")
        self.assertEqual(count_segments("ɛ" * 70).parts, 1)
        self.assertEqual(count_segments("ɛ" * 71).parts, 2)
        self.assertEqual(count_segments("ɛ" * 134).parts, 2)
        self.assertEqual(count_segments("ɛ" * 135).parts, 3)
        # one emoji makes the whole message unicode and costs two units
        emoji = count_segments("Hello 👋")
        self.assertEqual((emoji.encoding, emoji.length), ("unicode", 8))
        # curly quotes are not GSM-7
        self.assertEqual(count_segments("It’s").encoding, "unicode")


class AudienceTests(unittest.TestCase):
    def test_dedupes_across_sources_and_reports_rejections(self):
        contacts = [
            ContactInput("0244000001", "Ama Mensah", "team", user_id="u1", team_id="t1", team_name="North"),
            ContactInput("+233244000001", "Ama M.", "team", user_id="u1", team_id="t2", team_name="South"),
            ContactInput("233244000002", None, "csv"),
            ContactInput("0244000002", "Kofi", "manual"),
            ContactInput("not a number", "Bad", "csv"),
            ContactInput("0244000003", "Quit", "csv"),
            ContactInput("+447700900123", "London", "manual"),
        ]
        result = build_audience(
            contacts,
            opted_out={"+233244000003"},
            supports=lambda phone: phone.startswith("+233"),
        )
        self.assertEqual([r.phone for r in result.recipients], ["+233244000001", "+233244000002"])
        first, second = result.recipients
        self.assertEqual(first.name, "Ama Mensah")
        self.assertEqual(first.team_names, ["North", "South"])
        self.assertEqual(second.name, "Kofi")  # later row fills a missing name
        self.assertEqual(second.sources, ["csv", "manual"])
        self.assertEqual(result.duplicates_removed, 2)
        self.assertEqual([r.input for r in result.invalid], ["not a number"])
        self.assertEqual([r.input for r in result.opted_out], ["+233244000003"])
        self.assertEqual([r.input for r in result.unsupported], ["+447700900123"])

    def test_render_name(self):
        self.assertEqual(render_message("Hi {name}, site closed", "Ama Mensah"), "Hi Ama, site closed")
        self.assertEqual(render_message("Hi { NAME }!", "kofi"), "Hi kofi!")
        self.assertEqual(render_message("Hi {name}, site closed", None), "Hi, site closed")
        self.assertEqual(render_message("Hi {name}, site closed", None, "team"), "Hi team, site closed")
        self.assertEqual(render_message("No token here", "Ama"), "No token here")


class MnotifyProviderTests(unittest.TestCase):
    KEY = "secret-test-key-123"

    def _provider(self, handler, sender="Opla"):
        client = httpx.Client(transport=httpx.MockTransport(handler))
        return MnotifySmsProvider(api_key=self.KEY, sender_id=sender, client=client)

    def test_quick_sms_request_shape_and_success(self):
        seen = {}

        def handler(request: httpx.Request):
            seen["url"] = str(request.url)
            seen["body"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "status": "success",
                    "code": "2000",
                    "message": "messages sent successfully",
                    "summary": {"_id": "camp-1", "credit_used": 2, "numbers_sent": ["0244000001"]},
                },
            )

        provider = self._provider(handler)
        result = provider.send(["+233244000001", "+233244000002"], "Hello")
        self.assertTrue(result.success)
        self.assertEqual(result.provider_ref, "camp-1")
        self.assertEqual(result.credits_used, 2.0)
        self.assertEqual(result.rejected, {"+233244000002"})
        self.assertIn("/sms/quick", seen["url"])
        self.assertEqual(seen["body"], {"recipient": ["0244000001", "0244000002"], "sender": "Opla", "message": "Hello"})

    def test_rejection_and_errors_never_leak_the_key(self):
        def handler(request: httpx.Request):
            return httpx.Response(400, json={"status": "error", "code": "1005", "message": f"bad key {self.KEY}"})

        result = self._provider(handler).send(["+233244000001"], "Hello")
        self.assertFalse(result.success)
        self.assertNotIn(self.KEY, result.error)
        self.assertIn("1005", result.error)

        def boom(request: httpx.Request):
            raise httpx.ConnectError(f"failed for {request.url}")

        result = self._provider(boom).send(["+233244000001"], "Hello")
        self.assertFalse(result.success)
        self.assertNotIn(self.KEY, result.error)
        self.assertEqual(redact("x?key=abc&y=1", []), "x?key=[redacted]&y=1")

    def test_config_and_balance(self):
        self.assertFalse(MnotifySmsProvider(api_key="", sender_id="Opla").is_configured())
        self.assertFalse(MnotifySmsProvider(api_key="k" * 10, sender_id="").is_configured())
        self.assertFalse(MnotifySmsProvider(api_key="k" * 10, sender_id="TwelveChars!").is_configured())

        def handler(request: httpx.Request):
            self.assertIn("/balance/sms", str(request.url))
            return httpx.Response(200, json={"status": "success", "balance": 291, "bonus": 0})

        balance = self._provider(handler).get_balance()
        self.assertTrue(balance.success)
        self.assertEqual(balance.balance, 291.0)

    def test_non_ghana_only_batch_is_not_sent(self):
        def handler(request):  # pragma: no cover - must not be called
            raise AssertionError("should not call mNotify")

        result = self._provider(handler).send(["+447700900123"], "Hi")
        self.assertFalse(result.success)


if __name__ == "__main__":
    unittest.main()
