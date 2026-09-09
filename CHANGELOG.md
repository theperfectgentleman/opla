# Changelog

All notable changes to Opla are documented here. Reconstruct older work from git; keep new PRs honest.

## [Unreleased]

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
