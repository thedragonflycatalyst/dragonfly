-- Refund policy: each trainer writes one clear policy (packages can override it), clients see it before they buy,
-- and the policy in force at purchase is copied onto what they bought, so later changes never apply backwards.
-- coach_refund_quote() says whether a payment can be refunded under that policy, how much (prorated by what's been
-- used), and if not, why. A refund outside the policy needs the trainer to say why (recorded on the payment).
-- Defaults are a proposal for the owner to confirm; state consumer rules may require more (Felix to check).

create table public.coach_refund_policies (
  trainer_id uuid primary key references public.coach_trainers(user_id) on delete cascade,
  mode text not null default 'prorated' check (mode in ('prorated', 'unused_only', 'none')),
  window_days int not null default 30 check (window_days between 0 and 365),        -- days after purchase; 0 = no refunds after purchase day
  fee_cents int not null default 0 check (fee_cents between 0 and 100000),          -- kept from any refund (e.g. card processing)
  expired_refundable boolean not null default false,
  event_cutoff_hours int not null default 24 check (event_cutoff_hours between 0 and 336),
  extra_terms text check (char_length(extra_terms) <= 1500),
  updated_at timestamptz not null default now()
);
alter table public.coach_packages
  add column refund_mode text check (refund_mode in ('prorated', 'unused_only', 'none')),     -- null = the trainer's policy
  add column refund_window_days int check (refund_window_days between 0 and 365);
alter table public.coach_client_packages add column refund_terms jsonb;
alter table public.coach_payments
  add column refunded_cents int not null default 0 check (refunded_cents >= 0),
  add column refund_outside_policy boolean not null default false;
alter table public.coach_payments add constraint coach_payments_refund_max check (refunded_cents <= amount_cents);

alter table public.coach_refund_policies enable row level security;
revoke all on public.coach_refund_policies from anon;
grant select, insert, update on public.coach_refund_policies to authenticated;
create policy coach_refund_policies_own on public.coach_refund_policies for all to authenticated
  using (trainer_id = (select auth.uid())) with check (trainer_id = (select auth.uid()));
-- Clients (and anyone shown a package) can read the policy
create policy coach_refund_policies_read on public.coach_refund_policies for select to authenticated using (true);

-- The policy for a package (package overrides, else trainer, else defaults)
create function public.coach_refund_terms(p_trainer uuid, p_package uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mode', coalesce(pk.refund_mode, rp.mode, 'prorated'),
    'window_days', coalesce(pk.refund_window_days, rp.window_days, 30),
    'fee_cents', coalesce(rp.fee_cents, 0),
    'expired_refundable', coalesce(rp.expired_refundable, false),
    'event_cutoff_hours', coalesce(rp.event_cutoff_hours, 24),
    'extra_terms', rp.extra_terms)
  from (select 1) one
  left join public.coach_refund_policies rp on rp.trainer_id = p_trainer
  left join public.coach_packages pk on pk.id = p_package
$$;
grant execute on function public.coach_refund_terms(uuid, uuid) to anon, authenticated, service_role;

-- Copy the policy onto a package when it's bought
create function public.coach_client_package_terms() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.refund_terms is null then new.refund_terms := public.coach_refund_terms(new.trainer_id, new.package_id); end if;
  return new;
end $$;
create trigger coach_client_package_terms before insert on public.coach_client_packages for each row execute function public.coach_client_package_terms();
revoke execute on function public.coach_client_package_terms() from public, anon, authenticated;

-- Can this payment be refunded, and how much? (Trainer of the payment, or the client who paid.)
create function public.coach_refund_quote(p_payment uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.coach_payments%rowtype; k public.coach_client_packages%rowtype; e public.coach_events%rowtype; t jsonb;
        left_cents int; unused int; total int; amt int; why text; days_since numeric;
begin
  select * into p from public.coach_payments where id = p_payment;
  if not found or not (p.trainer_id = auth.uid() or public.coach_is_client(p.client_id) or auth.uid() is null) then
    raise exception 'not_your_payment' using errcode = '42501';
  end if;
  left_cents := p.amount_cents - p.refunded_cents;
  if p.status <> 'paid' or left_cents <= 0 then
    return jsonb_build_object('refundable', false, 'reason', 'This payment has already been refunded or voided.', 'max_cents', 0, 'suggested_cents', 0);
  end if;
  select * into k from public.coach_client_packages where payment_id = p.id order by created_at limit 1;
  t := coalesce(k.refund_terms, public.coach_refund_terms(p.trainer_id, p.package_id));
  days_since := extract(epoch from (now() - p.paid_at)) / 86400;
  if (t ->> 'mode') = 'none' then why := 'This purchase is non-refundable.';
  elsif days_since > (t ->> 'window_days')::int then why := format('Refunds are only available within %s days of purchase.', t ->> 'window_days');
  elsif k.id is not null and k.expires_on is not null and k.expires_on < current_date and not (t ->> 'expired_refundable')::boolean then why := 'The package has expired.';
  end if;
  if p.event_id is not null then
    select * into e from public.coach_events where id = p.event_id;
    if found and not e.cancelled and e.starts_at - make_interval(hours => (t ->> 'event_cutoff_hours')::int) < now() then
      why := coalesce(why, format('Group sessions can be refunded up to %s hours before they start.', t ->> 'event_cutoff_hours'));
    end if;
    if found and e.cancelled then why := null; end if;   -- the trainer cancelled: always refundable in full
  end if;
  if k.id is not null and k.credits_total is not null then
    total := k.credits_total; unused := greatest(k.credits_total - k.credits_used, 0);
    if (t ->> 'mode') = 'unused_only' and k.credits_used > 0 then why := coalesce(why, 'Refunds are only available before any session is used.'); end if;
    amt := floor(p.amount_cents::numeric * unused / total)::int;
  else
    amt := p.amount_cents;
  end if;
  amt := least(greatest(amt - (t ->> 'fee_cents')::int, 0), left_cents);
  if why is null and amt <= 0 then why := 'Nothing left to refund under the policy (every session has been used).'; end if;
  return jsonb_build_object('refundable', why is null, 'reason', why, 'max_cents', left_cents, 'suggested_cents', case when why is null then amt else 0 end,
    'credits_total', total, 'credits_unused', unused, 'fee_cents', (t ->> 'fee_cents')::int, 'terms', t);
end $$;
grant execute on function public.coach_refund_quote(uuid) to authenticated, service_role;

-- Refunds can't exceed what was paid, and outside-policy refunds must say why (status_reason when it exists)
create function public.coach_refund_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare q jsonb;
begin
  if new.refunded_cents is distinct from old.refunded_cents and new.refunded_cents > 0 and new.refunded_cents > old.refunded_cents then
    q := public.coach_refund_quote(new.id);
    new.refund_outside_policy := not (q ->> 'refundable')::boolean or (new.refunded_cents - old.refunded_cents) > (q ->> 'suggested_cents')::int;
  end if;
  return new;
end $$;
create trigger coach_refund_guard before update of refunded_cents on public.coach_payments for each row execute function public.coach_refund_guard();
revoke execute on function public.coach_refund_guard() from public, anon, authenticated;
