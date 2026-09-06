# Changelog

All notable changes to Opla are documented here. Reconstruct older work from git; keep new PRs honest.

## [Unreleased]

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
