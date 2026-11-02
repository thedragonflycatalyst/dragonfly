-- Dragonfly (coaching): how the trainer messages each client. Dragonfly chat is the default; a text message or WhatsApp
-- opens the trainer's phone app with the message filled in (no SMS gateway or WhatsApp Business account involved).
alter table public.coach_clients
  add column contact_via text not null default 'app' check (contact_via in ('app', 'sms', 'whatsapp'));
