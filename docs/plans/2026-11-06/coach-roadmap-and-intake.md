# Coach app: roadmap to first public release, costs, risks (Phyllis → Ops intake, 2026-11-06)

Working name "Coach app" (final name: owner decision, shortlist to come with Margot, Wendel and Felix).

## Where it stands (Nov 6)

Built and live on the web dashboard + Android test builds: client roster and onboarding, workouts and a 1,842-exercise
library with a checked demo video for every exercise, assignments and plans, workout logging (swaps from real use,
permanent swaps), nutrition with barcode and photo logging, habits, goals, measurements, progress photos, check-ins and
forms, files, chat, team, calendar and bookings (scanned appointment import), machine scanning (gym and home equipment),
Health Connect and smart-scale sync, Lapis timer link, packages and payments with refund / void (reason required,
receipts through the website's coach-adjust endpoint), credentials directory, and the website link (shared coach_
tables via site_* functions).

Not yet verified on real devices for everything added this week; no crash reporting; no accessibility audit yet.

## Roadmap

| Phase | Dates | Scope | Done when |
| --- | --- | --- | --- |
| 1. Payments complete (Q4 rock 5) | now → Nov 20 | Refund / void receipts end to end (Nov 13); sessions follow refunds on website sales (Nov 20, with Charlie); coach-pay redeploy | Receipt arrives for a voided test payment on web and Android; Lara reviewed; Ops verified live |
| 2. Launch hardening | Nov 20 → Dec 11 | Lara's RLS and security review of every coach_ table and function; health-data consent at onboarding, privacy notice for AI photo processing, in-app data export; WCAG 2.2 AA pass on the core flows; offline workout logging check; crash reporting; device test pass (Android phone + tablet, web) | No high findings; every core flow passes on devices; Felix signs off the in-app text |
| 3. Closed beta | Dec 11 → Jan 15 | Owner + 3 to 5 trainers and their clients (Play internal testing + web); weekly fixes; trainer playbook templates (strength, hypertrophy, fat loss, TRX, Pilates, yoga, aquatics, active aging) | Activation and completion measures below hit for 3 weeks |
| 4. First public release | Q1 2027 (date after beta) | Play production listing with Health Connect and health-app declarations; final name; pricing for trainers; iOS build and App Store review | Owner approves release |

**Out of scope for the first release:** marketplace, AI program generation, selling digital content inside the app
(app-store billing rules), group-class scheduling beyond what bookings already do.

### Success measures

- Activation: trainer invites a first client within 24 h; first workout assigned and logged within 7 days.
- Weekly active clients per trainer; workout completion rate (assigned → logged); check-in compliance.
- 30 / 90-day client retention; trainer churn; trial-to-paid conversion (once pricing exists).

## Recurring costs this area uses (who pays: The Dragonfly Catalyst unless noted)

| Service | Use | Price | Notes |
| --- | --- | --- | --- |
| Supabase (shared project) | Database, auth, storage, edge functions for every Dragonfly app | Plan/price: Ops has the bill (unknown to me) | Shared with Phoenix's app: needs a written cost split under the separation rule |
| Anthropic API | Calendar scan, food photo, machine scan, exercise-suggestion review | Usage-based; per-person daily caps (20 to 60 calls) | Who holds the key and the bill: confirm |
| Stripe | Card payments for packages and events | Per-transaction fees | Business account |
| Resend (via the website) | Refund / void receipts | Charlie's plan | |
| GitHub (public repo), GitHub Pages, Actions | Code, web dashboard, CI | Free | |
| Expo / EAS | Android builds | Free tier so far | May need a paid plan for build volume at launch |
| Google Play developer | Android listing | One-time (may already be paid for Lapis) | |
| Apple Developer Program | iOS release | Yearly fee | Only at iOS launch: owner decision |
| USDA FoodData Central, Open Food Facts, Whoop / Oura / Strava APIs | Food data and wearables | Free tiers | |
| Gemini (owner's own subscription) | One-off: checking library videos | Owner's | Not a running cost of the app |

## Top risks

1. **Health-data privacy.** Health questionnaires, measurements, progress photos, food logs, Health Connect and scale
   data, and photos sent to an AI for scanning. Mitigation: consent at onboarding, AI-processing notice, export and
   deletion that work, no marketing use; Felix confirms which laws apply (state consumer-health-data laws, FTC Health
   Breach Notification Rule).
2. **RLS coverage.** Dozens of coach_ tables, nine added this week. One policy gap exposes a client's data. Mitigation:
   an RLS test for every table and policy (in place), Lara's review, Supabase advisors clean.
3. **Store policies.** Play health-apps and Health Connect declarations, account deletion, payments (in-person services
   via Stripe are fine; digital goods would need store billing), AI features disclosure. Mitigation: Felix and Connor
   review before submission.
4. **Website ↔ Coach shared tables.** The website's site_* functions and the new Scheduler read and write coach_
   tables; a schema change can break them silently. Mitigation: post schema changes on the hub first, contract tests,
   Charlie reviews migrations that touch shared tables.
5. **Speed over verification.** Many features shipped fast without real-device tests or crash reporting. Mitigation:
   phase 2 device pass, crash reporting, closed beta before any public release.

## What I need from the owner

1. OK to redeploy coach-pay (stores the trainer's refund reason on card refunds).
2. OK to run the receipt end-to-end test on the live project with a test trainer and test client whose email is the
   owner's own inbox: record a $1 cash payment, void it, confirm the email. No money moves; the voided record stays
   (7-year rule) marked as a test.
3. Answers to the 10 workflow questions (sent in chat).
4. Later: 3 to 5 trainers for the closed beta, the final name, and trainer pricing (with Ops and Margot).
