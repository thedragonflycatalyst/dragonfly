# Dragonfly Coach

Personal-training hub by The Dragonfly Catalyst: a trainer dashboard on the web and a client app on Android (iOS at launch).
Modeled on My PT Hub, built on the shared Dragonfly account system (same Supabase project as the Uploader, Lapis and Phoenix).

| Folder | What's there |
| --- | --- |
| `app/` | Expo (React Native) app. The same code runs the Android app and the web dashboard. |
| `supabase/migrations/` | Database schema. Every table is `coach_`-prefixed with row-level security. |
| `supabase/tests/` | Row-level security tests (`bash supabase/tests/run.sh` against any Postgres). |
| `.github/workflows/` | Checks on every push, Android test builds, web deploy to GitHub Pages. |

## Status

Phase 0 (foundation): Dragonfly sign-in and full account panel, trainer setup, client roster, invite links,
client home, security tests, CI. Plan and roadmap: the "Dragonfly Coaching Hub — Development Plan" doc.

## Run it

```bash
cd app
npm install
npm run web        # web dashboard at http://localhost:8081/dragonfly-coach
npm run android    # needs a development build (see app/AGENTS.md)
npm test && npx tsc --noEmit
```

## How access works

- A trainer sees and edits only their own library and clients.
- A client is linked by accepting an invite code (`coach_accept_invite`), then sees only their own assignments and logs.
- Archiving a client cuts their access; their history stays.
