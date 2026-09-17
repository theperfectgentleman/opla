# Opla — Project Messaging / Field broadcasts (MVP fit)

**Status:** Spec locked in repo (OPLA-MSG-01). Product IA subject to final confirm.  
**Owner:** Forge  
**Repo:** theperfectgentleman/opla  
**Drive copy:** https://docs.google.com/document/d/1wWXBW0pQ8YB4gtyEv3LCOGeKFUYa7FTBHNz9_j1pGbU/edit

## 1. What we need

A Messaging section in Opla so managers can send messages to different groups or teams while running a project — managing field communications, not building another chat app.

Cost context (Ghana, ~500 msgs/month via a WhatsApp utility provider): WhatsApp utility-style roughly GH₵110–150; marketing higher; pure SMS much more expensive (~GH₵1,800+).

## 2. What already exists (do not reinvent)

Product vocabulary already names **Messages**: project threads and team communication (see [`PRODUCT_VOCABULARY.md`](./PRODUCT_VOCABULARY.md)).

Project shell nav already includes: `hub | tasks | ops | design | data | messages`  
(see `docs/PRODUCT_VOCABULARY.md` and Studio `vocabulary.ts`).

Backend already has:

- `project_message_channels` (kind: `general` | `team`, optional `team_id`)
- `project_messages` (body, mentions, edit/delete window)
- `project_message_notifications` (in-app @mentions only)
- APIs under `/organizations/{org}/projects/{project}/messages…`

Studio already has `ProjectThreadsPanel` wired to those APIs. Command Centre Phase 4 “Proper threads” is **Done**. Users already have a `phone` field (email or phone/OTP auth).

So the gap is **not** “add a Messages tab.” The gap is: **outbound field alerts** (WhatsApp / later SMS) to teams and groups, with a delivery log — sitting beside the existing in-app threads.

## 3. Recommended product fit (pending IA confirm)

Keep one **Messages** area. Two clear jobs inside it:

**A) Threads (already live)**  
In-app conversation on General + per-team channels. Mentions notify in Inbox. No phone send.

**B) Broadcasts (new MVP)**  
One-way field alerts to an audience, delivered on WhatsApp first (provider adapter), with an honest delivery log in Studio.

Why not a new top-level nav?

- Vocabulary already owns Messages for project team communication.
- Ops stays Attendance + Review (field workflows), not a second inbox.
- Hub stays read-oriented; it can deep-link “last broadcast” later, not own compose.

Why not only Ops?

- Ops is “what’s happening in the field right now” (attendance/review).
- Broadcasts are “tell the field something” — communication, same family as Threads.

**UI sketch** (Studio → project → Messages):

- Sub-nav: **Threads | Broadcasts**
- Broadcasts list: title, audience summary, channel (WhatsApp/SMS), status counts, sent_at, sender
- Compose: audience picker → template/body → preview recipient count → Send → log row

**Mobile v1:** receive only (WhatsApp on the phone). No mobile compose in MVP unless product pushes for supervisor-on-phone send.

## 4. Audience model (reuse existing data)

1. **Whole project** — all users with project access who have a phone on their user record  
2. **One team** — `team_members` for a project team  
3. **Role template** (optional v1.1) — later if not easy  
4. **Saved group** — later; do not invent a new group entity in MVP  

Hard rules: skip users with no E.164 phone (show skipped count before send); never silently drop; dedupe by user_id/phone; respect opt-outs when table exists.

## 5. MVP scope vs later

**MVP:** Studio Broadcasts compose + history; audiences project + team; WhatsApp via provider adapter; delivery log; managers only; FakeProvider when provider keys are missing.

**Out:** two-way WhatsApp inbox, marketing/Audience merge, SMS (adapter ready later), agent mobile compose, auto-broadcast on every thread message.

## 6. Technical shape

Sibling tables (not overload `project_messages`): `project_broadcasts`, `project_broadcast_recipients`, thin `messaging_opt_outs`.  
`BroadcastService` + `MessagingProvider` protocol; concrete provider + `FakeProvider` for dev/tests.  
Optional: system note into General thread after send.

## 7. Tickets

| ID | Work | Needs provider key? |
|----|------|---------------------|
| OPLA-MSG-01 | Spec lock in repo + vocab line | No |
| OPLA-MSG-02 | Data model + APIs + FakeProvider + tests | No |
| OPLA-MSG-03 | Studio Threads \| Broadcasts UI | No |
| OPLA-MSG-04 | Live WhatsApp provider + deploy secrets | Yes |
| OPLA-MSG-05 | Audit polish (thread note, failures, opt-out) | No |

## 8. Provider keys

OPLA-MSG-01 through OPLA-MSG-03 proceed with FakeProvider. Live provider wiring is OPLA-MSG-04 (secrets in deployment config only — not committed to the repo).

## 9. Success criteria

Project lead opens Messages → Broadcasts, picks Field Team A, sends “Site closed — do not visit today”, phones buzz on WhatsApp, Studio shows delivered/failed honestly.
