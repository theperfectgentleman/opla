# Changelog

All notable changes to Opla are documented here. Reconstruct older work from git; keep new PRs honest.

## [Unreleased]

### AI credits wallet (manual top-up)

- Each organisation has an AI credit balance, a ledger, and per-action costs. Alembic `032_ai_credits`. New organisations start at zero.
- Org admins and platform admins can add credits by hand (after MoMo or invoice) and change how many AI credits each survey action spends. Members can see the balance. No Paystack or card charge.
- Survey wizard interview, draft, and revise call `spend_or_reject`. At zero — or below that action’s cost — the API returns 402 and Studio shows a top-up message instead of calling the model. Compile and “generate into Opla” stay available. A failed model call refunds the spend.
- AI credits are named and stored separately from any future SMS costs.
- Proof: `cd opla-backend && poetry run python -m unittest test_ai_credits.py` and `cd opla-frontend/apps/studio && npm test`.
- Fresh-database Alembic can reach head again: `005` skips the teams tables `002` already creates, `5c4b43dbcbc6` ignores constraint renames that are already in place, `009` renames early enum types to the names the models use, and `023` no-ops when attendance foreign keys are already cascading. `poetry.lock` regenerates so current Poetry can install. Repo-root `.env.example` lists `DATABASE_URL`, `JWT_SECRET_KEY`, and `JWT_REFRESH_SECRET_KEY` (the app does not read `JWT_SECRET`). If npm skips devDependencies, install Studio with `npm install --include=dev`.

### Studio Ops Attendance + Review (live)

- Replaced `OpsAttendanceMock` / `OpsReviewMock` with live Studio Ops surfaces under a project (`Ops` → Attendance / Review).
- Attendance lists the day’s roster from `GET /organizations/{org}/projects/{id}/attendance`, and Studio check-in/out uses the same payloads as mobile (`check-in` / `check-out` + location).
- Review loads form submissions and `PATCH /submissions/{id}/review` (approve / reject + optional comment) — same contract as the API and mobile review permission.
- Proof: `cd opla-frontend/apps/studio && npm test`. Local path is Studio `:5173` + API `:8000` (`QUICK_START.md`).

### Mobile field pass (Expo FormRenderer, after PR #2)

- Cascade / directory options look up the parent by `id` *or* `bind`, so published answers keyed by `bind` still filter child dropdowns.
- `form_link` is navigational (no longer blocks Next when required) and copies params across id/bind. Studio can author the parameter map.
- Currency: Studio min/max keep `0` and decimals; Expo prefixes/suffixes; submit normalizes `decimal_places`.
- Auto-value: Studio can set `now()` / `today()` / `current_time()`; date pickers stamp a local calendar day; on-load runs after draft resume.
- Matrix numeric `0` displays; phone masks are not clipped by a shorter `maxLength`.
- Choice widgets consume options already resolved by FormRenderer (cascade + directory + FILTER_OPTIONS) so the three layers cannot fight.
- Proof: `cd opla-frontend/packages/logic && node --experimental-strip-types --test src/*.test.ts` (25 tests, including a market-activation blueprint pass). No Expo device in this environment.

### Mobile field parity (Expo FormRenderer)

- Mobile now keys responses by `bind` (falling back to `id`), matching Studio Simulator / published blueprints, so values, rules, and submit payloads no longer collide when `id` is missing.
- Studio `default_value`, `min`/`max`, `minLength`/`maxLength`, input masks, and `platforms` now apply on phone (render, validate, submit).
- Choice widgets (dropdown, radio, checkbox, multi-select) share `resolveFieldOptions` so directory-form and `cascade_options_map` options actually appear and clear when the parent changes.
- Matrix `dropdown` cells pick from authored options instead of a free-text box; numeric `0` is no longer treated as empty; dates use the local calendar day.
- Blueprint save/load round-trips currency, auto-value, cascade maps, lookup dataset, and `id` so those properties reach the player.


## [2026-09-06] — Agent memory files

- Added root `AGENT.md` (what this is, stage, hosts, status, B2B positioning, architecture, how to continue)
- Added this `CHANGELOG.md`
- Added root `README.md` with links to both

## [2026-07] — Studio command centre, vocabulary, reports

- Product vocabulary rename (catalog → directory, threads → messages, field visits); Alembic `031`
- Org shell: Inbox, Projects, Reports, Teams, Audience, Settings
- Project shell: Hub, Tasks, Ops, Design, Data, Messages (`vocabulary.ts`)
- `ProjectHub` at `/projects/:id/hub` (replaces `/pdemo`); attention feed, pinned analytics, form media, messages, `create_alert`
- Directory APIs/services; task `field_visit` + `scheduled_date`
- Org-level Reports portfolio + demo report bucket init
- Report canvas shell refactor; removed unused `ReportCanvasMock`

## [2026-07] — Analytics and AI survey

- Form datasets, analytics service, visual query builder, Graphic Walker lab
- Saved questions, dashboards, walker compute (DuckDB)
- AI survey routes + Groq markdown compiler (`ai_survey`)
- Root `.gitignore` so `.env` is not committed

## [2026-06] — Form builder, rules engine, mobile runtime

- Studio FormBuilder + RulesBuilder; centralized nested `rules` engine
- Simulator + public `/s/:slug` renderer
- Expo mobile FormRenderer, field widgets, lookup cache, AsyncStorage offline queue
- Market-activation field types (cascading, phone, time range, multi-select, formula, form link)

## [2026-02] — Foundation

- FastAPI scaffold, Alembic, JWT + OTP auth
- Organizations, projects, form versions, submissions
- TurboRepo Studio + mobile workspace
- Product docs under `docs/` (PRD, architecture, form blueprint)
