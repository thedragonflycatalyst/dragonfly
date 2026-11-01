# Dragonfly

Personal-training hub by The Dragonfly Catalyst: a trainer dashboard on the web and a client app on Android (iOS at launch).
Modeled on My PT Hub, built on the shared Dragonfly account system (same Supabase project as the Uploader, Lapis and Phoenix).

| Folder | What's there |
| --- | --- |
| `app/` | Expo (React Native) app. The same code runs the Android app and the web dashboard. |
| `supabase/functions/` | `coach-invite`: creates a client's account and sends their password-setup email. |
| `supabase/migrations/` | Database schema. Every table is `coach_`-prefixed with row-level security. |
| `supabase/tests/` | Row-level security tests (`bash supabase/tests/run.sh` against any Postgres). |
| `.github/workflows/` | Checks on every push, Android test builds, web deploy to GitHub Pages. |

## Status

Phase 0 (foundation): one sign-in screen for trainers and clients, full Dragonfly account panel, trainer setup,
client roster with email onboarding, client home, security tests, CI. Plan and roadmap: the "Dragonflying Hub — Development Plan" doc.

## Run it

```bash
cd app
npm install
npm run web        # web dashboard at http://localhost:8081/dragonfly
npm run android    # needs a development build (see app/AGENTS.md)
npm test && npx tsc --noEmit
```

## How access works

- A trainer sees and edits only their own library and clients.
- Like My PT Hub, one sign-in screen serves everyone; the account decides what you see.
- A trainer adds a client by email. The `coach-invite` function creates their Dragonfly account (no password)
  and emails a code to set one. On first sign-in `coach_link_me` attaches the client record to that confirmed email.
  Someone who already uses another Dragonfly app just signs in with it.
- A client sees only their own assignments and logs. "Create an account" in this app is for trainers.
- Archiving a client cuts their access; their history stays.
