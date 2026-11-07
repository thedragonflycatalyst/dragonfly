# Twilio setup checklist (owner-only steps)

Code is ready and off until these are done (PR #47, #48). Agents cannot create accounts, enter keys or pay.

## 1. Twilio account (owner)
1. When the Twilio application is approved, buy one US local number (about $1.15/month plus about $0.008 per text segment; check current pricing).
2. Register for **A2P 10DLC** (required for US business texting): Brand (business name, EIN or sole-proprietor), then a Campaign. Use "Low-volume mixed" or "Customer care / account notifications". Paste in the text below.
3. Create a **Messaging Service** and add the number to it.

## 2. Campaign text to paste
- **Description:** Appointment reminders, session confirmations, open-slot offers and short check-in surveys for personal-training clients of Dragonfly Coach.
- **How clients opt in:** A client creates an account in the Dragonfly Coach app and chooses how to receive reminders (text, email or in-app). Text is selected by default, and the Messages screen shows: "Choose what you'd like and how. Texts go to <their number>… Reply STOP to any text to stop them all. Message and data rates may apply." Clients can change this at any time under Me → Messages.
- **Sample 1:** Hi Sam, reminder: training with Alex tomorrow at 7:00 AM at Supreme Sports Club. Reply C to confirm or R to reschedule. Reply STOP to opt out.
- **Sample 2:** Hi Sam, a spot opened with Alex: Tue Nov 10, 6:00 PM (60 min). Reply YES to take it. First to reply gets it. Reply STOP to opt out.
- **Sample 3:** Hi Sam, how was training this week? Reply 1–5 (5 = great). Reply STOP to opt out.
- **Opt-out:** STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT. **Help:** HELP, INFO → "Training messages from <trainer> (Dragonfly). Reply STOP to opt out, START to opt back in. Msg & data rates may apply."
- No marketing, no links to third-party offers, no age-gated content.

## 3. Secrets (owner, Supabase dashboard → Edge Functions → Secrets)
| Name | Value |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | from Twilio console |
| `TWILIO_AUTH_TOKEN` | from Twilio console (never paste in chat, GitHub or the hub) |
| `TWILIO_MESSAGING_SERVICE_SID` | the Messaging Service (or `TWILIO_FROM` = +1XXXXXXXXXX) |
| `SMS_INBOUND_URL` | optional; only if the webhook URL differs from below |
| `RESEND_API_KEY`, `COACH_EMAIL_FROM` | optional, for app email (Resend, verified domain) |

## 4. Webhook (owner, Twilio console → Messaging Service → Integration)
Incoming messages → **Send a webhook**, HTTP POST:
`https://fkksaivdznqbfsfsagsj.supabase.co/functions/v1/coach-sms-inbound`
The function rejects requests without a valid Twilio signature.

## 5. Deploy and switch on (owner approval, then an agent can do it)
1. Apply migrations from #45, #47, #48 to production.
2. Deploy `coach-outbox` and `coach-sms-inbound` with `--no-verify-jwt` (they check the cron secret / Twilio signature themselves).
3. Admin sets `sms_enabled = true` for the trainer (Settings → Messages; admin only).
4. Test with one consenting test phone (not a real client): reminder, reply C, reply STOP, reply START.

Until then, texts go to the trainer's **To send** list to send from their own phone.
