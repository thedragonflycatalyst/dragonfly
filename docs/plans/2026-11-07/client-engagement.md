# Client engagement: client pool, scheduled texts, reviews and session summaries

Owner: Phyllis · Source: owner's notes from a PT meeting at work (Nov 7, 2026) · Status: **Proposed — concepts accepted, implementation to discuss with the owner**

The owner asked for five concepts to be in the Coach app. This plan records them, proposes how each works, and lists the decisions only the owner can make. Nothing here is built yet.

## 1. Client pool roster (fill cancellations)

**Problem.** When a regular client cancels, the slot goes empty. Trainers have clients they see less often (once a week, every other week, lapsed, "call me if something opens") but no list to pull from in the moment.

**Concept.**
- Every client gets a **frequency tier**: Regular (fixed weekly slots), Occasional, Flex / on call, Lapsed (no session in N weeks), Prospect.
- Clients record **availability windows** (days and times) and opt in to **short-notice offers**.
- **Fill this slot** button on any cancelled or open slot: ranks the pool by availability match, time since last session, sessions left on their package, and whether they opted in. Regulars are excluded by default.
- Trainer picks people (or "top 3") and sends an offer. First to accept gets the slot; the others get "it's been filled". The booking lands in the calendar through the scheduler app.
- The roster view groups clients by tier with last session date and next booking, so lapsed clients are visible before they disappear.

**Data.** `coach_clients.frequency_tier`, `coach_client_availability` (client, weekday, start, end), `short_notice_ok` with consent timestamp, `coach_slot_offers` (slot, client, sent, answered, outcome). Access rules: trainer's own clients only.

## 2. Scheduled texts: reminders, surveys, testimonials, referrals, group training

**Today.** The app opens the phone's own Messages app with a pre-filled text (free, manual, one at a time).

**Concept.** A sending service (Twilio or similar) sends automatically on a schedule:

| Message | When | Example |
| --- | --- | --- |
| Session reminder | 24 h and/or 2 h before | "Reminder: training with Emmet tomorrow 7:00 AM. Reply C to confirm, R to reschedule." |
| Slot offer | When the trainer fills a cancellation | "A 6:00 PM spot opened today. Reply YES to take it." |
| Post-session survey | A few hours after a session (e.g., every 4th session) | "How was today, 1–5?" |
| Testimonial request | After a milestone or a 5 rating | "Would you share a sentence about training with us? We'd show it on our website with your first name." |
| Referral ask | After a milestone or high rating, at most every 90 days | "Know someone who'd like this? Here's a link for a free intro session." |
| Group training invite | When a group class or small-group slot is created | "Small-group TRX Thursday 6 PM, 4 spots. Reply IN to join." |

Replies are parsed (YES, C, R, IN, 1–5, STOP) and update the app: confirmations, bookings, survey scores, testimonial drafts.

**Rules (non-negotiable).**
- Separate consent for **reminders** (transactional) and **marketing** (testimonial, referral, group invites); STOP works for every message and is honored immediately.
- Quiet hours (no texts before 8 AM or after 9 PM client time); frequency caps per client.
- **No health details in any text** (no injuries, weights, conditions).
- US business texting needs carrier registration (A2P 10DLC) before sending; Twilio's account and keys are owner-only credentials.
- Every message sent and every reply is logged against the client.

**Schedule.** One scheduled server function (every 15 minutes) finds due messages and sends them; the trainer sets which campaigns are on and their timing per client tier.

## 3. Responses to a public reviews page

**Concept.** Survey and testimonial replies flow into a **Reviews** list in the app. A client's testimonial is published to the website (and optionally a Google review link is offered) once the client confirms the exact text and how their name appears.

**Rules.** Publish only with the client's explicit approval of the wording and name display; never health details unless the client wrote them and approved; label the page "Client testimonials" (not "all reviews") unless every review is shown; no paying or rewarding for positive reviews, and any incentive disclosed. Felix to confirm against current FTC review rules. Charlie owns the website page; the app sends approved testimonials to it.

## 4. Session achievement summary

**Concept.** Every completed session ends with an automatic summary for the client (and trainer): personal records, total volume vs. last time, streak, sessions this month, milestones (10th session, first pull-up, new 5-rep max), and the trainer's note. Shown in the app, shareable as an image, optionally texted as a link. Milestones also trigger the testimonial and referral moments above.

**Data.** Computed from existing session logs; no new sensitive data. Body-weight and measurement changes only if the client opts in to seeing them in the summary.

## Proposed order

| Step | What | Cost | When |
| --- | --- | --- | --- |
| A | Session achievement summary (in app) | None | Closed beta (Dec 11 → Jan 15) |
| B | Client pool roster + Fill this slot, sent through the phone's own Messages app | None | Closed beta |
| C | Automated reminders and slot offers via a text service | Monthly fee + per-message cost (owner) | After beta, once owner approves the service and registration |
| D | Surveys, testimonials, referrals, group invites; testimonials to the website | Same service | First public release or shortly after |

## Decisions for the owner

1. Approve a text service (Twilio or similar) and its monthly cost, and own the account and registration. *Recommend: start with steps A–B free; decide on the service after beta.*
2. Which messages go out by default, and how often (especially surveys and referral asks)?
3. Testimonials: website only, or also invite clients to leave Google reviews?
4. Referral offer: free intro session, discount, or nothing?

## Who's involved

Charlie (scheduler bookings, website testimonials page), Felix (texting consent, review/testimonial rules), Lara (access rules review), Ops (cost).
