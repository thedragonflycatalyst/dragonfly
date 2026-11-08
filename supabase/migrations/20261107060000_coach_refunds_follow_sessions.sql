-- Sessions follow refunds: when a payment is refunded or voided (in the app, the Stripe dashboard sync, or a website
-- sale refunded by the website), what it bought goes too. The package it created is cancelled (credits already used
-- stay on record; nothing is deleted) and a paid group-session place is released, moving the waiting list up.

create function public.coach_payment_reversed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('refunded', 'void') and old.status = 'paid' then
    update public.coach_client_packages set status = 'cancelled' where payment_id = new.id and status = 'active';
    if new.event_id is not null then
      update public.coach_event_signups set status = 'cancelled', paid = false
       where event_id = new.event_id and client_id = new.client_id and status in ('booked', 'waitlist') and paid;
      perform public.coach_event_promote(new.event_id);
    end if;
  end if;
  return null;
end $$;
create trigger coach_payment_reversed after update of status on public.coach_payments for each row execute function public.coach_payment_reversed();
revoke execute on function public.coach_payment_reversed() from public, anon, authenticated;
