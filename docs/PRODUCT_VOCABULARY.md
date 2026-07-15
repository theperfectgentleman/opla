# Opla Product Vocabulary

**Status:** Active (locked)  
**Last updated:** July 2026

This document defines the canonical product nouns and hierarchy for Opla. Use these terms in UI copy, docs, and positioning. Internal code names (e.g. `catalog`, `journey_visit`) may differ until nav and routes are migrated.

---

## Hierarchy

```
Organisation
├── Inbox              (personal hub — default after login; needs attention across programmes)
├── Projects           (portfolio)
├── Reports            (stakeholder boards — Team grants; combine project sources)
├── Teams / Members & Roles
├── Audience
├── Settings
└── Projects (entered)
      ├── Hub              (programme day: today, alerts, KPIs)
      ├── Tasks            (+ Today, assignments)
      ├── Ops
      │     ├── Attendance
      │     └── Review
      ├── Design           (forms, automations)
      ├── Messages         (threads)
      └── Data
            ├── Directory  (reference / master data — shops, outlets, SKUs; was “catalog”)
            ├── Datasets   (derived from capture)
            ├── Analysis   (explore, charts, maps)
            └── Media      (files, links, field references; was “assets”)
```

**Navigation:** Org sidebar is **Inbox**, Projects, **Reports**, Teams, Audience, Settings. After opening a project, the sidebar is Hub / Tasks / Ops / Design / Data / Messages (field work). Reports stay at org so seniors can combine sources without project Ops access.

**Inbox vs project Ops:** **Inbox** is person-scoped attention across programmes. **Ops** exists only under a project (Attendance + Review). Project **Hub** is the programme day view.

**Reports vs Projects:** **Projects** are for people who *do* the work. **Reports** are stakeholder buckets (Team grants: viewer / commenter / explorer / owner) for people who *watch and steer* — see, comment, ask, explore curated analytics. Membership is independent of project membership.

**Directory vs Forms:** Directories are shared reference databases under **Data**. Forms (Design) can **look up** directory records, and automations can **push** new capture into a directory (e.g. enumeration → outlets directory; later sales forms look up those shops).

---

## Locked terms

| Term | Definition | Primary audience |
|------|------------|------------------|
| **Organisation** | Multi-tenant account: branding, people, projects | Admins |
| **Members & Roles** | People in the org and permission templates | Admins |
| **Teams** | Groups of members for assignment and access | Admins, managers |
| **Inbox** | Personal hub after login (and header bell): cross-project notifications / items that need attention | Managers, supervisors |
| **Project** | Time-bounded field operation: targets, team, capture, tasks | Managers |
| **Hub** | Read-oriented project command centre (today, alerts, KPIs) | Managers |
| **Tasks** | Assigned work; agents use **Today** as the primary queue | Agents, managers |
| **Ops** | Project-scoped field workflows: attendance and submission review | Agents, supervisors |
| **Design** | Design-time configuration: forms and automations | Studio admins |
| **Messages** | Project threads and team communication | All project members |
| **Data** | Everything you maintain or explore from project data | Admins, analysts |
| **Directory** | Reference / master data (outlets, products, etc.). Forms **consume** it (lookup) or **contribute** to it (via automation) | Admins; agents select records in capture |
| **Datasets** | Structured tables derived from form submissions | Analysts |
| **Analysis** | Interactive exploration (dashboards, questions, maps) | Analysts, managers |
| **Media** | Project files, links, images, audio for field reference | Admins, agents (read) |
| **Reports** | Org-level stakeholder boards: Team grants; combine project sources; view / comment / explore (not field Ops) | Senior managers, sponsors |
| **Audience** | Sampling pools and segments (org-level; name may change) | Campaign leads |

---

## Design vs Ops

| | **Design** | **Ops** |
|---|------------|---------|
| **When** | Before / between field runs | During field work |
| **Contains** | Forms, automations | Attendance, review (project only) |
| **Question** | “How should this project capture and react?” | “What’s happening in the field right now?” |

**Forms** and **automations** are children of **Design**. **Directory** lives under **Data** — forms look it up; automations can write into it.

---

## Hub vs Tasks (Today)

Both can show “today” — different jobs:

| Surface | Audience | Job |
|---------|----------|-----|
| **Hub → Today** | Managers | Pulse: coverage, exceptions, KPIs |
| **Tasks → Today** | Agents | Queue: what to do next |

Same underlying task data; Hub summarizes, Tasks executes.

---

## Retired or internal-only terms

| Do not use (user-facing) | Use instead |
|--------------------------|-------------|
| Journey | Tasks → Today |
| Activity (as entity) | Task type |
| Setup | Design |
| Insights (as nav) | Data → Analysis |
| Catalog (user-facing) | Directory |
| Assets (user-facing) | Data → Media |
| Outlet / store (platform-wide) | Directory record label (org-configurable) |
| Survey / respondent (field-ops positioning) | Agent, capture, record |

**Submissions** remain accurate internally and in APIs. Agents complete **tasks**; managers **review** in Ops.

---

## Implementation status (July 2026)

Migration **`031_vocab_rename`** applied. Breaking renames shipped:

| Area | Shipped |
|------|---------|
| DB | `field_visit`, `scheduled_date`, `directory` form kind, `project_directory_items`, `project_message_*` tables |
| API | `/directory-*`, `/messages`, `/message-channels`, `/message-notifications` |
| Studio nav | Org: `inbox \| projects \| reports \| members \| audience \| settings`. Project: `hub \| tasks \| ops \| design \| data \| messages` (`vocabulary.ts`) |
| Mobile | `(agent)` / `(pulse)` route groups; `tasks/today`, `capture`; legacy `(desk)` redirects |
| Types | `directory_*` blueprint keys, `FormArea` `pulse \| agent` |

**Follow-ups:** Rename `ProjectThreadsPanel` → `ProjectMessagesPanel` (cosmetic); remove orphaned `catalog*` files if any remain on disk; embed Analysis under project Data tab fully.

See **[`VOCABULARY_MIGRATION_PLAN.md`](./VOCABULARY_MIGRATION_PLAN.md)** for phase checklist.

---

## One-line positioning

> Organisations start in **Inbox**. **Projects** are ground work. **Reports** are stakeholder boards (Team grants). Inside a project: Hub, Tasks, Ops, Design, Data, Messages.

---

## Implementation

Phases 0–3 and DB migration **031** are largely complete. See checklist below and [`PRODUCT_VOCABULARY.md`](./PRODUCT_VOCABULARY.md) implementation status.
