"""AI-assisted survey interview / draft / revise (markdown only)."""

from __future__ import annotations

import re
import time
from typing import Any, Dict, List, Optional, Tuple

from app.services.groq_client import GroqClientError, chat_completion, chat_completion_json
from app.services.survey_markdown_compiler import (
    CompileResult,
    SurveyMarkdownCompileError,
    compile_survey_markdown,
)

# Single-shot is reliable around this size; above it we outline + draft per section.
SINGLE_SHOT_QUESTION_LIMIT = 12
MAX_QUESTIONS = 60
DEFAULT_QUESTIONS = 10

DIALECT_RULES = """
Rules:
- Every survey starts with a single `# Title` (full documents only).
- Every section uses `## snake_case_id: Human Title`.
- Every question uses `### snake_case_bind. Question text`.
- Choice types (radio, dropdown, checkbox) MUST include options.
- Use `-> section_id` on options only for simple skip branching.
- Prefer short option lists (2–5 options).
- Do NOT invent matrix, ranking, file upload, GPS, or free-form prose questionnaires.
- Do NOT wrap the markdown in code fences.
- Output markdown only — no JSON, no commentary before or after.
""".strip()

DIALECT_SPEC = f"""
You MUST output questionnaires ONLY in this exact markdown dialect:

# Survey Title

## section_id: Section Title
Goal: optional short description

### bind_key. Question label?
- type: radio | dropdown | checkbox | text | textarea | number | rating | date | yes_no | email | phone
- required: true|false
- options:
  - Label | value | -> other_section_id
- min: 1
- max: 5
- min_label: Poor
- max_label: Excellent
- maxLength: 500

{DIALECT_RULES}
""".strip()

SECTION_DIALECT_SPEC = f"""
You MUST output ONE survey section in this exact markdown dialect (no document title):

## section_id: Section Title
Goal: optional short description

### bind_key. Question label?
- type: radio | dropdown | checkbox | text | textarea | number | rating | date | yes_no | email | phone
- required: true|false
- options:
  - Label | value | -> other_section_id
- min: 1
- max: 5
- min_label: Poor
- max_label: Excellent
- maxLength: 500

{DIALECT_RULES}
- Start with `## section_id: Title` — do not include `# Survey Title`.
""".strip()


class AiSurveyServiceError(Exception):
    pass


def generate_interview_questions(brief: str) -> List[Dict[str, Any]]:
    brief = (brief or "").strip()
    if not brief:
        raise AiSurveyServiceError("Brief is required")

    messages = [
        {
            "role": "system",
            "content": (
                "You help busy people design surveys quickly. "
                "Given a brief, return clarifying questions as JSON. "
                'Schema: {"questions":[{"id":"q1","prompt":"...","kind":"text"|"choice","options":["a","b"]}]}. '
                "Ask 4 to 6 questions max. Use kind=choice when options help. "
                "ALWAYS include one question about survey length/size with options like "
                '["Short (~10 questions)", "Medium (~20)", "Long (~35)", "Very long (~50)"]. '
                "Also cover audience, goals, sensitive topics, and branching needs. "
                "Do not generate the survey yet."
            ),
        },
        {"role": "user", "content": f"Survey brief:\n{brief}"},
    ]
    try:
        data = chat_completion_json(messages, temperature=0.3, max_tokens=1500)
    except GroqClientError as exc:
        raise AiSurveyServiceError(str(exc)) from exc

    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        raise AiSurveyServiceError("AI did not return interview questions")

    normalized: List[Dict[str, Any]] = []
    for index, raw in enumerate(questions[:6]):
        if not isinstance(raw, dict):
            continue
        prompt = str(raw.get("prompt") or "").strip()
        if not prompt:
            continue
        kind = str(raw.get("kind") or "text").strip().lower()
        if kind not in {"text", "choice"}:
            kind = "text"
        options = raw.get("options") if kind == "choice" else None
        if isinstance(options, list):
            options = [str(o).strip() for o in options if str(o).strip()]
        else:
            options = None
        if kind == "choice" and not options:
            kind = "text"
            options = None
        normalized.append(
            {
                "id": str(raw.get("id") or f"q{index + 1}"),
                "prompt": prompt,
                "kind": kind,
                "options": options,
            }
        )
    if not normalized:
        raise AiSurveyServiceError("AI returned empty interview questions")
    return normalized


def draft_survey_markdown(brief: str, answers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    brief = (brief or "").strip()
    if not brief:
        raise AiSurveyServiceError("Brief is required")

    answers = answers or {}
    target = _infer_target_question_count(brief, answers)
    answers_block = _format_answers(answers)

    if target <= SINGLE_SHOT_QUESTION_LIMIT:
        markdown = _draft_single_shot(brief, answers_block, target)
    else:
        markdown = _draft_chunked(brief, answers_block, target)

    return _finalize_draft(markdown)


def revise_survey_markdown(markdown: str, instruction: str) -> str:
    markdown = (markdown or "").strip()
    instruction = (instruction or "").strip()
    if not markdown:
        raise AiSurveyServiceError("Markdown is required")
    if not instruction:
        raise AiSurveyServiceError("Instruction is required")

    title, sections = _split_markdown_sections(markdown)
    question_count = sum(len(re.findall(r"(?m)^### ", body)) for _, body in sections)
    expand_to = _infer_expand_target(instruction)

    if expand_to and expand_to > question_count:
        return _expand_survey(markdown, title, sections, instruction, expand_to)

    if question_count <= SINGLE_SHOT_QUESTION_LIMIT and len(markdown) < 9000:
        return _revise_full_document(markdown, instruction)

    return _revise_chunked(title, sections, instruction)


def compile_markdown(markdown: str) -> CompileResult:
    try:
        return compile_survey_markdown(markdown)
    except SurveyMarkdownCompileError as exc:
        raise AiSurveyServiceError(str(exc)) from exc


# ── Draft strategies ─────────────────────────────────────────────────────────


def _draft_single_shot(brief: str, answers_block: str, target: int) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert survey designer. "
                f"Produce a complete questionnaire with about {target} questions "
                f"(aim for {max(target - 2, 4)}–{target + 1}). "
                "Output the markdown document only.\n\n"
                f"{DIALECT_SPEC}"
            ),
        },
        {
            "role": "user",
            "content": f"Survey brief:\n{brief}\n\n{answers_block}".strip(),
        },
    ]
    try:
        raw = chat_completion(messages, temperature=0.35, max_tokens=3500)
    except GroqClientError as exc:
        raise AiSurveyServiceError(str(exc)) from exc
    return _normalize_document_markdown(raw)


def _draft_chunked(brief: str, answers_block: str, target: int) -> str:
    outline = _plan_outline(brief, answers_block, target)
    title = str(outline.get("title") or "Survey").strip() or "Survey"
    planned = outline.get("sections")
    if not isinstance(planned, list) or not planned:
        raise AiSurveyServiceError("AI outline returned no sections")

    section_ids = []
    for raw in planned:
        if isinstance(raw, dict) and raw.get("id"):
            section_ids.append(_slugify(str(raw["id"])))

    parts: List[str] = [f"# {title}"]
    for index, raw in enumerate(planned):
        if not isinstance(raw, dict):
            continue
        if index > 0:
            # Stay under free-tier Groq TPM when drafting many sections.
            time.sleep(1.2)
        section_md = _draft_section(
            brief=brief,
            answers_block=answers_block,
            section=raw,
            section_index=index,
            all_section_ids=section_ids,
        )
        parts.append(section_md)

    return "\n\n".join(parts).strip()


def _plan_outline(brief: str, answers_block: str, target: int) -> Dict[str, Any]:
    # Aim for ~5–8 questions per section for large surveys
    suggested_sections = max(3, min(12, (target + 5) // 6))
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert survey architect. Return JSON only with schema:\n"
                '{"title":"...","sections":[{"id":"snake_case","title":"Human Title",'
                '"goal":"short","question_count":8,"topics":["topic1","topic2"]}]}\n'
                f"Plan a survey totaling about {target} questions (hard max {MAX_QUESTIONS}). "
                f"Use about {suggested_sections} sections. "
                "Distribute question_count so the sums are close to the target. "
                "ids must be unique snake_case. Do not write questions yet."
            ),
        },
        {
            "role": "user",
            "content": f"Survey brief:\n{brief}\n\n{answers_block}".strip(),
        },
    ]
    try:
        data = chat_completion_json(messages, temperature=0.3, max_tokens=2000)
    except GroqClientError as exc:
        raise AiSurveyServiceError(str(exc)) from exc

    sections = data.get("sections")
    if not isinstance(sections, list):
        raise AiSurveyServiceError("AI outline missing sections")

    # Normalize counts so we don't explode
    normalized: List[Dict[str, Any]] = []
    remaining = target
    for index, raw in enumerate(sections):
        if not isinstance(raw, dict):
            continue
        sid = _slugify(str(raw.get("id") or f"section_{index + 1}"))
        title = str(raw.get("title") or sid.replace("_", " ").title()).strip()
        goal = str(raw.get("goal") or "").strip()
        topics = raw.get("topics") if isinstance(raw.get("topics"), list) else []
        topics = [str(t).strip() for t in topics if str(t).strip()][:8]
        try:
            count = int(raw.get("question_count") or 5)
        except (TypeError, ValueError):
            count = 5
        count = max(2, min(10, count))
        normalized.append(
            {
                "id": sid,
                "title": title,
                "goal": goal,
                "question_count": count,
                "topics": topics,
            }
        )

    if not normalized:
        raise AiSurveyServiceError("AI outline had no usable sections")

    # Rescale question_count to hit target approximately
    total = sum(s["question_count"] for s in normalized) or 1
    scaled = []
    allocated = 0
    for index, section in enumerate(normalized):
        if index == len(normalized) - 1:
            count = max(2, min(10, target - allocated))
        else:
            count = max(2, min(10, round(section["question_count"] * target / total)))
            allocated += count
        scaled.append({**section, "question_count": count})

    return {"title": str(data.get("title") or "Survey").strip(), "sections": scaled}


def _draft_section(
    *,
    brief: str,
    answers_block: str,
    section: Dict[str, Any],
    section_index: int,
    all_section_ids: List[str],
) -> str:
    sid = str(section.get("id") or f"section_{section_index + 1}")
    title = str(section.get("title") or sid)
    goal = str(section.get("goal") or "")
    count = int(section.get("question_count") or 5)
    topics = section.get("topics") or []
    other_ids = [x for x in all_section_ids if x != sid]

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert survey designer. "
                f"Write exactly one section with about {count} questions "
                f"(aim for {max(count - 1, 2)}–{count + 1}). "
                f"The section id MUST be `{sid}` and the heading MUST be "
                f"`## {sid}: {title}`. "
                f"Other section ids you may branch to with -> : {', '.join(other_ids) or '(none)'}. "
                "Output this section markdown only.\n\n"
                f"{SECTION_DIALECT_SPEC}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Overall survey brief:\n{brief}\n\n{answers_block}\n\n"
                f"Section goal: {goal or title}\n"
                f"Topics to cover: {', '.join(topics) if topics else title}"
            ).strip(),
        },
    ]
    try:
        raw = chat_completion(messages, temperature=0.35, max_tokens=2200)
    except GroqClientError as exc:
        raise AiSurveyServiceError(f"Failed drafting section '{sid}': {exc}") from exc

    section_md = _normalize_section_markdown(raw, sid, title)
    # Soft repair if this section alone won't parse as part of a doc
    probe = f"# Probe\n\n{section_md}"
    try:
        compile_survey_markdown(probe)
    except SurveyMarkdownCompileError as exc:
        section_md = _repair_section(section_md, sid, title, str(exc))
    return section_md


# ── Revise strategies ────────────────────────────────────────────────────────


def _revise_full_document(markdown: str, instruction: str) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "You revise survey questionnaires. "
                "Apply the user's change request and output the full updated markdown document only.\n\n"
                f"{DIALECT_SPEC}"
            ),
        },
        {
            "role": "user",
            "content": f"Current markdown:\n\n{markdown}\n\nChange request:\n{instruction}",
        },
    ]
    try:
        updated = _normalize_document_markdown(
            chat_completion(messages, temperature=0.3, max_tokens=3500)
        )
    except GroqClientError as exc:
        raise AiSurveyServiceError(str(exc)) from exc

    try:
        compile_survey_markdown(updated)
    except SurveyMarkdownCompileError as exc:
        updated = _repair_markdown(updated, str(exc))
        compile_survey_markdown(updated)
    return updated


def _revise_chunked(title: str, sections: List[Tuple[str, str]], instruction: str) -> str:
    outline = [
        {"id": sid, "title": _section_title_from_body(body, sid)}
        for sid, body in sections
    ]
    messages = [
        {
            "role": "system",
            "content": (
                "You decide which survey sections need changes. Return JSON only:\n"
                '{"targets":["section_id",...],"notes":"short"}\n'
                "Pick only sections that must change for the instruction. "
                "If the instruction is global polish, pick at most 3 most relevant sections."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Survey title: {title}\nSections: {outline}\n\n"
                f"Change request:\n{instruction}"
            ),
        },
    ]
    try:
        plan = chat_completion_json(messages, temperature=0.2, max_tokens=800)
    except GroqClientError as exc:
        raise AiSurveyServiceError(str(exc)) from exc

    targets = plan.get("targets") if isinstance(plan.get("targets"), list) else []
    target_ids = {_slugify(str(t)) for t in targets if str(t).strip()}
    if not target_ids and sections:
        # Fallback: revise first section only rather than failing
        target_ids = {sections[0][0]}

    revised_parts: List[str] = [f"# {title}"] if title else []
    for sid, body in sections:
        if sid in target_ids:
            revised_parts.append(_revise_one_section(sid, body, instruction, outline))
        else:
            revised_parts.append(body.strip())

    updated = "\n\n".join(revised_parts).strip()
    try:
        compile_survey_markdown(updated)
    except SurveyMarkdownCompileError as exc:
        updated = _repair_markdown(updated, str(exc))
        compile_survey_markdown(updated)
    return updated


def _revise_one_section(
    sid: str,
    body: str,
    instruction: str,
    outline: List[Dict[str, str]],
) -> str:
    title = _section_title_from_body(body, sid)
    messages = [
        {
            "role": "system",
            "content": (
                "Revise this single survey section per the instruction. "
                f"Keep section id `{sid}`. Output this section markdown only.\n\n"
                f"{SECTION_DIALECT_SPEC}"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Survey sections overview: {outline}\n\n"
                f"Current section:\n{body}\n\n"
                f"Change request:\n{instruction}"
            ),
        },
    ]
    try:
        raw = chat_completion(messages, temperature=0.3, max_tokens=2200)
    except GroqClientError as exc:
        raise AiSurveyServiceError(f"Failed revising section '{sid}': {exc}") from exc
    return _normalize_section_markdown(raw, sid, title)


def _expand_survey(
    markdown: str,
    title: str,
    sections: List[Tuple[str, str]],
    instruction: str,
    expand_to: int,
) -> str:
    current = sum(len(re.findall(r"(?m)^### ", body)) for _, body in sections)
    needed = max(expand_to - current, 1)
    existing_ids = [sid for sid, _ in sections]
    answers_block = f"Expansion request:\n{instruction}\nExisting sections: {existing_ids}"
    # Plan only the additional capacity as new sections
    extra_target = min(needed, MAX_QUESTIONS - current)
    if extra_target <= 0:
        return markdown

    outline = _plan_outline(
        brief=f"Expand this survey to about {expand_to} questions. Existing title: {title}",
        answers_block=answers_block,
        target=extra_target,
    )
    # Avoid id collisions
    used = set(existing_ids)
    new_sections = []
    for raw in outline.get("sections") or []:
        if not isinstance(raw, dict):
            continue
        sid = _slugify(str(raw.get("id") or "extra"))
        if sid in used:
            n = 2
            while f"{sid}_{n}" in used:
                n += 1
            sid = f"{sid}_{n}"
        used.add(sid)
        new_sections.append({**raw, "id": sid})

    parts = [markdown.rstrip()]
    all_ids = existing_ids + [s["id"] for s in new_sections]
    for index, section in enumerate(new_sections):
        parts.append(
            _draft_section(
                brief=f"{title}. {instruction}",
                answers_block=answers_block,
                section=section,
                section_index=index,
                all_section_ids=all_ids,
            )
        )
    updated = "\n\n".join(parts).strip()
    return _finalize_draft(updated)["markdown"]


# ── Parsing / helpers ────────────────────────────────────────────────────────


def _infer_target_question_count(brief: str, answers: Dict[str, str]) -> int:
    blob = " ".join([brief, *[f"{k} {v}" for k, v in answers.items()]]).lower()

    # Explicit "50 questions" / "about 50 qs"
    explicit = re.findall(r"(?:about|around|~|approx(?:imately)?\s+)?(\d{1,3})\s*(?:questions?|qs|items?)\b", blob)
    if explicit:
        return max(4, min(MAX_QUESTIONS, int(explicit[-1])))

    # Bare number in length-ish answers
    for value in answers.values():
        m = re.search(r"\b(\d{1,3})\b", value or "")
        if m:
            n = int(m.group(1))
            if 4 <= n <= MAX_QUESTIONS:
                return n

    if re.search(r"\b(very\s+long|exhaustive|comprehensive|in[- ]depth)\b", blob):
        return 50
    if re.search(r"\b(long|lengthy|detailed)\b", blob):
        return 35
    if re.search(r"\b(medium|moderate)\b", blob):
        return 20
    if re.search(r"\b(short|brief|quick|pulse)\b", blob):
        return 10
    return DEFAULT_QUESTIONS


def _infer_expand_target(instruction: str) -> Optional[int]:
    text = (instruction or "").lower()
    match = re.search(r"(?:to|about|around|~)?\s*(\d{1,3})\s*(?:questions?|qs)\b", text)
    if match:
        return max(4, min(MAX_QUESTIONS, int(match.group(1))))
    if re.search(r"\b(more questions|expand|longer|add more)\b", text):
        return None  # handled as normal revise unless number given
    return None


def _format_answers(answers: Dict[str, str]) -> str:
    lines = [f"- {k}: {v}" for k, v in answers.items() if str(v).strip()]
    return ("Interview answers:\n" + "\n".join(lines)) if lines else ""


def _finalize_draft(markdown: str) -> Dict[str, str]:
    markdown = _normalize_document_markdown(markdown)
    try:
        compiled = compile_survey_markdown(markdown)
        title = compiled.title
    except SurveyMarkdownCompileError as exc:
        repaired = _repair_markdown(markdown, str(exc))
        compiled = compile_survey_markdown(repaired)
        markdown = repaired
        title = compiled.title
    return {"title": title, "markdown": markdown}


def _normalize_document_markdown(text: str) -> str:
    cleaned = _strip_markdown_fences(text)
    if not cleaned.startswith("#"):
        match = re.search(r"(?m)^# .+", cleaned)
        if match:
            cleaned = cleaned[match.start() :].strip()
    return cleaned


def _normalize_section_markdown(text: str, sid: str, title: str) -> str:
    cleaned = _strip_markdown_fences(text)
    # Drop accidental document title
    cleaned = re.sub(r"(?m)^# .+\n*", "", cleaned).strip()
    match = re.search(r"(?m)^## .+", cleaned)
    if match:
        cleaned = cleaned[match.start() :].strip()
    else:
        cleaned = f"## {sid}: {title}\n\n{cleaned}".strip()

    # Force expected section id on first heading
    cleaned = re.sub(
        r"(?m)^##\s+[^\n]+",
        f"## {sid}: {title}",
        cleaned,
        count=1,
    )
    return cleaned.strip()


def _split_markdown_sections(markdown: str) -> Tuple[str, List[Tuple[str, str]]]:
    lines = markdown.replace("\r\n", "\n").split("\n")
    title = "Survey"
    sections: List[Tuple[str, str]] = []
    current_id: Optional[str] = None
    current_lines: List[str] = []

    for line in lines:
        if line.startswith("# ") and not line.startswith("##"):
            title = line[2:].strip() or title
            continue
        if line.startswith("## "):
            if current_id is not None:
                sections.append((current_id, "\n".join(current_lines).strip()))
            heading = line[3:].strip()
            if ":" in heading:
                left, right = heading.split(":", 1)
                if re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", left.strip()):
                    current_id = left.strip()
                else:
                    current_id = _slugify(heading)
            else:
                current_id = _slugify(heading)
            current_lines = [line]
            continue
        if current_id is not None:
            current_lines.append(line)

    if current_id is not None:
        sections.append((current_id, "\n".join(current_lines).strip()))
    return title, sections


def _section_title_from_body(body: str, sid: str) -> str:
    match = re.match(r"##\s+([^:\n]+):\s*(.+)", body.strip())
    if match:
        return match.group(2).strip()
    match = re.match(r"##\s+(.+)", body.strip())
    if match:
        return match.group(1).strip()
    return sid.replace("_", " ").title()


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_]+", "_", (value or "").strip().lower())
    return normalized.strip("_") or "section"


def _strip_markdown_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("markdown"):
            cleaned = cleaned[8:]
        elif cleaned.lower().startswith("md"):
            cleaned = cleaned[2:]
        cleaned = cleaned.strip()
    return cleaned


def _repair_markdown(markdown: str, error: str) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "Fix the survey markdown so it compiles. "
                "Output the corrected markdown document only.\n\n"
                f"{DIALECT_SPEC}"
            ),
        },
        {
            "role": "user",
            "content": f"Compile error:\n{error}\n\nBroken markdown:\n\n{markdown}",
        },
    ]
    try:
        fixed = _normalize_document_markdown(
            chat_completion(messages, temperature=0.1, max_tokens=3500)
        )
    except GroqClientError as exc:
        raise AiSurveyServiceError(f"Markdown failed compile and repair failed: {exc}") from exc
    if not fixed:
        raise AiSurveyServiceError(f"Markdown failed compile: {error}")
    return fixed


def _repair_section(section_md: str, sid: str, title: str, error: str) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "Fix this single survey section so it compiles. "
                f"Keep id `{sid}`. Output section markdown only.\n\n"
                f"{SECTION_DIALECT_SPEC}"
            ),
        },
        {
            "role": "user",
            "content": f"Compile error:\n{error}\n\nBroken section:\n\n{section_md}",
        },
    ]
    try:
        fixed = chat_completion(messages, temperature=0.1, max_tokens=2200)
    except GroqClientError as exc:
        raise AiSurveyServiceError(f"Section '{sid}' failed repair: {exc}") from exc
    return _normalize_section_markdown(fixed, sid, title)
