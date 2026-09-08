# AGENT.md — Opla

## What this is

Opla is the v2 rebuild of Opine: a B2B field-force platform for collecting and analysing data. Organisations design forms in a web Studio, publish JSON **blueprints**, and run them on mobile (agents) and public web (`/s/:slug`). The product is aimed at **FMCG market activation / sales tracking** and the same primitives for other businesses (retail audits, interviews, programmes).

Canonical nouns: Organisation → Inbox / Projects / Reports / Teams / Audience / Settings. Inside a project: Hub, Tasks, Ops, Design, Data, Messages. See [`docs/PRODUCT_VOCABULARY.md`](docs/PRODUCT_VOCABULARY.md).

## Stage

**updating** — targets FMCGs and other businesses. Core Studio + API + Expo player exist; public hosting, billing, and several Ops/Analysis surfaces are still incomplete.

## Repo / hosts

- GitHub: [`theperfectgentleman/opla`](https://github.com/theperfectgentleman/opla)
- Local Studio: `http://localhost:5173` (`opla-frontend/apps/studio`)
- Local API: `http://localhost:8000` — docs at `/api/docs` (`opla-backend`)
- Local mobile: Expo (`opla-frontend/apps/mobile`), bundle `com.opla.app`
- Planned public hosts (docs / env examples only — **not live in this repo**): `studio.opla.app`, `api.opla.app`, public forms `opla.app/s/{slug}`

## Current status

Grounded in code as of 2026-09-08:

- **Auth & orgs:** Email/password + phone OTP (Redis), JWT access/refresh, orgs, members, teams, invitations, permission catalog (`opla-backend/app/core/permission_catalog.py`).
- **Studio shell:** Inbox landing, Projects, Reports, Teams, Audience placeholder, Settings (`vocabulary.ts`, `Dashboard.tsx`). Project workspace tabs: Hub / Tasks / Ops / Design / Data / Messages.
- **Design:** Form builder (~26 field types in `@opla/types`), RulesBuilder, draft vs published versions, simulator, AI survey wizard (Groq). Market-activation field gaps (cascading, phone, time range, multi-select, currency, auto-timestamp, section skip, MSRP formula, centralized rules, form-link, JUMP_TO_SECTION) are marked implemented in [`docs/Gap Analysis — Market Activation Features.md`](docs/Gap%20Analysis%20—%20Market%20Activation%20Features.md).
- **Players:** Expo agent/pulse/yard routes; SDUI `FormRenderer` + field widgets keyed by `bind`; defaults / min-max / masks / platforms / cascade+directory options / matrix dropdown cells; AsyncStorage offline queue for submissions and attendance (not WatermelonDB). Public web form at `/s/:slug` (`PublicForm.tsx`). Shared helpers live in `@opla/logic` (`formFields.ts`).
- **Directory & capture:** Directory items (ex-catalog), directory forms, CSV import, lookups. Submissions with review status. Tasks including `field_visit`.
- **Ops APIs (live) / Studio Ops UI (mock):** Attendance check-in/out and submission review exist on the API and mobile; Studio still mounts `OpsAttendanceMock` / `OpsReviewMock` in `ProjectWorkspace.tsx`.
- **Hub:** `ProjectHub` at `/projects/:id/hub` — phases 0–5 in [`docs/Project-Command-Centre-Phases.md`](docs/Project-Command-Centre-Phases.md) marked Done (shell, pinned analytics, Needs Attention, form media, messages, `create_alert`). `/pdemo` redirects to Inbox. **Final cutover** (Hub as default project home) is not done — `/projects/:id` is still `ProjectWorkspace`.
- **Data / reports:** Form datasets, analytics query API, Graphic Walker lab, dashboard canvas, org-level Reports portfolio (demo bucket init). Spatial Analysis Lab exists but uses Accra **demo** polygons, not live geo.
- **Automation:** Form automation rules (`create_task`, `create_alert`) wired to Needs Attention.

Treat early docs (`docs/DEVELOPMENT_CHECKLIST.md`, `docs/DOCUMENTATION_COMPLETE.md`, `QUICK_START.md` “next phase”) as **historical**. They still say Phase 1–5 circa Feb 2026; the tree is far past that.

## Not yet / blockers

- **No public deploy** in-repo; planned `*.opla.app` hosts are placeholders.
- **No billing / subscriptions / metering** — no Stripe or seat-license code.
- Studio **Ops Attendance + Review** still mock; wire to existing project attendance + submission review APIs.
- **Audience** nav is a dashed placeholder. Org **Media** tab is a placeholder (project media APIs exist).
- **Maps in Analysis (Phase 6)** — clarifying questions unanswered; Leaflet lab is demo data.
- **ProjectHub cutover** — opening a project still lands on ProjectWorkspace, not Hub.
- **USSD / SMS player** — PRD surface; no gateway.
- **WatermelonDB + full sync engine** — PRD; mobile uses AsyncStorage queues.
- Separate **web-player** app — public forms live inside Studio, not `apps/web-player`.
- Design gaps still open: display/instruction blocks, show-cards, native “Other (specify)”, grouped matrix rows ([`docs/Design Capability — Gap Analysis & Implementation Plan.md`](docs/Design%20Capability%20—%20Gap%20Analysis%20%26%20Implementation%20Plan.md)).
- Three renderers (mobile, Simulator, PublicForm) can diverge — new widgets must land in all three.
- Ignore leftover root `apps/studio` (legacy empty scaffold). Active Studio is `opla-frontend/apps/studio`.

## Monetization / positioning

- **B2B only.** Buyers are FMCGs and other organisations (field programmes, market activation, retail / interview studies). Agents and public respondents are not the customer.
- **No prices in this repo.** Do not invent SKUs, seat fees, or “live” pricing.
- Default hypothesis (not implemented): org subscription or programme fee for Studio + agent seats; Reports as the stakeholder upsell; analytics / directory scale as expansion. Money from brands and operators, not from field agents.

## Architecture pointers

```
opla-backend/          FastAPI “Intelligence Layer” — Poetry, Alembic, PostgreSQL (+ JSONB blueprints/submissions), Redis OTP
  app/main.py          Routers: auth, orgs, projects, forms, submissions, roles, teams, reports, assets, messages, analytics, walker_compute, ai_survey
opla-frontend/         TurboRepo (Node ≥18)
  apps/studio          Vite + React 19 — builder, hub, analytics, reports
  apps/mobile          Expo 54 / RN 0.81 — agent capture, pulse public forms, attendance
  packages/types       Canonical FormBlueprint + field types (`@opla/types`)
  packages/logic       Shared validation helpers (thin today)
  packages/ui, config
docs/                  Product + build docs (vocabulary is the source of truth for names)
```

Blueprint shape: `meta` + `schema` + `ui` (sections/fields) + `logic` (legacy) + `rules` (nested engine). Evaluate both `logic` and `rules`. Local run: [`QUICK_START.md`](QUICK_START.md) or `./deploy.sh` (Studio :5173, API :8000, Expo).

## How to continue

1. Wire Studio Ops Attendance / Review to the live APIs (drop the mocks).
2. Answer Phase 6 map questions in `docs/Project-Command-Centre-Phases.md`, then plot real attendance/submission geo.
3. Cut over project home to `ProjectHub` when Ops is live.
4. Close remaining Design gaps only if a real FMCG/interview form is blocked (display/instruction blocks, show-cards, native Other-specify, grouped matrix rows). PublicForm still lags Simulator/mobile on matrix, lookup, object collection, multi-select, and form_link.
5. Keep product nouns from `docs/PRODUCT_VOCABULARY.md` — do not revive Catalog / Journey / Assets in UI copy.

## Rules for agents

- Update `CHANGELOG.md` on every meaningful PR
- Keep this file **Current status** + **How to continue** fresh
- Do not invent prices or fake live hosts
- Prefer Grok / Composer for cloud agents
- Ground claims in files; older `/docs` phase checklists are stale
