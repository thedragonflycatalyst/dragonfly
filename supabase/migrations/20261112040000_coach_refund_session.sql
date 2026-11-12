-- Trainers refund one charged session (owner 2026-11-12: "give me a way as the trainer to refund a charged session on
-- someone's account"). No refunds is the default policy; this is the trainer's own exception, so a reason is required
-- and kept. What "refund" does depends on what paid for the session:
--   package session  → the session goes back on the package (credit returned)
--   not paid yet     → let go (waived), nothing is owed
--   paid by card     → that session's price goes back to the card through Stripe (coach-pay refund_session)
--   paid otherwise   → recorded as given back (cash, transfer…); the payment shows the refunded amount
-- A payment that covered several sessions is refunded only for this one. Nothing is deleted.

alter table public.coach_session_charges drop constraint coach_session_charges_status_check;
alter table public.coach_session_charges add constraint coach_session_charges_status_check
  check (status in ('package', 'pending', 'paid', 'due', 'waived', 'cancelled', 'credit', 'refunded'));
alter table public.coach_session_charges
  add column refunded_at timestamptz,
  add column refunded_by uuid references auth.users(id) on delete set null,
  add column refund_reason text check (char_length(refund_reason) <= 500);

-- The one place the refund happens. p_card_done: coach-pay has already refunded the card and updated the payment.
create function public.coach_charge_refund_apply(p_charge uuid, p_reason text, p_by uuid, p_card_done boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.coach_session_charges%rowtype; pay public.coach_payments%rowtype; amt int; why text := left(trim(coalesce(p_reason, '')), 500);
begin
  select * into c from public.coach_session_charges where id = p_charge for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.status = 'package' then
    if c.used_credit and c.client_package_id is not null then
      update public.coach_client_packages set credits_used = greatest(credits_used - 1, 0) where id = c.client_package_id;
    end if;
    update public.coach_session_charges set status = 'refunded', refunded_at = now(), refunded_by = p_by, refund_reason = why,
      note = 'Refunded: session returned to the package' where id = c.id;
    return jsonb_build_object('what', 'credit', 'package_id', c.client_package_id);
  elsif c.status in ('pending', 'due') then
    update public.coach_session_charges set status = 'waived', settled_at = now(), refunded_at = now(), refunded_by = p_by, refund_reason = why,
      note = 'Let go by the trainer' where id = c.id;
    return jsonb_build_object('what', 'waived');
  elsif c.status not in ('paid', 'credit') then
    raise exception 'not_refundable' using errcode = '22023';
  end if;
  if c.payment_id is not null then
    select * into pay from public.coach_payments where id = c.payment_id for update;
  end if;
  if pay.id is not null then
    amt := least(coalesce(c.amount_cents, pay.amount_cents), pay.amount_cents - coalesce(pay.refunded_cents, 0));
    if pay.method = 'stripe' and not p_card_done then raise exception 'card_refund' using errcode = 'P0001', hint = 'Refund through coach-pay'; end if;
    if not p_card_done then
      if amt <= 0 then raise exception 'already_refunded' using errcode = '22023'; end if;
      -- (the reason is kept on the session charge; status_reason isn't in every database)
      update public.coach_payments set refunded_cents = coalesce(refunded_cents, 0) + amt,
        status = case when coalesce(refunded_cents, 0) + amt >= amount_cents then 'refunded' else status end where id = pay.id;
    end if;
  end if;
  update public.coach_session_charges set status = 'refunded', refunded_at = now(), refunded_by = p_by, refund_reason = why,
    note = 'Refunded by the trainer' where id = c.id;
  return jsonb_build_object('what', 'money', 'amount_cents', coalesce(amt, c.amount_cents), 'payment_id', pay.id, 'method', pay.method);
end $$;
revoke execute on function public.coach_charge_refund_apply(uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.coach_charge_refund_apply(uuid, text, uuid, boolean) to service_role;

-- The trainer refunds a session on a client's account. Card payments answer 'card_refund': the app then asks coach-pay.
create function public.coach_charge_refund(p_charge uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.coach_session_charges%rowtype;
begin
  select * into c from public.coach_session_charges where id = p_charge;
  if not found or not public.coach_owns_client(c.client_id) then raise exception 'not_your_client' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  return public.coach_charge_refund_apply(p_charge, p_reason, auth.uid(), false);
end $$;
revoke execute on function public.coach_charge_refund(uuid, text) from public, anon;
grant execute on function public.coach_charge_refund(uuid, text) to authenticated;
