# Opla — Project Messaging / Field broadcasts (MVP fit)

**Status:** Spec locked in repo (OPLA-MSG-01 / ticket **A**). IA locked by Knox (17 Sep 2026).  
**Owner:** Forge  
**Repo:** theperfectgentleman/opla  
**Drive copy:** https://docs.google.com/document/d/1wWXBW0pQ8YB4gtyEv3LCOGeKFUYa7FTBHNz9_j1pGbU/edit

## Knox lock (17 Sep 2026 Accra)

Product IA and MVP boundaries for this programme:

1. **IA** — Extend project **Messages** (already in nav). Do **not** add a new top-level area or bury compose only under Ops or Settings. Optional later: **Hub** thin “Broadcast” deep-link into Messages compose. **Org Settings** is only for provider config when keys are wired.
2. **MVP** — Outbound broadcast + delivery log from Studio. **Sent.dm** WhatsApp **utility** first. Persist who / when / channel / status / error. Reuse `general` \| `team` channels; add a **broadcast mode** if thread chat UX gets in the way — still under Messages. **Later:** agent inbox, SMS fallback, two-way reply, templates, cost meter. **Not MVP:** full chat app, consumer DMs, replacing threads.
3. **Audience** — Project members; **Team** (`kind=team` + `team_id`); role template if easy; **saved group = Team for v1**. Do **not** use site as a people segment.
4. **Reuse** — `users.phone`, existing message tables/UI, teams. Greenfield adapter behind a messaging interface; `SENT_DM_API_KEY` placeholder + mock provider (no real keys in repo).
5. **Keys** — None tonight; provider wiring lands tomorrow / ticket **D**.
6. **Tickets (A–E)** — **A** spec (this PR). **B** backend: `OutboundMessage` + stub + POST/list. **C** Studio Broadcast UI. **D** org provider settings (env-only OK Friday). **E** mock tests + one WhatsApp smoke when key lands. **Ship B → C first.**

---

## 1. What we need

A Messaging section in Opla so managers can send messages to different groups or teams while running a project — managing field communications, not building another chat app.

Cost context (Ghana, ~500 msgs/month via Sent.dm utility): WhatsApp utility-style roughly GH₵110–150; marketing higher; pure SMS much more expensive (~GH₵1,800+).

## 2. What already exists (do not reinvent)

Product vocabulary already names **Messages**: Threads (in-app) + Broadcasts (outbound field alerts) — see [`PRODUCT_VOCABULARY.md`](./PRODUCT_VOCABULARY.md).

Project shell nav already includes: `hub | tasks | ops | design | data | messages`  
(see `docs/PRODUCT_VOCABULARY.md` and Studio `vocabulary.ts`).

Backend already has:

- `project_message_channels` (kind: `general` | `team`, optional `team_id`)
- `project_messages` (body, mentions, edit/delete window)
- `project_message_notifications` (in-app @mentions only)
- APIs under `/organizations/{org}/projects/{project}/messages…`

Studio already has `ProjectThreadsPanel` wired to those APIs. Command Centre Phase 4 “Proper threads” is **Done**. Users already have a `phone` field (email or phone/OTP auth).

The gap is **outbound field alerts** (WhatsApp first) with a delivery log beside existing in-app threads — not a new Messages tab.

## 3. Product fit (locked)

Keep one **Messages** area under the project. Two jobs:

**Threads (already live)**  
In-app conversation on General + per-team channels. Mentions notify in Inbox. No phone send.

**Broadcasts (MVP)**  
One-way field alerts from Studio; Sent.dm WhatsApp utility; honest delivery log (who, when, channel, status, error).

If thread chat UX conflicts with broadcast compose/history, add an explicit **broadcast mode** or sub-nav — still inside Messages, not Ops or Settings.

**UI sketch** (Studio → project → Messages):

- Sub-nav: **Threads | Broadcasts** (or equivalent broadcast mode)
- Broadcasts list: title, audience summary, channel (WhatsApp / later SMS), status counts, sent_at, sender
- Compose: audience picker → body → preview recipient count → Send → log row

**Hub (later):** optional deep-link from programme day view into Messages broadcast compose — Hub does not own compose.

**Mobile v1:** receive on WhatsApp only; no mobile compose in MVP.

## 4. Audience model (reuse existing data)

| Audience | MVP | Notes |
|----------|-----|--------|
| **Project members** | Yes | Users with project access and E.164 `users.phone` |
| **Team** | Yes | `project_message_channels` with `kind=team` + `team_id` / `team_members` |
| **Role template** | If easy | Optional stretch; not blocking |
| **Saved group** | v1 = Team | No new group entity; map “saved group” to a Team |
| **Site / location** | No | Not a people segment for broadcasts |

Hard rules: skip users with no E.164 phone (show skipped count before send); never silently drop; dedupe by user_id/phone; respect opt-outs when table exists.

## 5. MVP scope vs later

**MVP**

- Studio: outbound broadcast compose + delivery log / history
- Audiences: project members + Team
- Sent.dm WhatsApp utility via provider adapter; mock provider when `SENT_DM_API_KEY` unset
- Persist per-recipient: who, when, channel, status, error
- Managers / appropriate project roles only

**Later**

- Agent inbox, SMS fallback, two-way reply, templates, cost meter
- Hub broadcast deep-link
- Org Settings UI for provider (ticket **D** may start env-only)

**Not MVP**

- Full chat app, consumer DMs, replacing threads
- Two-way WhatsApp inbox, marketing/Audience merge, auto-broadcast on every thread message

## 6. Technical shape

- Reuse `users.phone`, `project_message_channels` (`general` \| `team`), teams, and existing thread UI where possible.
- Greenfield **messaging provider** interface; **Sent.dm** implementation + **mock provider** for dev/CI.
- Outbound persistence (names may evolve in **B**): e.g. `OutboundMessage` + recipient rows; do not overload `project_messages` for delivery state.
- Env placeholder only: `SENT_DM_API_KEY` (no keys in repo or committed `.env` samples).
- Optional post-send: system note in General thread (ticket **E** polish).

## 7. Tickets

| Letter | ID | Work | Provider key? | Order |
|--------|-----|------|---------------|--------|
| **A** | OPLA-MSG-01 | Spec lock in repo + vocab line | No | This PR |
| **B** | OPLA-MSG-02 | Backend: `OutboundMessage` + stub provider + POST/list APIs + tests | No | **Ship first** |
| **C** | OPLA-MSG-03 | Studio Broadcast UI (Threads \| Broadcasts) | No | **Ship second** (after B) |
| **D** | OPLA-MSG-04 | Org provider settings; env-only OK initially | Yes (when live) | After B/C or parallel Fri |
| **E** | OPLA-MSG-05 | Mock tests + one WhatsApp smoke when key lands; audit polish | Smoke needs key | After D |

## 8. Provider keys

No Sent.dm key tonight. Tickets **A**–**C** use the mock provider. Wire **D** when keys are available (deployment secrets only).

## 9. Success criteria

Project lead opens Messages → Broadcasts, picks Field Team A, sends “Site closed — do not visit today”, phones buzz on WhatsApp, Studio shows delivered/failed honestly.
