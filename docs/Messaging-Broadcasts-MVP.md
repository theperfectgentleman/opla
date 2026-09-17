# Opla — Project Messaging / Field broadcasts (MVP fit)

**Status:** Knox-locked 17 Sep 2026 Accra night. Sent.dm keys deferred to tomorrow.  
**Owner:** Forge + Knox  
**Repo:** theperfectgentleman/opla

## Knox lock (17 Sep 2026 Accra) — CONFIRMED

**IA:** Extend project **Messages** (already in vocab + nav: hub|tasks|ops|design|data|messages). Do **not** invent a new top-level or bury it only in Studio Ops / org Settings. Optional later: thin Broadcast action on Hub that deep-links into Messages compose. Org Settings only for provider config (Sent.dm key, default WhatsApp sender) when keys wire.

**MVP:** Outbound broadcast + delivery log from Studio while a project is live. Compose → audience → Sent.dm WhatsApp utility first. Persist who/when/channel/status/error. Reuse general|team channels; add a broadcast mode if thread chat UX gets in the way — still under Messages.

**Later:** In-app inbox for agents, SMS fallback, two-way reply sync, templates library, cost meter.  
**Not MVP:** Full chat app, consumer DMs, replacing in-app threads.

**Audience:** Project members; Team (`kind=team` + `team_id`); role template if leads think in roles; saved group = Team for v1. Skip site as first-class people segment (Directory is outlets/SKUs).

**Reuse:** `users.phone`; existing message channels/messages/notifications + `ProjectThreadsPanel`; teams + team_members. Greenfield messaging adapter. No keys tonight — `SENT_DM_API_KEY` placeholder + mock provider until tomorrow.

**Tickets (Knox A–E):**
| Knox | Work | Key? |
|------|------|------|
| A | Spec/PRD slice (this doc) | No |
| B | Backend OutboundMessage + service + Sent stub + POST broadcast + list log | No |
| C | Studio Broadcast compose + audience (members/team/role) + log table | No |
| D | Org provider settings UI (env-only OK for Fri) | Later |
| E | Mock tests + one manual WA send once key lands | Yes |

Ship **B→C** first. No Sent.dm calls without a key. If Fri Opla 3hr locks to Messaging, **B+C** is the slice.

## What already exists

Product vocabulary already names Messages. Project shell includes messages. Backend: `project_message_channels`, `project_messages`, mention notifications. Studio: `ProjectThreadsPanel`. Phase 4 threads Done. Users have `phone`.

Gap is not “add Messages tab” — gap is **outbound field alerts** with an honest delivery log beside Threads.

## Technical shape (B)

Sibling tables (do not overload `project_messages` for phone fan-out): outbound/broadcast + recipients + thin opt-outs. `BroadcastService` + `MessagingProvider` protocol; Fake/mock + SentDm when keyed. Optional system note into General thread after send.

## Success (Accra feel)

Project lead opens Messages → Broadcast, picks Field Team A, sends “Site closed — do not visit today”, phones buzz on WhatsApp, Studio shows delivered/failed honestly.
