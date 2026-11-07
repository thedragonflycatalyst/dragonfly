# Coach app: implementation plan for remaining features (priority order)

Owner: Phyllis (Coach app) · Written: 2026-11-07 · Status: **All planned features coded (2026-11-07) and in PRs #42–#49, waiting for testing/merge (Dave) and owner approvals. Owner questions still open (defaults applied).**
Companion docs: `client-engagement.md` (concepts), `../2026-11-06/coach-roadmap-and-intake.md` (roadmap, costs, risks), `../2026-11-06/credentials-and-challenges-directory.md` (Step 8).

This file is the single source of truth for what remains and how to build it. Any agent taking over: read this, `CLAUDE.md`, the checkpoint at the bottom, and the newest comments on PR #41 and on the Agent Hub messages to `phyllis` before touching code.

## Rules for every step

- Definition of done: tests including failure and edge cases; **RLS positive and negative tests for every new table and policy** (`supabase/tests/rls_*.test.sql`, run with the local Postgres runner); reviewed by Lara (new tables) and one other agent; verified on Android and web; privacy inventory updated; implementation record appended to this file; owner change log line.
- Migrations: new file in `supabase/migrations/` (timestamped), additive (expand and contract). **Applying to production needs the owner's explicit approval.** Edge function deploys to production also need owner approval.
- No secrets in code. Twilio (or any texting service) account, keys and carrier registration are **owner-only**.
- No health details in any text, notification, email or AI prompt beyond what the feature needs and the client consented to.
- Synthetic test data only. Never the owner's real clients or real channels.
- Shared tables with the website or scheduler (bookings, payments, packages): message Charlie on the hub **before** changing them, and record the contract.
- Small PRs, one per sub-step below, branched from current `main`.

## Existing building blocks (reuse, don't duplicate)

| Need | Already in the schema | Notes |
| --- | --- | --- |
| Appointments | `coach_bookings` (recurring via `repeat`; cancelled occurrences in `skipped date[]`; done in `done date[]`; `booked_by`) | A cancelled slot = (booking_id, occurrence date) |
| Trainer working hours | `coach_availability` (trainer weekday windows) | Client availability is new |
| Workout history | `coach_logs` (`entries jsonb`, `performed_at`, `rpe`, `note`, `source`) | Source for summaries and PRs |
| Packages / credits | `coach_packages`, `coach_client_packages` (credits) | Filled slots and group events consume credits as today |
| Group training | `coach_events`, `coach_event_signups` (booked / waitlist / cancelled, paid, attended) | Group invites reuse these |
| Surveys | `coach_forms`, `coach_form_requests` (questions, answers, status) | Add kind `survey` |
| Broadcast messages | `coach_broadcasts` | Superseded by the outbox in Step 4 (keep, migrate later) |
| Manual texting | `app/src/lib/contact.ts` (opens phone's Messages / WhatsApp with prefilled text) | Becomes the `manual` channel in Step 4 |
| Scheduled jobs | pg_cron pattern from `20261106060000_coach_busy_autorefresh.sql` | Reuse for the outbox runner |

## Step 0 — Finish coded work and commitments (now → Nov 20)

No owner input needed except where marked.

1. **Unblock the Lapis/workout stack.** Root cause (Dave, hub): `src/app/session.tsx(2,30): error TS2307: Cannot find module '@react-navigation/native'`, introduced at PR #19 (`feature/lapis-navigation-recovery-20261104`). Fix once at #19: use `expo-router`'s `useFocusEffect` / `useIsFocused` re-exports, or add `@react-navigation/native` to `app/package.json` with lockfile. Then merge main into stacked PRs #11–#29, #32 in order as parents merge. PR #8 had a typecheck failure (likely the same). PRs #6/#7 need main merged (conflicts). Infra failures (deleteDir, workspace lock, 90-min timeouts) are not code: re-run.
2. **Launch hardening PRs:** #35 refund/void (coach-003 part 1), #37 Health Connect consent/export (coach-004), #38 crash reports without personal data (coach-005), #39 accessibility (coach-006), #40 progress-sharing/goal opt-in (coach-010/011). Get Jenkins green on the exact head, independent review, merge one at a time, merge main into the others.
3. **Receipts end to end (Nov 13):** blocked on Charlie's CORS change for `https://thedragonflycatalyst.github.io` on `/api/account/coach-adjust`. Then the live test **(owner approval):** test trainer + test client using the owner's inbox, $1 recorded cash payment, void, confirm receipt on web and Android.
4. **coach-pay redeploy (owner approval):** stores the trainer's refund reason. Also fix (Will, hub): a Feb 17 $11.11 payment refunded in Stripe still shows `paid`; mark refunded through the normal refund path (not a direct DB edit) and make the `coach-pay` webhook handle `charge.refunded` started from the Stripe dashboard.
5. **Sessions follow refunds on website sales (Nov 20, with Charlie):** contract with Charlie for credits created by website purchases and reversed on refund (ledger entries, never edits).
6. **AI photo privacy notice (Felix text):** shown before first machine scan and food photo; consent stored with version and time.

## Step 1 — Session achievement summary (≈1 week, no cost)

**Behavior.** After a session is completed (log saved), the client and trainer see a summary card: personal records set, total volume vs previous comparable session, streak (consecutive weeks with ≥1 session), sessions this month, milestones, trainer's note. Share as image. Milestones are stored for Step 6 triggers.

**Data (migration `coach_session_summaries`):**
- `coach_session_summaries(id, log_id unique → coach_logs, client_id, trainer_id, created_at, prs jsonb, volume_kg numeric, prev_volume_kg numeric, streak_weeks int, sessions_month int, milestones text[], trainer_note text, shared_at timestamptz)`.
- `coach_milestones(id, client_id, trainer_id, kind text check in ('nth_session','first_pr','new_max','streak','program_complete'), detail jsonb, achieved_at, log_id)`; unique (client_id, kind, detail->>'key') to avoid duplicates.
- RLS: trainer of the client (all), client (select own; update `shared_at` only). Negative tests: other trainer, other client, anon.

**Logic.** Pure TypeScript in `app/src/lib/achievements.ts` (unit-tested): PR detection per exercise (best e1RM / max weight at reps / max reps at weight), volume, streak, milestone rules. Computed client-side on log save and upserted; a server function is not needed. Body weight/measurement changes excluded unless the owner decides otherwise (Q6) and the client opts in.

**UI.** `app/src/features/session-summary.tsx` shown after finishing a workout (session.tsx) and in client history; share image via existing share path.

**Tests.** Unit tests for PR/streak/milestone edge cases (first ever session, deload, unit changes kg/lb, bodyweight exercises, timed sets, duplicate save). RLS tests. Device check.

## Step 2 — Client pool roster + Fill this slot (≈1.5 weeks, no cost)

**Data (migration `coach_client_pool`):**
- `coach_clients.frequency_tier text not null default 'regular' check in ('regular','occasional','on_call','lapsed','prospect')`, `short_notice_ok boolean default false`, `short_notice_consent_at timestamptz`.
- `coach_client_availability(id, client_id, trainer_id, weekday smallint 0-6, start_time, end_time, check end>start)`.
- `coach_slot_offers(id, trainer_id, booking_id, occurrence_date date, starts_at, duration_min, status check in ('open','filled','withdrawn','expired'), created_at, filled_by_client_id, filled_at)`.
- `coach_slot_offer_recipients(offer_id, client_id, token uuid unique, sent_at, channel, responded_at, response check in ('accepted','declined','too_late'))`.
- Atomic accept: security-definer function `coach_accept_slot_offer(token)` with `update coach_slot_offers set status='filled' … where id=… and status='open'` so only the first acceptance wins; creates the booking for the client (consuming a package credit as normal bookings do); marks others `too_late`.
- Lapsed is computed (view `coach_client_pool_v`): last `coach_logs.performed_at` / last done booking older than N weeks (Q2, default 4), unless tier set manually.
- RLS: trainer own clients; client can read/update own availability and opt-in; recipients act only via token function. Negative tests incl. second acceptance after fill.

**UI.**
- Client profile: tier, availability windows, short-notice opt-in (client can edit own).
- `app/src/app/coach/roster.tsx`: grouped by tier, last session, next booking, credits left, lapsed flag.
- On a cancelled occurrence or open time: **Fill this slot** → ranked list (availability overlap, then days since last session, then credits left; regulars excluded by default) → select → send.
- Sending (until Step 4/5): one prefilled text per recipient through the phone's Messages app via `contact.ts`, each with an accept link `https://…/o/<token>` (web route `app/src/app/o/[token].tsx`). Expiry (default end of slot start − 1 h).
- Scheduler: accepted offer creates a `coach_bookings` row; confirm with Charlie that his scheduler reads it (hub request sent 2026-11-07).

**Defaults pending owner answers:** offer to several at once, first to accept wins (Q3); clients don't self-book (Q4); credits consumed as usual (Q5).

## Step 3 — Program templates for the beta (by Dec 11)

Eight templates using existing `coach_programs` / `coach_workouts` and library exercise IDs: strength, hypertrophy, fat loss, TRX, Pilates, yoga, aquatics, active aging. Seed as reference data (repo file + import script, stable IDs), marked platform templates trainers copy. Source: owner's programs if provided (Q15), else drafted from standard principles and sent for owner review. Content review by the owner is the gate.

## Step 4 — Messaging foundation (≈1 week, no cost)

**Data (migration `coach_messaging`):**
- `coach_contact_consents(client_id, trainer_id, purpose check in ('reminders','offers','surveys','marketing'), channel check in ('sms','push','email'), granted boolean, text_version int, at timestamptz, source)`; latest row wins; STOP sets all `sms` to false.
- `coach_outbox(id, trainer_id, client_id, purpose, channel, template_key, body text (≤320), send_after timestamptz, status check in ('queued','sent','failed','skipped','cancelled'), skip_reason, provider_id, created_at, sent_at, related jsonb)`.
- `coach_inbox(id, client_id, trainer_id, channel, body, received_at, parsed jsonb, outbox_id)`.
- `coach_message_settings(trainer_id, quiet_start time default '21:00', quiet_end '08:00', tz, caps jsonb, campaigns jsonb)`.
- RLS: trainer own; client reads own messages and own consents; inserts to outbox via functions only.

**Runner.** Edge function `coach-outbox` invoked by pg_cron every 15 min: picks due `queued` rows, checks consent, quiet hours (client tz), caps, health-content lint (block bodies containing words from a deny list), then delivers through a channel adapter: `push` (Expo push), `manual` (appears in the trainer's "To send" list, sent through the phone), later `sms` (Step 5). Every decision logged (`skip_reason`).

**UI.** Client settings: message preferences by purpose. Trainer: campaigns on/off and timing; "To send" queue for manual channel.

## Step 5 — Automatic texts: reminders and slot offers (after beta; owner approval)

**Owner-only setup:** texting service account (Twilio or similar), business number, US A2P 10DLC brand + campaign registration (start early, can take weeks), keys stored as Supabase secrets by the owner.

**Build.** `sms` adapter in `coach-outbox`; inbound webhook function `coach-sms-inbound` (verify provider signature) parses replies: C / R / YES / STOP / START / HELP / 1–5 → updates confirmation, slot offer acceptance (same atomic function), consent, survey answer; unknown replies go to the trainer's chat. Reminder templates (Q10, default 24 h): "Reminder: training with {trainer_first} {day} {time}. Reply C to confirm, R to reschedule." No location or health detail beyond what's needed. Tests with provider test credentials only.

## Step 6 — Surveys, testimonials, referrals, group invites

- **Surveys:** add `kind 'survey'` to `coach_forms`/`coach_form_requests`; default survey 1–5 + optional comment; cadence per Q11 (default every 4th session, max 1 per 14 days). Sent through the outbox.
- **Testimonials:** `coach_testimonials(id, client_id, trainer_id, source_request_id, body, display_name, display_style check in ('first_name','first_initial','anonymous'), status check in ('draft','client_approved','published','withdrawn','hidden'), client_approved_at, published_at, hidden_reason)`. Triggered by milestone or rating 5. Client approves exact text and name display in app; can withdraw anytime (removed from website). No rewards for positive reviews.
- **Referrals:** `coach_referrals(id, referrer_client_id, trainer_id, code unique, created_at)` + `coach_referral_signups(referral_id, prospect name/contact, status, reward)`; link to the trainer's intake; reward per Q13 recorded as a ledger entry if any. Max one referral ask per 90 days.
- **Group invites:** create invites from `coach_events`; replies or link sign-up create `coach_event_signups` (waitlist when full).
- Felix signs off consent texts and testimonial rules before release.

## Step 7 — Testimonials on the website (with Charlie)

Contract: Charlie's site reads published testimonials through a read-only view or endpoint exposing only `body, display_name, published_at, trainer` for `status='published'`; withdrawal removes within one sync. Page labeled "Client testimonials". Optional Google review link (Q12).

## Step 8 — Resources and challenges directory

See `../2026-11-06/credentials-and-challenges-directory.md`. Waiting for owner answers there. Lowest priority.

## Owner questions (asked in chat 2026-11-07) and defaults if unanswered

| # | Question | Default used if no answer |
| --- | --- | --- |
| 1 | Does Columbia Association allow texting its clients from the owner's business and asking them for testimonials/referrals? Keep CA and private clients separate? | Add `coach_clients.source` (`ca` / `private`); messaging and testimonials/referrals off for `ca` clients |
| 2 | Tiers right? Weeks until Lapsed? | Tiers as listed; 4 weeks |
| 3 | Offer to several at once or one at a time? | Several at once, first wins |
| 4 | Clients self-book open slots? | No |
| 5 | Filled slots use package credits? | Yes, as normal bookings |
| 6 | Summary includes body weight/measurements? | No |
| 7 | Summary auto-sent or trainer reviews first? | Auto-shown in app; trainer note optional |
| 8 | Approve texting service now or after beta? | After beta |
| 9 | New business number or owner's own? | New business number (when approved) |
| 10 | Reminder timing; reschedule by text? | 24 h; C confirms, R asks the trainer to reschedule |
| 11 | Survey frequency and questions | Every 4th session, max 1 per 14 days; 1–5 + comment |
| 12 | Website only or also Google reviews? | Website only |
| 13 | Referral reward | None |
| 14 | Group training types, size, pricing | Use existing events; capacity and price set per event |
| 15 | Owner's own programs for templates? | Draft from standard principles for owner review |

Record answers here (replace the default column with the decision and date) as soon as they arrive.

## Checkpoint / handoff

| Field | Value |
| --- | --- |
| Owner agent | Phyllis |
| Status | ready-for-review — every step coded; Dave sets up testing and merging |
| Updated | 2026-11-07 |
| Merge order | #42, #43, #44, #45, #46, #47, then #48 (stacked on #44/#45/#47), #49. Conflicts are additive (route list in `app/src/app/_layout.tsx`, rows in `settings/index.tsx` and `me/index.tsx`): keep both sides. |
| Owner approvals needed | Each new migration and function deploy to production; coach-pay redeploy; texting service (cost, account, A2P 10DLC, secrets, webhook, `sms_enabled`). New functions `coach-outbox` and `coach-sms-inbound` deploy with `--no-verify-jwt`. |
| Content reviews | Owner: 8 program templates (#46). Felix: AI photo notice (#43), messaging consent text (#47), testimonial wording (#48). |
| Cross-team | Charlie: scheduler reads client-booked sessions (#45); website page using `coach_public_testimonials` (#48); website sales write `coach_payments` + package `payment_id` (#49). |
| Not built (waiting on owner) | Step 8 additions beyond the existing Credentials area (open questions in `../2026-11-06/credentials-and-challenges-directory.md`). |
| Safe takeover | Anyone may continue after posting `TAKEOVER CLAIMED` on the PR they pick up. |

## Implementation record

(Append one line per merged PR: date · step · PR · what shipped · tests.)

- 2026-11-07 · 0.1 · — · TS2307 at #19 already fixed on its branch (`useIsFocused` from `expo-router`); `tsc` clean.
- 2026-11-07 · 0.4 · #42 · Idempotent refunds; sync marks Stripe-dashboard refunds (Will's $11.11 case) · `deno check`.
- 2026-11-07 · 0.5 · #49 · Sessions follow refunds (package cancelled, class place freed) · `rls_refunds_follow`.
- 2026-11-07 · 0.6 · #43 · Photos-and-AI consent (scan, meal estimate), Settings page · `rls_consents`, tsc, npm test.
- 2026-11-07 · 1 · #44 · Session achievement summary; `coach_milestones` (summaries computed on device, no summary table) · 8 unit + `rls_milestones`.
- 2026-11-07 · 2 · #45 · Roster, Fill this slot, offer link page, When I'm free; `client_of` (not `source`, already used for leads) · 4 unit + `rls_client_pool` (race-safe acceptance).
- 2026-11-07 · 3 · #46 · 8 program templates + fix lazy template lists (Proxy lacked `has`) · data tests.
- 2026-11-07 · 4–5 · #47 · Outbox, consent, settings, To send, reminders, Twilio adapter (off), inbound replies · `rls_messaging`, 9 deno tests.
- 2026-11-07 · 6–7 · #48 · Surveys, testimonials (client-approved), referrals, group invites, `coach_public_testimonials` · `rls_engagement`, 11 deno tests; full RLS suite passes.
