# Opla Survey Platform — Design Capability Gap Analysis & Implementation Plan

**Status:** Draft for execution
**Scope:** The **Design** pillar only (form/survey authoring + on-device rendering). Analysis and Administration are explicitly out of scope for this document.
**Audience:** An AI coding agent (or engineer) who may not yet know this codebase. This document is written to be self-contained: it explains *why*, *what*, *where in the code*, and *how to verify*.

---

## 1. Purpose & Context

We are building Opla, a survey/data-collection platform. The product is organized into **three pillars**:

1. **Design** — letting a non-technical author design a survey (variables/widgets, sections, logic, navigation, data types) and deploy it to mobile, tablet, and web. **← This is what we are building now.**
2. **Analysis** — dashboards, pivots, exploration of collected data. *(Later.)*
3. **Administration** — tools, teams, tasks, field-force management. *(Later.)*

To pressure-test the Design pillar, we studied two real-world paper surveys that represent the complexity we must support:

- **Survey A — FMCG Brand Preference** (consumer questionnaire, 16 questions): grouped multi-select checkboxes by product category, single/multi select, Likert rating matrices, Yes/No with conditional follow-ups, duration grids, free text.
- **Survey B — Organized/Unorganized Retail (refrigeration)** (interviewer-administered B2B, 53 questions): respondent profile block, coded single/multi response option banks, large repeating equipment rosters with many typed columns per row, range-bucket tables (+ exact value), grouped Likert matrices with sub-headers, brand recall (unaided vs aided) with **show-cards**, and interviewer read-aloud scripts / "do/don't show the showcard" instructions.

**Goal of this effort:** by the time all tasks below are implemented, an author should be able to faithfully build and deploy *both* of these surveys (and things like them) without hitting a wall — while keeping the authoring experience approachable. We do **not** need to reproduce the paper layout pixel-for-pixel; we need to capture the same *intent* in a way that is easy to fill on a phone/tablet/web.

**Guiding principle:** *Do not sacrifice capability for simplicity, or simplicity for capability.* The underlying primitives should stay powerful; approachability comes from higher-level presets/templates layered on top (see Task 9).

---

## 2. Current Architecture (orientation for the agent)

The frontend is a monorepo under `opla-frontend/`. The **active** studio app is `opla-frontend/apps/studio` (note: there is a near-empty legacy `apps/studio/` at the repo root — ignore it; see Task 11).

### Key files you will touch repeatedly

| Concern | File |
|---|---|
| **Shared types** (the canonical data model) | `opla-frontend/packages/types/src/index.ts` |
| **Form builder** (palette, canvas, property editor, matrix/roster editors) | `opla-frontend/apps/studio/src/pages/FormBuilder.tsx` (~6,500 lines) |
| **Rules/logic builder UI** | `opla-frontend/apps/studio/src/components/RulesBuilder.tsx` |
| **Mobile renderer** (runtime on device) | `opla-frontend/apps/mobile/src/components/FormRenderer.tsx` |
| **Mobile field widgets** | `opla-frontend/apps/mobile/src/components/fields/*.tsx` |
| **Studio preview renderer** ("Simulator") | `opla-frontend/apps/studio/src/pages/FormSimulator.tsx` |
| **Public web form renderer** | `opla-frontend/apps/studio/src/pages/PublicForm.tsx` |

### The data model in one paragraph

A form is a `FormBlueprint` (`packages/types/src/index.ts`) with `meta`, `schema` (variable definitions: key + `SchemaFieldType`), `ui` (an array of `FormSection`s, each holding `FormField[]`), and `rules` (`FormRule[]`). A `FormField` has a `type: FieldType` (26 types today), a `bind` (the schema key), and a large set of optional properties (options, matrix rows/columns, object/repeater definitions, range config, catalog references, etc.). Sections have `render_mode` (`single` = one screen at a time, `list` = scroll), `is_repeatable`, `platforms`, and `description`.

### ⚠️ CRITICAL ENGINEERING NOTE — there are THREE independent renderers

Field types are rendered in **three separate places**, each with its own switch/branching logic. **Any new widget type MUST be implemented in all three**, or it will silently break on one platform:

1. **Mobile** — `FormRenderer.tsx`, a `switch (field.type)` (~line 359) that delegates to components in `components/fields/`.
2. **Studio Simulator** — `FormSimulator.tsx`, a long `field.type === '...'` ternary chain (~lines 1088–1620).
3. **Public web** — `PublicForm.tsx`, a similar ternary chain (~lines 195–555).

Additionally, adding a widget requires touching the **builder** (`FormBuilder.tsx`): the `widgetLibrary` array (~line 272), `widgetCategoryMap` (~line 301), `widgetHints` (~line 330), the default-field factory `addFieldToSection` (~line 1848), the property-editor rows, and the blueprint serialization helpers (~lines 2550–2610) so new props persist.

> There is also a note that `FormSimulator.tsx` appears to carry an **older, separate condition evaluator** (operators `eq`/`neq`/`gt`/`lt` around line 886) that differs from the centralized rules engine (`==`,`!=`,`>`,`<`,`contains`,`between`, actions `SHOW/HIDE/JUMP_TO_SECTION/...`) used by mobile. This divergence is a latent bug source; see Task 12 (optional hardening).

---

## 3. Summary of Findings

**The platform already covers ~85–90% of both surveys.** It is a mature, well-architected builder.

**Already supported (no work needed):**
- 26 field types incl. text/number/email/phone, date/time, **generic range**, dropdown/radio/checkbox/multi-select, toggle (Yes/No), textarea, GPS/photo/file/signature/barcode/audio, **matrix/table** (cell types radio/checkbox/text/number/dropdown), **lookup list**, **rating scale**, **object collection (repeater)**, object instance, form link.
- Sections with single-question vs list mode, repeatable sections, per-platform visibility (mobile/web/ussd), descriptions.
- A powerful **centralized rules engine**: nested AND/OR conditions; actions `SHOW/HIDE/REQUIRE/UNREQUIRE/DISABLE_NAV/ENABLE_NAV/FILTER_OPTIONS/SET_VALUE/VALIDATE/JUMP_TO_SECTION`. Handles all "if Yes → show…" branching and skips.
- Catalog forms, cascading/dependent options, lookup lists — for reusable/coded option banks and dependent dropdowns.
- Likert grids, duration grids, familiarity grids (via matrix); income/area/% buckets (via generic range); equipment rosters (via object collection).

**Gaps (the work in this document):**

| # | Gap | Priority | Blocks which survey feature |
|---|---|---|---|
| 1 | No static **display/instruction** content block (read-aloud scripts, section preambles, interviewer-only notes) | P1 | B: intro script, "show/don't show showcard" |
| 2 | No **media/show-card display** widget (show an image/asset to respondent) | P1 | B: Q49–Q53 brand show-cards |
| 3 | No native **"Other (specify)"** option with attached free text | P1 | A & B: "Other___", "Others1/2" everywhere |
| 4 | Matrix & checkbox rows are flat — no **grouped rows / sub-headers** | P2 | A: Q2 brands-by-category; B: Q28 grouped Likert |
| 5 | Repeater rosters lack **predefined fixed rows** + **per-column validation** | P2 | B: Q17/Q19 equipment lists |
| 6 | No paired **range-bucket + exact-value** helper | P2 | B: Q37/Q41 "tick range + capture exact" |
| 7 | No **interviewer vs self-administered** mode / enumerator note semantics | P2 | B: CAPI administration |
| 8 | No automatic **question/section numbering** | P3 | A & B: paper parity |
| 9 | Authoring UX: raw property panel is dense; no **question presets/templates** | P2 (UX) | Lowers learning curve across the board |
| 10 | No **"no-back"/locked ordering** for unaided-before-aided | P3 | B: Q49/50 before Q51/52 |
| 11 | Repo cleanup: duplicate near-empty `apps/studio` at root | P3 | n/a (hygiene) |
| 12 | Simulator uses a divergent legacy condition evaluator | P3 (hardening) | Preview correctness |

---

## 4. Definition of Done (Design pillar "capable")

- An author can build Survey A and Survey B end-to-end in the builder using native widgets (no hacks).
- All new widgets render correctly and identically in **mobile, simulator, and public** renderers.
- New properties persist through save/load (blueprint round-trip) and are backward compatible (older forms without the new props still open and render).
- The builder remains approachable: common patterns are available as one-click presets.

---

## 5. Detailed Tasks

> **Conventions for every task:** follow the existing code style in the touched files. When you add a `FieldType`, you MUST update the type union, the three renderers, and the builder registration points listed in §2. After each task, verify with the checklist in §6. Do not break existing forms — all new fields on `FormField`/`FieldOption`/`FormSection` must be **optional**.

---

### TASK 1 — Static Display / Instruction Content Block (P1)

**Objective.** Add a non-input widget that renders author-provided content (rich or plain text) inside a form — used for read-aloud interviewer scripts, section preambles, legal/consent text, and enumerator-only instructions.

**Why.** Survey B opens with a read-aloud script and contains instructions like *"Please show the SHOWCARD"* / *"Do not show any SHOWCARD here."* These are content, not questions, and today there is nowhere to put them (a section `description` is not enough and can't be interleaved between fields or marked interviewer-only).

**Data model** (`packages/types/src/index.ts`):
- Add `'display_content'` to the `FieldType` union.
- Add optional props to `FormField`:
  - `content_text?: string` — the body (support a lightweight markdown subset or plain text with line breaks).
  - `content_style?: 'plain' | 'callout' | 'heading'` — visual treatment.
  - `audience?: 'all' | 'interviewer_only'` — when `interviewer_only`, render only in interviewer-administered contexts (tie to Task 7; until then treat as `all` but store the flag).
- A `display_content` field has **no `bind`** and produces no submission data. Ensure validation/required logic skips it.

**Builder** (`FormBuilder.tsx`):
- Add to `widgetLibrary` with a suitable icon (e.g. `FileText`/`Info`), a new category `"Content"` in `widgetCategoryMap`, and a `widgetHints` entry.
- In `addFieldToSection` default factory, initialize `{ content_text: '', content_style: 'plain', audience: 'all', required: false }` and do **not** auto-assign a `bind`.
- Property editor: add rows (category `"Content"`) for `content_text` (multiline textarea), `content_style` (select), `audience` (select). Hide the standard input properties (placeholder, required, validation, bind) for this type.
- Ensure serialization includes the new props.

**Renderers (all three).** Render the text with the chosen style; for `heading` render as a section-like header; for `callout` render a bordered/tinted box. It is **not** an input — do not register a value, do not show a label/asterisk, do not block navigation.

**Acceptance.** Author can drop an instruction block between questions; it appears in simulator, public, and mobile with no data captured; marking it a heading/callout changes styling.

---

### TASK 2 — Media / Show-Card Display Widget (P1)

**Objective.** A widget that **displays** an image (and optionally a caption) to the respondent/enumerator, sourced from the Assets library or a URL.

**Why.** Note that `photo_capture` *captures* a photo; nothing *shows* one. Survey B's brand-awareness questions (Q49–Q53) rely on show-cards (a printed list/logos shown to the respondent).

**Data model:**
- Add `'media_display'` to `FieldType`.
- Add optional props: `media_asset_id?: string`, `media_url?: string`, `media_caption?: string`, `media_max_height?: number`.
- Like Task 1, no `bind`, no submission value.

**Builder:** add to palette under `"Content"`, icon `Image`. Property rows: asset picker (reuse the Assets integration if one exists; otherwise a URL input as a first pass) + caption + max height. Persist props.

**Renderers (all three):** render the image responsively (respect `media_max_height`), with caption below. Handle missing/broken image gracefully (placeholder). On mobile, ensure it works offline if the asset is cached (best-effort; a URL fallback is acceptable for v1).

**Acceptance.** Author attaches an image; it displays in all three renderers; a "show-card" question can be built by placing a `media_display` above a `radio_group`/`checkbox_group`.

---

### TASK 3 — "Other (specify)" Option with Free Text (P1)

**Objective.** Let any single/multi-select field (`dropdown`, `radio_group`, `checkbox_group`, `multi_select_dropdown`) include an **"Other"** option that, when selected, reveals a free-text input, and stores the typed value.

**Why.** "Other___", "Others1", "Others2" appear throughout both surveys. Today this requires a separate text field plus a manual rule — tedious and error-prone for authors.

**Data model:**
- On `FormField`, add `allow_other?: boolean` and `other_label?: string` (default `"Other"`).
- Define a storage convention for the "other" text so it round-trips and is analyzable later. Recommended: store the free text under a companion key `"{bind}__other"` in submission data, and store the selected option value as a reserved sentinel (e.g. `"__other__"`). Document this convention in code comments.

**Builder:** add a `"Allow \"Other\" option"` toggle + `other_label` input to the property editor for the four selection types (category `"Data"`). No change to the existing choices editor.

**Renderers (all three):** when `allow_other` is true, append the Other option to the rendered choices; when it is selected, show a text input bound to the companion key. For checkbox/multi-select, the Other text is captured alongside the array selection.

**Acceptance.** Selecting "Other" reveals a text box in all three renderers; the typed value is present in the submission payload under the documented key; deselecting hides/clears it.

---

### TASK 4 — Grouped Rows / Sub-headers for Matrix & Checkbox (P2)

**Objective.** Allow rows/options to be organized under **group headers** in `matrix_table` and `checkbox_group`.

**Why.** Survey A Q2 groups brand checkboxes by category (Hair oil, Skin care, …). Survey B Q28 groups Likert rows under Product & Features / Technical Specifications / Service & Maintenance. Today rows/options are flat, forcing authors to split into many separate questions.

**Data model:**
- Extend `TableRow` with optional `group?: string` (the group header label it belongs to). Rows with the same `group` render under one header; rows without a `group` render ungrouped.
- For `checkbox_group`, extend `FieldOption` with optional `group?: string` (same semantics).
- Order is preserved by array order; headers appear at the first occurrence of each group.

**Builder:** in the matrix rows editor (~lines 1033–1073) and the choices editor, allow assigning a group label per row/option (a simple text field per row, or a "group divider" insert). Keep it optional and unobtrusive.

**Renderers (all three):** render a non-selectable sub-header row/label before each group's items. Selection behavior is unchanged.

**Acceptance.** A single matrix/checkbox question shows visually grouped rows with headers in all three renderers; ungrouped rows still work; existing forms (no groups) are unaffected.

---

### TASK 5 — Repeater Rosters: Predefined Rows + Per-Column Validation (P2)

**Objective.** Improve `object_collection` so authors can (a) seed a fixed set of predefined rows and (b) set validation per column.

**Why.** Survey B Q17/Q19 present a fixed list of ~11 named equipment types (+ "Other") with several typed columns each. Today seeding fixed rows requires building a catalog form; and columns (`object_definition.properties`) support type/edit_mode/formula/reference but no min/max/required-style validation.

**Data model** (`FormObjectDefinition` / `ObjectPropertyDefinition`):
- Add `predefined_rows?: Array<Record<string, any>>` to `FormObjectDefinition` — an array of seed row values keyed by property `key`. When present and prepopulate mode allows, the roster initializes with these rows.
- Add validation props to `ObjectPropertyDefinition`: `min?`, `max?`, `minLength?`, `maxLength?`, `pattern?` (mirror the ones on `FormField`).

**Builder:** in `ObjectPropertiesInput` (~line 735) add a "Predefined rows" editor (add/remove seed rows, fill values per property) and per-column validation inputs. Keep behind the existing collapsible "Configure…" panel so it doesn't clutter simple use.

**Renderers (all three):** initialize the collection from `predefined_rows` when the collection is empty and mode is not "none"; enforce per-column validation on entry/submit. Respect `allow_add_items`/`allow_remove_items` (author may lock the row set).

**Acceptance.** Author defines an "Equipment" roster with 11 seeded rows and a numeric "Nos. purchased" column with min 0; on device the rows appear pre-listed, invalid numbers are rejected, and (if add is disabled) the respondent cannot change the row set.

---

### TASK 6 — Range Bucket + Exact Value Helper (P2)

**Objective.** Make it easy to ask "pick a range bucket" **and** "capture the exact value" as one logical unit.

**Why.** Survey B Q37/Q41/Q42/Q43 present a tick-a-range list plus a "Capture the exact response here" column.

**Approach (lightweight — no new field type required):** add an optional `companion_exact_value?: boolean` to `FormField` for `radio_group`/`dropdown` (the bucket selector). When true, render a small numeric/text input next to/below the selection that stores to `"{bind}__exact"`. Document the storage key convention (consistent with Task 3).

**Builder:** a single toggle in the property editor for those types.

**Renderers (all three):** show the exact-value input when the toggle is on; store under the companion key.

**Acceptance.** A range question optionally shows an "exact value" input; both the bucket and the exact number appear in the submission.

---

### TASK 7 — Interviewer vs Self-Administered Mode + Enumerator Notes (P2)

**Objective.** Introduce an explicit **administration mode** so content/instructions can be shown to the interviewer but not the respondent, and so read-aloud scripts are treated correctly.

**Why.** Survey B is interviewer-led (CAPI). It contains enumerator-only instructions and read-aloud scripts. Survey A is self-administered. The platform currently only has `platforms` (mobile/web/ussd) and `area` (yard/desk), which is not the same axis.

**Data model** (`FormBlueprintMeta` and/or `FormSection`):
- Add `administration_mode?: 'self' | 'interviewer'` to `FormBlueprintMeta` (form-level default).
- Rely on Task 1's `audience: 'interviewer_only'` for per-field/interviewer-only content.

**Builder:** a form-level setting (in form settings/meta panel) to choose administration mode. When `interviewer`, the runtime may show `interviewer_only` content and read-aloud styling; when `self`, `interviewer_only` blocks are hidden.

**Renderers (all three):** honor `audience` against the active `administration_mode`. In interviewer mode, render `interviewer_only` display blocks with a distinct style (e.g. "READ ALOUD" / "INSTRUCTION" chip). In self mode, hide them.

**Acceptance.** The same blueprint hides interviewer notes in self mode and shows them (distinctly styled) in interviewer mode across all renderers.

---

### TASK 8 — Automatic Question / Section Numbering (P3)

**Objective.** Optionally display sequential numbers for sections and questions.

**Why.** Paper surveys are numbered (Q1–Q53); numbering aids interviewer parity and respondent orientation.

**Data model:** add `show_numbering?: boolean` to `FormBlueprintMeta` (default false to preserve current look).

**Builder:** a form-level toggle. Numbering is computed at render time (do not persist numbers), skipping non-input content blocks (Tasks 1 & 2).

**Renderers (all three):** when enabled, prefix input questions with an incrementing number (and optionally sections with a number). Ensure hidden/conditional fields don't leave gaps in a confusing way (decide and document: number by position, recompute on visibility — start simple by numbering visible input fields in order).

**Acceptance.** Toggling numbering shows Q1, Q2, … consistently in all renderers; content blocks are not numbered.

---

### TASK 9 — Question Presets / Templates (P2, UX)

**Objective.** Add a "quick add" layer of **preset question types** that expand into the existing primitives with sensible defaults, so authors don't have to hand-configure common patterns.

**Why.** The primitives are powerful but the raw property panel is dense (e.g. rosters, matrices). Presets lower the learning curve *without* removing capability — power users still get the full panel afterward.

**Suggested presets (each just constructs a `FormField` with pre-filled props — no new types except where a task above adds them):**
- **Likert scale (5-point)** → `matrix_table` with cell_type `radio`, 5 columns (Strongly disagree…Strongly agree), empty rows to fill.
- **Yes/No + follow-up** → a `toggle` plus a follow-up field and a prewired `SHOW` rule.
- **Select with Other** → selection field with `allow_other` on (Task 3).
- **Ranking / duration grid** → `matrix_table` radio with common column sets.
- **Equipment roster** → `object_collection` with a couple of typed columns + predefined-rows editor open (Task 5).
- **Read-aloud instruction** → `display_content` with `content_style: 'callout'`, `audience: 'interviewer_only'` (Tasks 1 & 7).

**Builder:** add a "Presets" group in the widget palette (or a "+ Add question" menu) that inserts the pre-configured field. Implementation is a thin factory returning `Partial<FormField>` defaults passed to `addFieldToSection`.

**Acceptance.** An author can add a working Likert matrix or "Select with Other" in one click, then fine-tune via the normal property panel.

---

### TASK 10 — Locked Ordering / No-Back for Unaided→Aided (P3)

**Objective.** Allow marking a section (or the transition into it) as **no return**, so a respondent can't go back after seeing later content.

**Why.** Survey B asks unaided brand recall (Q49/50) *before* revealing a show-card, then aided recall (Q51/52). Revisiting after seeing the list would bias the unaided answers.

**Data model:** add `lock_after_advance?: boolean` to `FormSection`.

**Renderers (mobile + simulator/public where multi-screen):** when leaving a `lock_after_advance` section (in `single` render mode), disable the Back navigation into it. Only relevant where step navigation exists.

**Acceptance.** In single-screen mode, once past a locked section the respondent cannot navigate back to it.

---

### TASK 11 — Repo Hygiene: Remove Duplicate Studio Stub (P3)

**Objective.** Remove or clearly quarantine the near-empty `apps/studio/` at the **repo root** (contains only `src/pages/Welcome.tsx`), which is confusing next to the real app at `opla-frontend/apps/studio`.

**Why.** Reduces the chance an agent edits the wrong file.

**Action.** Confirm nothing imports/builds from the root `apps/studio` (grep for references, check build config). If unused, delete it; otherwise add a `README` noting it is deprecated. Do not touch `opla-frontend/apps/studio`.

**Acceptance.** Only one studio app remains active; build still passes.

---

### TASK 12 — (Optional hardening) Unify the Simulator's Condition Evaluator (P3)

**Objective.** Make the studio **Simulator** use the same centralized rules engine as mobile.

**Why.** `FormSimulator.tsx` appears to use a legacy evaluator (operators `eq/neq/gt/lt` ~line 886) distinct from the `FormRule`/`RuleNode` engine (`==`,`!=`,`contains`,`between`, actions incl. `JUMP_TO_SECTION`). This means the preview can behave differently from the device — a subtle correctness bug.

**Action.** Extract/reuse the rule-evaluation logic used by mobile into a shared module (candidate: `opla-frontend/packages/logic`, currently nearly empty) and have both mobile and simulator import it. Keep behavior identical to mobile.

**Acceptance.** A form with `SHOW/HIDE/JUMP_TO_SECTION` rules behaves identically in the Simulator and on device.

---

## 6. Testing / Verification Checklist (run after each task)

For every task that adds or changes a widget/property:

1. **Type-check & build** the monorepo (studio + mobile). No TS errors.
2. **Round-trip:** create a form using the new feature, save, reload — the config persists and re-renders.
3. **Backward compatibility:** open a pre-existing form (without the new props) — it still loads and renders unchanged.
4. **Three-renderer parity:** verify the feature in (a) Studio Simulator, (b) Public web form, (c) Mobile app. Behavior and data captured should match.
5. **No-data widgets** (Tasks 1, 2): confirm they never appear in the submission payload and never block required-validation/navigation.
6. **Companion-key widgets** (Tasks 3, 6): confirm the documented `__other` / `__exact` keys appear in submissions.
7. **Logic still works:** a conditional (`SHOW`/`HIDE`/`JUMP_TO_SECTION`) rule referencing the new field behaves correctly.

## 7. Suggested Execution Order

1. Task 11 (hygiene, quick) → 2. Task 1 → 3. Task 2 → 4. Task 3 → 5. Task 4 → 6. Task 5 → 7. Task 6 → 8. Task 7 → 9. Task 8 → 10. Task 9 (presets, after the primitives exist) → 11. Task 10 → 12. Task 12 (optional).

Rationale: land the P1 content/selection gaps first (they unblock faithful reproduction of the surveys), then structural P2 enhancements, then the UX preset layer (which builds on everything above), then P3 polish/hardening.

---

## 8. Acceptance for the Whole Effort

The Design pillar is "done" when an author can build **both reference surveys** natively in the builder, deploy them, and have them render and capture correctly on mobile, tablet (web), and public web — with the authoring flow made approachable via presets. At that point we proceed to the **Analysis** pillar (separate document).
