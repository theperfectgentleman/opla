# Vocabulary & Navigation Migration Plan

**Status:** In progress (Phases 0–3 largely implemented; migration `031_vocab_rename` applied)  
**Depends on:** [`PRODUCT_VOCABULARY.md`](./PRODUCT_VOCABULARY.md)  
**Goal:** Align Studio, mobile, API copy, and (where justified) database names with the locked product hierarchy.

---

## Target information architecture

```
Organisation
├── Members & Roles
├── Teams
└── Projects
      ├── Hub
      ├── Tasks         (+ Today)
      ├── Ops           (attendance, review)
      ├── Design        (forms, automations)
      ├── Messages
      ├── Data
      │     ├── Directory
      │     ├── Datasets
      │     └── Analysis
      └── Reports
```

---

## Principles

1. **Ship copy and nav before schema** — users see the new vocabulary early; breaking API/DB changes come later with aliases.
2. **One canonical URL per area** — support legacy query params with redirects for bookmarks and deep links.
3. **Keep internal terms where risk is high** — `submissions`, blueprint `catalog_*` keys, and table names can lag behind UI labels.
4. **Project-scoped vs org-scoped** — Data and Design live at project level; Members & Roles and Teams stay at org level.
5. **Hub stays read-only** — execution (tasks, attendance, capture) deep-links out; Hub does not duplicate editing surfaces.

---

## Current → target mapping

### Organisation shell (`Dashboard` + `StudioLayout`)

| Current | Target | Scope |
|---------|--------|-------|
| Sidebar `projects` | **Projects** (list + entry to Hub) | Org |
| Sidebar `forms` (All Forms) | **Design** (org-wide form index) | Org |
| Sidebar `ops` + `view=tasks` | **Tasks** (cross-project) | Org |
| Sidebar `ops` + `view=review` | **Ops → Review** (cross-project queue) | Org |
| Sidebar `datasets` | **Data → Datasets** | Org |
| Sidebar `analysis` / Analytics | **Data → Analysis** | Org |
| Sidebar `threads` | **Messages** | Org |
| Sidebar `members` (label “Teams”) | Split: **Members & Roles** + **Teams** as siblings | Org |
| Sidebar `reports` | **Reports** | Org |
| Sidebar `audience`, `assets` | TBD — fold into Data or Settings in a later pass | Org |

### Project workspace (`ProjectWorkspace`)

| Current `?tab=` | Target | Sub-views |
|-----------------|--------|-----------|
| _(route `/hub`)_ | **Hub** | overview (default) |
| `ops` + `view=tasks` | **Tasks** | list, planner, Today strip |
| `ops` + `view=review` | **Ops** | review queue |
| _(attendance in ops today)_ | **Ops** | attendance |
| `forms` | **Design** | forms \| automations |
| `threads` | **Messages** | channels |
| `catalog` | **Data → Directory** | sources + records |
| `data` | **Data → Datasets** | submission datasets + assets |
| _(dashboard analysis)_ | **Data → Analysis** | lab, prep, dashboards, maps |
| `reports` | **Reports** | unchanged |
| `members` | Move to org **Members & Roles** / project access panel | long-term |

### Mobile Desk (agents)

| Current route / copy | Target |
|----------------------|--------|
| `(desk)/index` “Agent Dashboard” | **Today** home |
| `(desk)/journey/[projectId]` | **Tasks → Today** (`tasks/today/[projectId]`) |
| “Today's Assignments” | **Today** |
| `(desk)/project-forms/` | **Capture** (task opens form; hide “Design”) |
| `(desk)/attendance/` | **Ops → Attendance** |
| `journey_visit` chip “Scheduled visit” | Task type label (display map only in Phase 1) |

---

## Phased rollout

### Phase 0 — Prep (1–2 days)

**No user-visible changes.**

- [ ] Add this plan and keep [`PRODUCT_VOCABULARY.md`](./PRODUCT_VOCABULARY.md) as source of truth.
- [ ] Create shared constants file: `opla-frontend/packages/config/src/vocabulary.ts` (or `studio/src/lib/vocabulary.ts`) with nav keys, labels, legacy aliases.
- [ ] Audit deep links in: `NeedsAttentionRail`, `ProjectHub`, `Dashboard`, email/invitation flows, tests.
- [ ] Decide **DB rename policy**: recommend **API aliases + UI labels first**; schema renames in Phase 4 only where enums leak to clients.

**Exit criteria:** Constants module exists; list of legacy `?tab=` values documented.

---

### Phase 1 — Display-only rename (3–5 days)

**User-visible labels only. No route or API changes.**

#### Studio

| File | Changes |
|------|---------|
| `StudioLayout.tsx` | Threads → Messages; Analytics → Data (or “Data · Analysis”); Datasets → Data · Datasets; clarify Members vs Teams |
| `Dashboard.tsx` | Tab labels; Ops sub-headings; “Catalog” form subtab → “Directory forms”; thread CTAs |
| `ProjectWorkspace.tsx` | Tab bar: Forms → Design; Catalog → Directory (interim) or hide until Phase 2; Threads → Messages; stat chips |
| `ProjectHub.tsx` | “ProjectHub” → “Hub”; “journey visits” → “visits today”; workspace filter labels |
| `ProjectThreadsPanel.tsx` | Header Threads → Messages |
| `DatasetsTab.tsx` | “Reference catalogs” → “Directory sources” |
| `CatalogGrid.tsx` | Copy only: catalog → directory |
| `FormHome.tsx`, `FormBuilder.tsx` | Badge “Catalog form” → “Directory form” |

#### Mobile

| File | Changes |
|------|---------|
| `(desk)/index.tsx` | Assignment → Task; dashboard copy |
| `(desk)/journey/[projectId].tsx` | Screen title → Today |
| `(desk)/project/[id].tsx` | Tile labels |
| `(desk)/form/*.tsx` | “Desk Form” → neutral capture copy |

#### Backend (messages only)

| File | Changes |
|------|---------|
| `project.py` schemas | “Journey visit tasks must…” → “Scheduled tasks must…” |

**Exit criteria:** No user-facing “Threads”, “Catalog” (nav), or “Journey” in primary UI; grep checklist passes.

---

### Phase 2 — Navigation restructure (1–2 weeks)

**Reorganize tabs and routes. Legacy redirects required.**

#### 2A — Project workspace tabs

New tab order and keys:

```
hub* | tasks | ops | design | messages | data | reports
```
\* Hub may remain `/projects/:id/hub` until cutover; workspace default becomes Hub link in header.

| New key | Sub-nav | Absorbs |
|---------|---------|---------|
| `tasks` | list, Today | `ops&view=tasks` (task planner, create task) |
| `ops` | attendance, review | attendance block from old ops; `view=review` |
| `design` | forms, automations | `tab=forms` + automation panel |
| `messages` | channels | `tab=threads` |
| `data` | directory, datasets, analysis | `catalog`, `data`, link/embed analysis |
| `reports` | — | unchanged |

**Implement in:** `ProjectWorkspace.tsx` (primary), extract sub-nav components.

**Legacy redirects** (in workspace URL sync):

```
?tab=forms      → ?tab=design
?tab=threads    → ?tab=messages
?tab=catalog    → ?tab=data&section=directory
?tab=data       → ?tab=data&section=datasets
?tab=ops&view=tasks → ?tab=tasks
?tab=tasks      → ?tab=tasks  (already legacy-mapped to ops today — invert)
?tab=review     → ?tab=ops&section=review
```

#### 2B — Organisation dashboard (`Dashboard.tsx`)

- Split sidebar `ops` into **Tasks** (cross-project) and **Ops** (review queue + attendance overview if added).
- Nest **Analysis** under **Data** with sub-tools (`lab`, `prep`, `dashboard`, `spatial`).
- Rename `?tab=threads` → `?tab=messages` with redirect.

**Implement in:** `StudioLayout.tsx`, `Dashboard.tsx`, `App.tsx` if route additions needed.

#### 2C — Hub cutover alignment

- Hub workspace launcher links use new tab keys (`design`, `data&section=directory`, etc.).
- “Open workspace” destinations updated in `ProjectHub.tsx`.
- Post-create project: keep landing on Hub.

#### 2D — Mobile route rename

| Old | New |
|-----|-----|
| `journey/[projectId]` | `tasks/today/[projectId]` |
| `project-forms/[projectId]` | `capture/[projectId]` (optional) |

Add Expo redirects or wrapper screens at old paths for one release cycle.

**Exit criteria:** New nav matches vocabulary doc; all old `?tab=` URLs redirect; mobile old routes still resolve.

---

### Phase 3 — Structural UI moves (1 week)

**Content moves without DB changes.**

- [ ] Pull **attendance** UI fully under **Ops** tab (project workspace); remove from Tasks tab if duplicated.
- [ ] **Automations** become explicit sub-tab under **Design** (not buried at bottom of forms list).
- [ ] **Data → Analysis**: embed `AnalyticsHub` at project scope (`/projects/:id?tab=data&section=analysis`) instead of only org dashboard.
- [ ] **Members** project tab → project access drawer or link to org Members & Roles.
- [ ] Mobile **Today** home: primary CTA = task list; capture only from task context (reduce naked forms list over time).

**Exit criteria:** Each vocabulary area has one obvious home; no duplicate attendance/tasks surfaces.

---

### Phase 4 — API aliases (optional, 1 week)

**Add new paths; keep old paths as deprecated aliases.**

Recommended aliases (delegate to existing handlers):

| Legacy | Alias |
|--------|-------|
| `GET/POST .../catalog-items` | `.../directory-items` |
| `GET .../threads` | `.../messages` |
| `GET .../attention` | `.../alerts` |
| `GET .../catalog-entries` | `.../directory-entries` |
| `GET .../catalog-lookup-sources` | `.../directory-lookup-sources` |

**Implement in:** `projects.py`, `forms.py`, `threads.py` — thin route wrappers.

Update `opla-frontend/apps/studio/src/lib/api.ts` and `mobile/services/api.ts` to prefer aliases; fall back during transition.

**Exit criteria:** OpenAPI documents both; frontend uses aliases; no breaking changes for external consumers.

---

### Phase 5 — Database migrations (optional, high risk — defer until needed)

Only pursue when enum/table names cause real pain (client contracts, reporting, new hires confusion). Each is a separate migration + data backfill.

#### 5A — Task kind rename (medium risk)

| Current | Proposed |
|---------|----------|
| Enum `journey_visit` | `scheduled` or `field_visit` |
| Column `visit_date` | `scheduled_date` |

**Touches:** `project_tasks`, `form_automation_rules.action_config_json`, mobile types, tests.

```sql
-- Pattern (Postgres)
ALTER TYPE project_task_kind RENAME VALUE 'journey_visit' TO 'field_visit';
ALTER TABLE project_tasks RENAME COLUMN visit_date TO scheduled_date;
```

Backfill automation JSON: `UPDATE form_automation_rules SET action_config_json = ... WHERE kind = 'journey_visit'`.

#### 5B — Form kind `catalog` → `directory` (high risk)

| Current | Proposed |
|---------|----------|
| `form_kind` value `catalog` | `directory` |
| `catalog_key_field_id` | `directory_key_field_id` |
| `catalog_label_field_id` | `directory_label_field_id` |
| `submissions.catalog_is_active` | `directory_is_active` |

**Does not automatically fix** blueprint JSON keys (`catalog_form_id`, `catalog_source_type`, etc.) — requires JSONB migration script.

#### 5C — `project_catalog_items` → `project_directory_items` (medium risk)

Table + model rename; API already aliased in Phase 4.

#### 5D — `project_threads*` → `project_messages*` (high risk, low priority)

Large FK graph (`project_attention_items.source_thread_id`, notifications). **Recommend:** keep table names internal; user-facing “Messages” only unless doing a major version bump.

#### 5E — Blueprint JSONB key migration (highest risk)

Stored in `forms.blueprint_draft`, `forms.blueprint_live` across all catalog-linked forms.

**Recommend:** Defer indefinitely; runtime accepts both keys via adapter layer in `@opla/types` and form renderer.

**Exit criteria per migration:** Alembic revision, backfill script, rollback notes, client updated, staging verified.

---

## Route & URL contract (target state)

### Organisation (Studio)

```
/dashboard?tab=projects
/dashboard?tab=tasks
/dashboard?tab=ops&section=review
/dashboard?tab=design
/dashboard?tab=messages
/dashboard?tab=data&section=directory|datasets|analysis&tool=lab|prep|dashboard|spatial
/dashboard?tab=members&section=members|roles
/dashboard?tab=teams
/dashboard?tab=reports
/dashboard?tab=settings
```

### Project

```
/projects/:id/hub
/projects/:id?tab=tasks
/projects/:id?tab=ops&section=attendance|review
/projects/:id?tab=design&section=forms|automations
/projects/:id?tab=messages&thread=:threadId
/projects/:id?tab=data&section=directory|datasets|analysis
/projects/:id?tab=reports
/projects/:id/reports/:reportId
/forms/:formId          (design detail — keep)
/builder/:formId
/simulator/:formId
```

### Mobile

```
/(main)/(desk)/                    → Today
/(main)/(desk)/tasks/today/:projectId
/(main)/(desk)/ops/attendance/:projectId
/(main)/(desk)/capture/:projectId  → form picker (interim)
/(main)/(desk)/form/:id
```

---

## File checklist (primary)

### Studio frontend

- `src/App.tsx`
- `src/components/StudioLayout.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/ProjectWorkspace.tsx`
- `src/pages/ProjectHub.tsx`
- `src/components/hub/ProjectThreadsPanel.tsx`
- `src/components/hub/NeedsAttentionRail.tsx`
- `src/components/DatasetsTab.tsx`
- `src/components/catalog/CatalogGrid.tsx`
- `src/pages/FormHome.tsx`
- `src/lib/api.ts`

### Mobile

- `app/(main)/_layout.tsx`
- `app/(main)/(desk)/index.tsx`
- `app/(main)/(desk)/journey/[projectId].tsx` → rename
- `app/(main)/(desk)/project/[id].tsx`
- `app/(main)/(desk)/project-forms/[projectId].tsx` → rename
- `app/(main)/(desk)/attendance/[projectId].tsx`
- `services/api.ts`

### Backend (Phase 4–5)

- `app/api/routes/projects.py`
- `app/api/routes/forms.py`
- `app/api/routes/threads.py`
- `app/models/project_task.py`
- `app/models/form.py`
- `app/models/project_catalog_item.py`
- `app/services/form_automation_service.py`
- `packages/types/src/index.ts`

### Tests to update

- `opla-backend/test_project_workspace_api.py`
- Studio e2e / any tab-deep-link tests
- Mobile navigation tests if present

---

## Risk matrix

| Change | User impact | Dev effort | Risk | Phase |
|--------|-------------|------------|------|-------|
| Label rename | Low | Low | Low | 1 |
| Tab restructure + redirects | Medium | Medium | Medium | 2 |
| Hub launcher links | Low | Low | Low | 2C |
| Mobile route rename | Medium | Medium | Medium | 2D |
| Attendance under Ops | Low | Medium | Low | 3 |
| API aliases | Low | Medium | Low | 4 |
| `journey_visit` enum rename | High | Medium | Medium | 5A |
| `catalog` form kind rename | High | High | High | 5B |
| Blueprint JSONB keys | High | Very high | Very high | 5E defer |

---

## Recommended sequencing (summary)

```
Phase 0  Prep + vocabulary constants
Phase 1  Labels everywhere          ← quick win, ship first
Phase 2  Nav + URL redirects        ← biggest UX alignment
Phase 3  Content placement          ← Ops/Design/Data structure
Phase 4  API aliases                ← optional, before DB
Phase 5  DB renames                 ← only 5A in near term; defer 5B/5E
```

**Do not block Phases 1–3 on database work.** Display “Directory” while tables remain `project_catalog_items`.

---

## Acceptance criteria (program complete)

- [ ] Studio project nav matches 8 areas: Hub, Tasks, Ops, Design, Messages, Data, Reports (+ org Members/Teams).
- [ ] No retired terms in primary nav (Threads, Catalog, Journey, Setup, Insights).
- [ ] Legacy bookmarks redirect for at least one release.
- [ ] Mobile agents see **Today** and **Tasks**, not Journey or Design.
- [ ] `PRODUCT_VOCABULARY.md` implementation map section updated to reflect shipped state.
- [ ] Decision log entry if Phase 5 items are deferred.

---

## Open decisions (resolve before Phase 2)

1. **Hub as tab vs route** — Keep `/projects/:id/hub` only, or add `?tab=hub` on workspace?
2. **Org “All Forms”** — Under **Design** at org level, or project-only?
3. **Audience & Assets** — Fold into Data/Settings or keep temporarily?
4. **Phase 5 scope** — Rename `journey_visit` in API in Q3, or display-map only for 6+ months?
5. **Mobile forms list** — Interim capture picker vs task-only entry (product call).

---

## Related docs

- [`PRODUCT_VOCABULARY.md`](./PRODUCT_VOCABULARY.md) — canonical terms
- [`Project-Command-Centre-Phases.md`](./Project-Command-Centre-Phases.md) — Hub build/cutover (align Phase 2C with final hub phase)
