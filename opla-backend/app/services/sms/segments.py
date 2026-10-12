"""SMS length and segment (part) counting.

GSM-7 messages fit 160 characters in one part; longer ones are split into
153-character parts (7 characters per part go to the concatenation header).
Any character outside GSM-7 (emoji, curly quotes, most non-Latin scripts) makes
the whole message UCS-2: 70 characters in one part, 67 per part after that.
Characters in the GSM extension table (``^{}\\[~]|€``) cost two.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

GSM7_BASIC = set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?"
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
)
GSM7_EXTENDED = set("^{}\\[~]|€\f")


@dataclass(frozen=True)
class SegmentInfo:
    encoding: str  # "gsm7" | "unicode"
    length: int  # characters as counted by the network (extension chars count 2)
    parts: int
    per_part: int  # capacity of each part at this length
    remaining: int  # characters left in the current part


def count_segments(text: str) -> SegmentInfo:
    text = text or ""
    if all(ch in GSM7_BASIC or ch in GSM7_EXTENDED for ch in text):
        length = sum(2 if ch in GSM7_EXTENDED else 1 for ch in text)
        single, multi, encoding = 160, 153, "gsm7"
    else:
        # UCS-2 counts UTF-16 code units, so an emoji takes two.
        length = len(text.encode("utf-16-le")) // 2
        single, multi, encoding = 70, 67, "unicode"

    if length == 0:
        return SegmentInfo(encoding, 0, 0, single, single)
    if length <= single:
        return SegmentInfo(encoding, length, 1, single, single - length)
    parts = math.ceil(length / multi)
    return SegmentInfo(encoding, length, parts, multi, parts * multi - length)
