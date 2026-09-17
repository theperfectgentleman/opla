# Opla Messaging / Communications — codebase fit brief

**Date:** 2026-09-17 (updated per Forge alignment)  
**Repo:** [theperfectgentleman/opla](https://github.com/theperfectgentleman/opla) (`main`)  
**Method:** Read-only via `gh` API + local tree inspection. **No feature PR** from this work (product docs: **OPLA-MSG-01** launches separately).

**Product intent (Joseph / Forge):** Not a full chat app. Day-1 = **outbound compose + audience pick + delivery log**. WhatsApp-first via **Sent.dm** later; no Sent API keys in-repo unless provided.

**Forge mapping (canonical for build):** Project **Messages** nav already hosts **Phase 4 threads** (in-app channels). The **gap** is **Broadcasts** (WhatsApp / outbound) as a **sibling sub-view under Messages**, not a new top-level tab and not under Ops.

---

## 1. Monorepo layout

| Area | Path | Role |
|------|------|------|
| **API** | `opla-backend/` | FastAPI — Poetry, Alembic, PostgreSQL, optional Redis |
| **Studio** | `opla-frontend/apps/studio/` | Vite, React 19, React Router |
| **Mobile** | `opla-frontend/apps/mobile/` | Expo 54 — agent capture, attendance |
| **Shared packages** | `opla-frontend/packages/{types,logic,ui,config}/` | TurboRepo (`opla-frontend/package.json`) |
| **Docs** | `docs/` | Vocabulary, Command Centre phases |
| **Legacy (ignore)** | Root `apps/studio/` | Not active Studio |

**Routers** (`opla-backend/app/main.py`): includes `messages` (in-app threads + `message-notifications`), not outbound WhatsApp.

---

## 2. Studio nav today — Ops vs Messages

### Ops (unchanged)

| Item | Files | Route |
|------|-------|-------|
| Vocabulary | `opla-frontend/apps/studio/src/lib/vocabulary.ts` — `ProjectOpsSection`: `attendance`, `review` | |
| Submenu | `StudioLayout.tsx` — `projectOpsSectionSubItems`: Attendance, Review | |
| Page | `ProjectWorkspace.tsx` → `OpsAttendance.tsx`, `OpsReview.tsx` | `/projects/:projectId?tab=ops&section=attendance` (default Ops) or `section=review` |
| API client | `lib/opsApi.ts` | Same paths as mobile attendance/review |

### Messages — Phase 4 threads (exists)

| Item | Detail |
|------|--------|
| **Product phase** | `docs/Project-Command-Centre-Phases.md` — **Phase 4 — Proper threads** (status **Done**) |
| **Nav** | Project sidebar key `messages` — `StudioLayout.tsx`, label **Messages** |
| **Route** | `/projects/:projectId?tab=messages` (optional `channel` / legacy `thread` query for deep link) |
| **UI** | `ProjectWorkspace.tsx` → `components/hub/ProjectThreadsPanel.tsx` (also surfaced on `ProjectHub.tsx`) |
| **Backend** | `opla-backend/app/api/routes/messages.py` — channels (`general` \| `team`), channel messages, org-level `message-notifications` |
| **Tables** | `project_message_channels`, `project_messages`, `project_message_notifications` |

**Today:** Messages is a **single pane** (threads only). There is **no** Messages submenu yet; Forge adds **Threads \| Broadcasts** mirroring Ops → Attendance \| Review.

### Org shell (context)

`/dashboard?tab=inbox|projects|reports|members|audience|settings` — org **Audience** is still a placeholder (`Dashboard.tsx`), not the broadcast audience picker.

---

## 3. Domain model (audience reuse for Broadcasts)

| Entity | Model / API | Use for broadcasts |
|--------|-------------|-------------------|
| **Project** | `projects`, `/organizations/{org_id}/projects/...` | Scope all sends |
| **Teams** | `teams`, `team_members`; org team APIs | Audience segment |
| **Project access** | `project_access` (user \| team + roles/templates); `ProjectAccessService` | “Everyone on this project” expansion |
| **Org members** | `org_members`, `GET …/members`; Studio `useOrg().members` | Labels + picker |
| **Field workers** | `users.phone`, `users.email` | Delivery addresses |
| **Sites / outlets** | Directory forms + submissions (not a `sites` table); attendance `*_location_json` | **Not** recipients in v1 |

---

## 4. Phone / WhatsApp / SMS / email (current)

| Capability | Status |
|------------|--------|
| `users.phone` / `users.email` | Stored on user |
| OTP “SMS” | `otp_service.py` — **no provider**; dev OTP in response |
| Invitations | `email` delivery mode in DB; **no SMTP send** |
| In-app threads | Live (`messages.py`) |
| **WhatsApp / Sent.dm** | **Not implemented** |
| Secrets | `config.py`: JWT, DB, Redis, `GROQ_API_KEY` — **no** `SENT_DM_*` yet |

Do **not** store outbound WhatsApp payloads in `project_messages` (thread bodies). Broadcasts need a **separate** persistence and API namespace.

---

## 5. Recommended insertion — **Messages → Threads \| Broadcasts** (Forge)

### What already exists

- **Threads:** bidirectional, in-app, channel-based (General + per-team channels). Phase 4 complete.
- **Gap:** manager **outbound** compose, **audience pick**, **per-recipient delivery log**, provider hook for WhatsApp (Sent.dm later).

### Proposed UX (align with Ops submenu pattern)

| Sub-view | Key | Route (proposed) | UI (proposed) |
|----------|-----|------------------|---------------|
| **Threads** | `threads` | `?tab=messages&section=threads` (default when `tab=messages`) | Existing `ProjectThreadsPanel` |
| **Broadcasts** | `broadcasts` | `?tab=messages&section=broadcasts` | New `MessagesBroadcasts.tsx` (compose + log table) |

**Files to extend (implementation — not this PR):**

- `vocabulary.ts` — `ProjectMessagesSection`, `MESSAGES_SECTION_LABELS`, `resolveMessagesSection()`, `buildProjectSearchParams` for `messages` + `section`
- `StudioLayout.tsx` — `projectMessagesSectionSubItems` (parallel to Ops)
- `ProjectWorkspace.tsx` — branch on `messages` section
- `lib/broadcastsApi.ts` (or `messagesApi.ts` split) — **distinct** from thread methods in `lib/api.ts`

### Proposed API (new; do not overload thread routes)

Prefix: `/organizations/{org_id}/projects/{project_id}/broadcasts`

| Method | Purpose |
|--------|---------|
| `POST /broadcasts` | Create send (body, `channel`: `whatsapp` first; later `sms` \| `email`), audience spec |
| `GET /broadcasts` | Delivery log (campaign list) |
| `GET /broadcasts/{id}` | Campaign + per-recipient rows |
| Optional `GET /broadcasts/audience-preview` | Server expand teams / project accessors → users with contact flags |

**Data model (proposed):** `project_broadcasts` + `project_broadcast_deliveries` (names per OPLA-MSG-01).

**Provider:** `app/services/messaging/` — `StubProvider` day-1; `SentDmProvider` when `SENT_DM_API_KEY` is set (empty default in `config.py`).

**Permissions:** e.g. `project.broadcasts.send` in `permission_catalog.py`, or reuse edit-project gate consistent with thread post policy.

**Mobile:** Studio-first MVP; optional later link from Inbox / attention — not required day-1.

### Agent assessment — do we disagree with Threads \| Broadcasts under **Messages**?

**No — we align with Forge for implementation.** Rationale:

1. **Nav cohesion:** Phase 4 already anchored project communication under **Messages**; Broadcasts is the same persona (project lead → field), different **transport** (external vs in-app).
2. **Ops stay field-ops:** `PRODUCT_VOCABULARY.md` locks Ops to Attendance + Review; stuffing outbound WhatsApp there blurs “what’s happening in the field” vs “push a message out.”
3. **Implementation precedent:** Ops already uses a **tab + section** submenu; Messages should mirror that for Threads \| Broadcasts.

**Caveats (call out in OPLA-MSG-01, not blockers):**

| Risk | Mitigation |
|------|------------|
| Vocabulary says Messages = “threads” only | Update `docs/PRODUCT_VOCABULARY.md` in **OPLA-MSG-01**: Messages = Threads + Broadcasts |
| Backend route name `messages` = threads today | New **`/broadcasts`** router; never POST WhatsApp bodies to `message-channels/.../messages` |
| Users may confuse thread @mentions with WhatsApp | UI copy: “Broadcast” / “WhatsApp to agents”; separate delivery log |
| Org **Audience** nav sounds related | Keep org Audience as future sampling pools; broadcast audience = project teams/members/access |

**Alternative considered (rejected for product, not for lack of code fit):** **Ops → Communications** third subsection — good for supervisor persona, but splits “all project messaging” across **Messages** and **Ops** and fights existing Phase 4 placement. Prefer Forge layout unless Joseph reopens nav.

---

## 6. Atomic tickets (cloud agents; feature work after OPLA-MSG-01)

### MSG-BE-01 — Broadcast schema + stub provider + API

Alembic; models; `broadcasts_service.py`; `routes/broadcasts.py`; register in `main.py`; tests.

**Acceptance:** POST creates campaign + delivery rows; GET log; stub marks `simulated_sent`; no external HTTP without key.

### MSG-BE-02 — Audience resolver

Expand team / project_access / explicit `user_ids`; dedupe; flag missing `phone` for WhatsApp.

### MSG-FE-01 — Messages submenu + Broadcasts UI

`vocabulary.ts`, `StudioLayout.tsx`, `ProjectWorkspace.tsx`, `MessagesBroadcasts.tsx`, `broadcastsApi.ts`.

**Acceptance:** `?tab=messages&section=broadcasts`; compose + log; Threads default at `section=threads` or omit section.

### MSG-BE-03 — Sent.dm adapter shell

Factory + env var; no live send until Knox/Sent contract + keys.

### Docs

Owned by **OPLA-MSG-01** (separate docs PR) — vocabulary, AGENT.md, CHANGELOG; this artifact is engineering fit only.

---

## 7. Key file index

| Topic | Path |
|-------|------|
| Phase 4 threads | `docs/Project-Command-Centre-Phases.md` |
| Messages nav | `vocabulary.ts`, `StudioLayout.tsx`, `ProjectWorkspace.tsx` |
| Threads UI | `components/hub/ProjectThreadsPanel.tsx` |
| Thread API | `opla-backend/app/api/routes/messages.py` |
| Ops (reference submenu pattern) | `StudioLayout.tsx` (`projectOpsSectionSubItems`) |
| Audience data | `users`, `teams`, `project_access`, `ProjectAccessService` |
| Config / secrets | `opla-backend/app/core/config.py` |

---

**Stop line:** This file is the research/fit artifact only. Do not open a competing implementation PR here; follow **OPLA-MSG-01** for product docs, then MSG-BE/FE tickets for code.
