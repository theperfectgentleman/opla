"""
Deterministic survey-markdown → FormBlueprint compiler.

Dialect (v1):
  # Survey Title
  ## section_id: Section Title
  Goal: optional description
  ### bind_key. Question label?
  - type: radio | dropdown | checkbox | text | textarea | number | rating | date | yes_no | email | phone
  - required: true
  - options:
    - Label | value | -> other_section_id
  - min / max / min_label / max_label / minLength / maxLength
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


SUPPORTED_TYPES = {
    "text",
    "textarea",
    "number",
    "radio",
    "dropdown",
    "checkbox",
    "rating",
    "date",
    "yes_no",
    "email",
    "phone",
}

UNSUPPORTED_TYPES = {
    "matrix",
    "ranking",
    "file",
    "file_upload",
    "gps",
    "constant_sum",
    "nps",
    "rich_text",
    "image",
    "hidden",
    "slider",
    "semantic_differential",
}

TYPE_TO_WIDGET = {
    "text": "input_text",
    "textarea": "textarea",
    "number": "input_number",
    "radio": "radio_group",
    "dropdown": "dropdown",
    "checkbox": "checkbox_group",
    "rating": "rating_scale",
    "date": "date_picker",
    "yes_no": "toggle",
    "email": "email_input",
    "phone": "phone_input",
}

TYPE_TO_SCHEMA = {
    "text": "string",
    "textarea": "string",
    "number": "integer",
    "radio": "string",
    "dropdown": "string",
    "checkbox": "array",
    "rating": "integer",
    "date": "date",
    "yes_no": "boolean",
    "email": "string",
    "phone": "string",
}


class SurveyMarkdownCompileError(Exception):
    """Raised when markdown cannot be compiled into a blueprint."""

    def __init__(self, message: str, line: Optional[int] = None):
        self.line = line
        if line is not None:
            super().__init__(f"Line {line}: {message}")
        else:
            super().__init__(message)


@dataclass
class CompileResult:
    title: str
    blueprint: Dict[str, Any]
    warnings: List[str] = field(default_factory=list)


def _slugify(value: str, fallback: str = "item") -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_]+", "_", (value or "").strip().lower())
    normalized = normalized.strip("_")
    return normalized or fallback


def _parse_heading_id_title(raw: str) -> Tuple[str, str]:
    """Parse 'id: Title' or just 'Title'."""
    text = raw.strip()
    if ":" in text:
        left, right = text.split(":", 1)
        left = left.strip()
        right = right.strip()
        if left and re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", left) and right:
            return left, right
    return _slugify(text, "section"), text


def _parse_question_heading(raw: str) -> Tuple[str, str]:
    """Parse 'bind_key. Question label?' or 'Question label?'."""
    text = raw.strip()
    match = re.match(r"^([a-zA-Z][a-zA-Z0-9_]*)\.\s+(.+)$", text)
    if match:
        return match.group(1), match.group(2).strip()
    return _slugify(text, "field"), text


def _parse_bool(raw: str) -> bool:
    return raw.strip().lower() in {"true", "yes", "1", "required"}


def _parse_option_line(raw: str, line_no: int) -> Dict[str, str]:
    """
    Parse: Label | value | -> section_id
    Also accepts: [Label] or Label alone.
    """
    text = raw.strip()
    if text.startswith("-"):
        text = text[1:].strip()
    text = re.sub(r"^\[([^\]]+)\]$", r"\1", text)

    skip_to: Optional[str] = None
    skip_match = re.search(r"(?:\|\s*)?->\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$", text)
    if skip_match:
        skip_to = skip_match.group(1)
        text = text[: skip_match.start()].rstrip().rstrip("|").strip()

    parts = [p.strip() for p in text.split("|") if p.strip()]
    if not parts:
        raise SurveyMarkdownCompileError("Empty option line", line=line_no)

    label = parts[0]
    value = parts[1] if len(parts) > 1 else _slugify(label, "option")
    option: Dict[str, str] = {"label": label, "value": value}
    if skip_to:
        option["skip_to"] = skip_to
    return option


def compile_survey_markdown(markdown: str) -> CompileResult:
    if not markdown or not markdown.strip():
        raise SurveyMarkdownCompileError("Markdown is empty")

    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    warnings: List[str] = []

    title: Optional[str] = None
    sections: List[Dict[str, Any]] = []
    current_section: Optional[Dict[str, Any]] = None
    current_field: Optional[Dict[str, Any]] = None
    in_options = False
    used_binds: set[str] = set()
    used_section_ids: set[str] = set()

    def flush_field() -> None:
        nonlocal current_field, in_options
        if current_field is None:
            return
        if current_section is None:
            raise SurveyMarkdownCompileError("Question found before any section")
        field_type = current_field.get("_type")
        if not field_type:
            raise SurveyMarkdownCompileError(
                f"Question '{current_field.get('label')}' is missing `- type:`",
                line=current_field.get("_line"),
            )
        if field_type in UNSUPPORTED_TYPES:
            warnings.append(
                f"Skipped unsupported type '{field_type}' for question "
                f"'{current_field.get('label')}' (line {current_field.get('_line')})"
            )
            current_field = None
            in_options = False
            return
        if field_type not in SUPPORTED_TYPES:
            raise SurveyMarkdownCompileError(
                f"Unknown type '{field_type}'. Supported: {', '.join(sorted(SUPPORTED_TYPES))}",
                line=current_field.get("_line"),
            )

        needs_options = field_type in {"radio", "dropdown", "checkbox"}
        options = current_field.get("options") or []
        if needs_options and not options:
            raise SurveyMarkdownCompileError(
                f"Type '{field_type}' requires options",
                line=current_field.get("_line"),
            )

        bind = current_field["bind"]
        if bind in used_binds:
            base = bind
            n = 2
            while f"{base}_{n}" in used_binds:
                n += 1
            bind = f"{base}_{n}"
            warnings.append(f"Duplicate bind renamed to '{bind}'")
        used_binds.add(bind)

        widget = TYPE_TO_WIDGET[field_type]
        child: Dict[str, Any] = {
            "id": bind,
            "field_id": bind,
            "type": widget,
            "bind": bind,
            "label": current_field["label"],
            "required": bool(current_field.get("required", False)),
        }
        if options:
            child["options"] = options
        for key in ("min", "max", "minLength", "maxLength", "min_label", "max_label", "placeholder"):
            if key in current_field:
                child[key] = current_field[key]
        if field_type == "rating":
            child.setdefault("min", 1)
            child.setdefault("max", 5)

        current_section["children"].append(child)
        current_section["_schema"].append(
            {
                "key": bind,
                "id": bind,
                "field_id": bind,
                "type": TYPE_TO_SCHEMA[field_type],
                "required": bool(current_field.get("required", False)),
                **({"items": {"type": "string"}} if field_type == "checkbox" else {}),
            }
        )
        current_field = None
        in_options = False

    def flush_section() -> None:
        nonlocal current_section
        flush_field()
        if current_section is not None:
            sections.append(current_section)
            current_section = None

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("# ") and not stripped.startswith("##"):
            flush_section()
            title = stripped[2:].strip()
            continue

        if stripped.startswith("## "):
            flush_section()
            section_id, section_title = _parse_heading_id_title(stripped[3:].strip())
            if section_id in used_section_ids:
                base = section_id
                n = 2
                while f"{base}_{n}" in used_section_ids:
                    n += 1
                section_id = f"{base}_{n}"
                warnings.append(f"Duplicate section id renamed to '{section_id}'")
            used_section_ids.add(section_id)
            current_section = {
                "id": section_id,
                "type": "screen",
                "title": section_title,
                "render_mode": "list",
                "description": "",
                "platforms": ["mobile", "web"],
                "is_repeatable": False,
                "layout": {"x": 40, "y": 40 + len(sections) * 120},
                "children": [],
                "_schema": [],
            }
            continue

        if stripped.startswith("### "):
            if current_section is None:
                raise SurveyMarkdownCompileError("Question found before any section", line=idx)
            flush_field()
            bind, label = _parse_question_heading(stripped[4:].strip())
            current_field = {
                "bind": bind,
                "label": label,
                "_line": idx,
                "required": False,
                "options": [],
            }
            in_options = False
            continue

        # Goal / description under section
        if current_section is not None and current_field is None:
            goal_match = re.match(r"^(?:Goal|Description)\s*:\s*(.+)$", stripped, re.IGNORECASE)
            if goal_match:
                current_section["description"] = goal_match.group(1).strip()
                continue

        if current_field is None:
            # Ignore prose outside structured blocks
            continue

        # Options list items while in_options
        if in_options and (stripped.startswith("- ") or stripped.startswith("* ")):
            # Nested option (not a field attr) — attrs use "- key: value"
            if re.match(r"^[-*]\s+\w+\s*:", stripped):
                # Could be end of options if it's another attr
                in_options = False
            else:
                option_text = stripped[2:].strip()
                current_field["options"].append(_parse_option_line(option_text, idx))
                continue

        attr_match = re.match(r"^[-*]\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$", stripped)
        if not attr_match:
            if stripped.startswith("- ") or stripped.startswith("* "):
                # Bare option without being in options block — treat as option if choice type later
                option_text = stripped[2:].strip()
                current_field["options"].append(_parse_option_line(option_text, idx))
                in_options = True
            continue

        key = attr_match.group(1).strip().lower()
        value = attr_match.group(2).strip()

        if key == "type":
            current_field["_type"] = value.lower().replace("-", "_").replace(" ", "_")
            in_options = False
        elif key == "required":
            current_field["required"] = _parse_bool(value) if value else True
            in_options = False
        elif key == "options":
            in_options = True
            if value:
                # Inline options: A, B, C or [A], [B]
                for piece in re.split(r",\s*", value):
                    piece = piece.strip()
                    if piece:
                        current_field["options"].append(_parse_option_line(piece, idx))
        elif key in {"min", "max"}:
            try:
                current_field[key] = int(value) if "." not in value else float(value)
            except ValueError as exc:
                raise SurveyMarkdownCompileError(f"Invalid {key} value '{value}'", line=idx) from exc
            in_options = False
        elif key in {"minlength", "min_length"}:
            try:
                current_field["minLength"] = int(value)
            except ValueError as exc:
                raise SurveyMarkdownCompileError(f"Invalid minLength '{value}'", line=idx) from exc
            in_options = False
        elif key in {"maxlength", "max_length"}:
            try:
                current_field["maxLength"] = int(value)
            except ValueError as exc:
                raise SurveyMarkdownCompileError(f"Invalid maxLength '{value}'", line=idx) from exc
            in_options = False
        elif key in {"min_label", "minlabel"}:
            current_field["min_label"] = value
            in_options = False
        elif key in {"max_label", "maxlabel"}:
            current_field["max_label"] = value
            in_options = False
        elif key == "placeholder":
            current_field["placeholder"] = value
            in_options = False
        else:
            warnings.append(f"Ignored unknown attribute '{key}' on line {idx}")
            in_options = False

    flush_section()

    if not title:
        raise SurveyMarkdownCompileError("Missing survey title (`# Title`)")
    if not sections:
        raise SurveyMarkdownCompileError("Survey has no sections (`## section`)")

    schema: List[Dict[str, Any]] = []
    ui: List[Dict[str, Any]] = []
    for section in sections:
        schema.extend(section.pop("_schema", []))
        if not section["children"]:
            warnings.append(f"Section '{section['title']}' has no supported questions")
        ui.append(section)

    if not any(s["children"] for s in ui):
        raise SurveyMarkdownCompileError("Survey has no supported questions after compile")

    blueprint = {
        "meta": {
            "title": title,
            "version": 1,
            "is_public": False,
            "visibility": "listed",
            "theme": {"primary_color": "#16a34a", "mode": "light"},
        },
        "schema": schema,
        "ui": ui,
        "logic": [],
        "rules": [],
        "linked_form_ids": [],
    }
    return CompileResult(title=title, blueprint=blueprint, warnings=warnings)
