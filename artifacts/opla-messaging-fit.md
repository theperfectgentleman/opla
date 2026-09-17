# Opla Messaging / Communications — codebase fit brief

**Date:** 2026-09-17  
**Repo:** [theperfectgentleman/opla](https://github.com/theperfectgentleman/opla) (`main`)  
**Method:** Read-only via `gh` API + local tree inspection (VM already had a checkout). No feature PR.

**Product intent (Joseph / Forge):** Not a full chat app. Day-1 = **outbound compose + audience pick + delivery log**. WhatsApp-first via **Sent.dm** later; no Sent API keys in-repo tonight unless provided.

---

## 1. Monorepo layout

| Area | Path | Role |
|------|------|------|
| **API** | `opla-backend/` | FastAPI “Intelligence Layer” — Poetry, Alembic, PostgreSQL, optional Redis |
| **Studio** | `opla-frontend/apps/studio/` | Vite, React 19, React Router — builder, hub, ops, reports |
| **Mobile** | `opla-frontend/apps/mobile/` | Expo 54 — agent capture, attendance, pulse |
| **Shared packages** | `opla-frontend/packages/{types,logic,ui,config}/` | `@opla/types`, `@opla/logic`, etc. (TurboRepo root: `opla-frontend/package.json`) |
| **Docs** | `docs/` | Product vocabulary, roadmaps |
| **Legacy (ignore)** | Root `apps/studio/` | Empty scaffold; README says active Studio is under `opla-frontend` |

**Run surfaces:** API `localhost:8000` (`/api/v1`, OpenAPI `/api/docs`); Studio `localhost:5173`; `VITE_API_URL` → API base.

**Routers registered** (`opla-backend/app/main.py`): `auth`, `organizations`, `projects`, `forms`, `submissions`, `roles`, `teams`, `section_templates`, `reports`, `assets`, `messages`, `analytics`, `walker_compute`, `ai_survey`.

---

## 2. Studio Ops nav today (exact paths & routes)

### Canonical vocabulary

- **Types / labels:** `opla-frontend/apps/studio/src/lib/vocabulary.ts`
  - `ProjectOpsSection`: `'overview' | 'attendance' | 'review'`
  - `OPS_SECTION_LABELS`: Overview, Attendance, Review
  - `PROJECT_SHELL_NAV`: hub, tasks, ops, design, data, messages

### Sidebar UI

- **Project Ops submenu items:** `opla-frontend/apps/studio/src/components/StudioLayout.tsx`
  - `projectOpsSectionSubItems`: **Attendance**, **Review** (keys `attendance`, `review`)
  - Ops parent nav key: `ops` (label **Ops**)

### Routes

| Destination | URL pattern |
|-------------|-------------|
| Org shell | `/dashboard?tab={inbox\|projects\|reports\|members\|audience\|settings}` (+ `section` for members/data/design) |
| Project Hub | `/projects/:projectId/hub` |
| Project workspace | `/projects/:projectId?tab=…&section=…&view=…` |
| **Ops → Attendance** | `/projects/:projectId?tab=ops&section=attendance` (default if `tab=ops` with no section) |
| **Ops → Review** | `/projects/:projectId?tab=ops&section=review` or legacy `?tab=ops&view=review` / `?tab=review` |
| Ops Overview (redirect) | `section=overview` → redirected to Hub (`ProjectWorkspace.tsx`) |

**Helpers:** `projectNavHref()`, `resolveOpsSection()`, `resolveLegacyProjectTab()` in `vocabulary.ts`.

### Page wiring

- **Shell + tab rendering:** `opla-frontend/apps/studio/src/pages/ProjectWorkspace.tsx`
  - `activeTab === 'ops' && opsView === 'attendance'` → `components/ops/OpsAttendance.tsx`
  - `activeTab === 'ops' && opsView === 'review'` → `components/ops/OpsReview.tsx`
- **API client (Ops):** `opla-frontend/apps/studio/src/lib/opsApi.ts` (attendance + submission review; mirrors mobile paths)
- **App router:** `opla-frontend/apps/studio/src/App.tsx` — project route is `/projects/:projectId` → `ProjectWorkspace`

**Related (not Ops):** In-app **Messages** = project tab `tab=messages` → `ProjectThreadsPanel` (thread channels, not SMS/WhatsApp).

---

## 3. Domain model: projects, teams, roles, sites, field workers

### Projects

- **Table / model:** `projects` — `opla-backend/app/models/project.py`
- **API:** `opla-backend/app/api/routes/projects.py` under prefix `/organizations/{org_id}/projects`
  - CRUD, status, collection window, expectations
  - `/access`, `/tasks`, `/attendance`, `/directory-items`, `/attention`, `/pinned-analytics`, `/media`, etc.

### Teams & org membership

| Concept | Table | Model | API |
|---------|-------|-------|-----|
| Org teams | `teams` | `app/models/team.py` | `GET/POST /organizations/{org_id}/teams`, members via org + `teams.py` |
| Team membership | `team_members` | `app/models/team_member.py` | `POST /organizations/{org_id}/teams/{team_id}/members/{user_id}`, `GET …/members` |
| Org membership | `org_members` | `app/models/org_member.py` | `GET /organizations/{org_id}/members` |
| Invitations | `invitations` | `app/models/invitation.py` | `/organizations/{org_id}/invitations/*`, accept at `/organizations/invitations/accept` |

Studio loads **org `members`** via `useOrg()` (`OrgContext`) for labels in Ops/Tasks; project **access rules** via `projectAPI.listAccess`.

### Roles (two layers)

1. **Org roles (RBAC templates):** `org_roles`, `org_role_assignments` — `app/models/org_role.py`, routes in `organizations.py` (`/roles`, `/roles/catalog`, `/roles/assignments`).
2. **Project access:** `project_access` — polymorphic `accessor_type` `user` \| `team`, optional `project_role` (`collector` \| `analyst` \| `editor`) or `project_role_templates` — `app/models/project_access.py`, `ProjectAccessService` in `app/services/project_access_service.py`.
   - Effective permissions merge org roles + direct/team project access (`permission_catalog.py`).

### Field workers (agents)

- **Users:** `users` — `phone`, `email`, `full_name` (`app/models/user.py`). Primary identity for outbound contact.
- **Assignment surfaces:** project access (user/team), tasks (`assigned_accessor_id` + `assigned_accessor_type`), attendance (`project_attendance_records.user_id`).
- **Tasks / field visits:** `project_tasks` with `kind` `general` \| `field_visit` — `app/models/project_task.py`; API on projects router (`/tasks`, `/tasks/my-day`).

### Sites / locations (no dedicated “sites” table)

| Mechanism | Purpose |
|-----------|---------|
| **Directory (reference data)** | **Data → Directory:** directory-kind **forms** + submissions; legacy SKU table `project_directory_items` still has API (`/directory-items`) but product term is Directory (shops/outlets via form capture). Models: `form.py` (`FormKind.DIRECTORY`), `project_directory_service.py`, Studio `components/directory/*`. |
| **Attendance geo** | `project_attendance_records` — `check_in_location_json` / `check_out_location_json` (lat/lng/label) — `project_attendance.py` |
| **Capture GPS** | Form field types `gps_*` in blueprints (`@opla/types`) |
| **Field visit context** | `project_tasks.context_json` (JSONB) for visit metadata |

**Audience for messaging MVP:** resolve recipients from **org members** + **team rosters** + **project access** (expand team accessors to user IDs). Directory rows are **outlets**, not message recipients, unless product later adds “message all agents assigned to outlet X” (not modeled today).

---

## 4. Existing phone / WhatsApp / SMS / email / notifications

| Capability | Status | Location |
|------------|--------|----------|
| **Phone on user profile** | Stored, unique indexed | `users.phone` |
| **Phone OTP auth** | Redis-backed; **no real SMS** | `app/services/otp_service.py` — `_send_sms` is `pass`; dev returns OTP in response / `123456` bypass |
| **Email/password auth** | Yes | `app/api/routes/auth.py` |
| **Invitations** | DB + token/link; **no outbound email sender** | `invitation_service.py` — `delivery_mode` includes `email` but no SMTP integration |
| **In-app message notifications** | DB only (@mentions → `project_message_notifications`) | `messages.py`, `project_message_service.py` |
| **In-app project threads** | Channels `general` \| `team` | `project_message_channels`, `project_messages` |
| **WhatsApp / Sent.dm / Twilio / SendGrid** | **Not present** | PRD mentions SMS/USSD (`docs/Project Opla_PRD.md`); no implementation |
| **Secrets pattern** | Repo-root `.env` via Pydantic `Settings` | `opla-backend/app/core/config.py`: `DATABASE_URL`, `JWT_*`, `REDIS_URL`, `GROQ_API_KEY`, `ENVIRONMENT` — **no** messaging provider keys |

Form-level `phone_input` is capture/validation only (`@opla/logic/formFields.ts`), not outbound messaging.

---

## 5. Recommended insertion point — Communications MVP

### Keep separate from **Messages**

- **Messages** = threaded, in-app, bidirectional chat (`ProjectThreadsPanel`, `project_message_*` tables).
- **Communications** (Joseph) = **manager → field outbound** + **delivery log** + external channel later.

### Recommended: **Project Ops → Communications** (third Ops subsection)

**Why**

- Same persona and permissions as Attendance/Review (project leads, supervisors).
- Reuses **project-scoped** context and existing Studio patterns (`OpsAttendance` / `opsApi.ts`).
- Audience picker can mirror task assignment UX (members + teams + project access) already in `ProjectWorkspace.tsx`.
- Avoids conflating with org **Audience** placeholder (`Dashboard.tsx` — empty “Audience Pool Management”) which is org-wide sampling, not operational broadcast.
- Aligns with “during field work” without building a chat UI.

**Nav / route (proposed)**

- Extend `ProjectOpsSection` + `projectOpsSectionSubItems` with `communications`.
- URL: `/projects/:projectId?tab=ops&section=communications`
- Component: `opla-frontend/apps/studio/src/components/ops/OpsCommunications.tsx` (new)
- Client module: `communicationsApi.ts` or extend `opsApi.ts` if tiny.

**API surface (proposed, new router or `projects` sub-resource)**

Prefix: `/organizations/{org_id}/projects/{project_id}/communications`

| Endpoint | Purpose |
|----------|---------|
| `POST /communications` | Create broadcast (body, channel enum `whatsapp` \| `sms` \| `email`, audience spec) |
| `GET /communications` | List sends (delivery log) |
| `GET /communications/{id}` | Detail + per-recipient rows |
| `GET /communications/audience-options` | Optional: server-side expand teams → users with `phone`/`email` flags |

**Data model (proposed)**

- `project_communications` (campaign row: project_id, author_id, body, channel, status, created_at)
- `project_communication_deliveries` (communication_id, user_id, address, status, provider_id, error, sent_at)

**Provider abstraction**

- `app/services/messaging/` with `MessagingProvider` protocol; day-1 **`StubProvider`** (queued/sent_simulated) + structured log; **`SentDmProvider`** stub raising clear error until `SENT_DM_API_KEY` in settings.

**Permissions**

- Reuse `ProjectAccessService.ensure_can_edit_project` or a new `project.communications.send` key in `permission_catalog.py` (mirror who can create tasks/alerts).

**Mobile**

- MVP can be Studio-only; optional later: Inbox item or push when delivery log ties to `project_attention` / notifications.

**Vocabulary doc**

- Update `docs/PRODUCT_VOCABULARY.md` Ops children: Attendance, Review, **Communications** (outbound broadcasts).

---

## 6. Suggested atomic tickets (cloud agents)

### Ticket 1 — Backend schema + stub send + list log

**Files:** Alembic migration; `app/models/project_communication.py`; `app/services/communications_service.py`; `app/api/schemas/communication.py`; `app/api/routes/communications.py` (or add to `projects.py`); register in `app/main.py`; `app/core/config.py` optional `SENT_DM_API_KEY` (empty default).

**Acceptance**

- `POST` creates a communication and N delivery rows for resolved recipients (user/team/project_access spec).
- `GET` returns paginated log for project.
- No external HTTP calls; deliveries marked `pending` → `simulated_sent` in dev.
- Permission denied without project edit/send permission.
- Tests in `test_project_workspace_api.py` style or new `test_communications_api.py`.

### Ticket 2 — Audience resolution service

**Files:** `app/services/communication_audience_service.py` (expand teams, dedupe users, filter `users.phone`/`email` by channel).

**Acceptance**

- Given audience `{ "type": "team", "team_id": "…" }` or `{ "type": "project_accessors" }` or explicit `user_ids`, returns canonical recipient list with contact availability flags.
- Unit tests for team expansion + empty phone handling.

### Ticket 3 — Studio Ops nav + compose UI

**Files:** `vocabulary.ts` (`communications` ops section); `StudioLayout.tsx` submenu; `ProjectWorkspace.tsx` tab branch; `components/ops/OpsCommunications.tsx`; `lib/communicationsApi.ts`.

**Acceptance**

- Nav shows **Communications** under Ops; route `?tab=ops&section=communications`.
- Compose: message body, channel selector (WhatsApp default disabled with “provider not configured” until stub allows), multi-select audience (teams + individuals from org members / project access).
- Submit calls API; table shows delivery log with status columns.
- Matches Ops visual patterns (Attendance/Review cards).

### Ticket 4 — Sent.dm provider interface (no live keys)

**Files:** `app/services/messaging/sent_dm_provider.py`; wire in service factory when `SENT_DM_API_KEY` set.

**Acceptance**

- Factory selects stub when key missing; when key present, provider methods exist but can `NotImplementedError` or dry-run until Sent API contract is confirmed.
- Document env var in `QUICK_START.md` / `AGENT.md` only (no secrets committed).

### Ticket 5 — Product vocabulary + AGENT.md status line

**Files:** `docs/PRODUCT_VOCABULARY.md`, `AGENT.md`, `CHANGELOG.md` entry.

**Acceptance**

- Ops lists Communications; distinguishes **Messages** (threads) vs **Communications** (outbound log).
- No UI copy promises live WhatsApp until provider ticket is done.

---

## Parallel consultation notes (Knox)

- **Knox alignment:** Confirm Sent.dm payload shape (template vs free text, per-country WhatsApp rules) before Ticket 4 leaves stub.
- **Joseph constraints satisfied:** MVP is outbound + audience + log; WhatsApp path is pluggable; no Sent keys required for Tickets 1–3.
- **Existing reuse:** `users.phone` / `users.email`, `teams` + `team_members`, `project_access`, `ProjectAccessService`, Studio Ops shell — **do not** extend `project_messages` for SMS.

---

## Key file index (quick links)

| Topic | Path |
|-------|------|
| Ops nav labels | `opla-frontend/apps/studio/src/lib/vocabulary.ts` |
| Ops submenu | `opla-frontend/apps/studio/src/components/StudioLayout.tsx` |
| Ops pages | `opla-frontend/apps/studio/src/pages/ProjectWorkspace.tsx` |
| Attendance API client | `opla-frontend/apps/studio/src/lib/opsApi.ts` |
| Project API | `opla-backend/app/api/routes/projects.py` |
| Threads / in-app messages | `opla-backend/app/api/routes/messages.py` |
| Permissions | `opla-backend/app/core/permission_catalog.py` |
| Config / secrets | `opla-backend/app/core/config.py` |
| Product hierarchy | `docs/PRODUCT_VOCABULARY.md` |
