-- Dragonfly (coaching): in-person sign-up. The trainer shows a QR code; the client scans it, makes an account on the
-- page it opens, and is added straight to that trainer as an active client (then gets the app).
-- They prove who they are with a text-message code (their phone) or, as a backup, an email code. With only the phone
-- confirmed, the email they typed is used for their client record but never to claim a record someone else made.
alter table public.coach_trainer_details
  add column join_code text unique check (join_code ~ '^[A-Za-z0-9]{16,64}$');

-- What the sign-up page shows before the person has an account: just whose page it is
create function public.coach_join_info(p_code text) returns table (trainer_name text, business_name text)
language sql stable security definer set search_path = '' as
$$
  select t.display_name, t.business_name
    from public.coach_trainer_details d join public.coach_trainers t on t.user_id = d.user_id
   where p_code ~ '^[A-Za-z0-9]{16,64}$' and d.join_code = p_code
$$;

-- After signing up (phone or email confirmed): become this trainer's client, or link the record they already made for you
create function public.coach_join(p_code text, p_first text, p_last text, p_phone text, p_email text default null) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare v_email text; v_trusted boolean; v_trainer uuid; c public.coach_clients; v_id uuid;
begin
  select case when u.email_confirmed_at is not null then u.email end, u.email_confirmed_at is not null
    into v_email, v_trusted from auth.users u where u.id = auth.uid() and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null);
  if not found then raise exception 'confirm_first' using errcode = '42501'; end if;
  if v_email is null then
    v_email := lower(trim(coalesce(p_email, '')));
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'email_required' using errcode = '22023'; end if;
  end if;
  if p_code !~ '^[A-Za-z0-9]{16,64}$' then raise exception 'bad_code' using errcode = '22023'; end if;
  select d.user_id into v_trainer from public.coach_trainer_details d where d.join_code = p_code;
  if v_trainer is null then raise exception 'bad_code' using errcode = '22023'; end if;
  if v_trainer = auth.uid() then raise exception 'own_code' using errcode = '22023'; end if;
  p_first := nullif(left(trim(coalesce(p_first, '')), 60), ''); p_last := left(trim(coalesce(p_last, '')), 60);
  if p_first is null then raise exception 'name_required' using errcode = '22023'; end if;
  p_phone := left(trim(coalesce(p_phone, '')), 30);
  if length(regexp_replace(p_phone, '\D', '', 'g')) not between 7 and 15 then raise exception 'phone_required' using errcode = '22023'; end if;

  perform set_config('coach.linking', 'on', true);
  select * into c from public.coach_clients x where x.trainer_id = v_trainer and lower(x.email) = lower(v_email);
  if found then
    if c.user_id is not null and c.user_id <> auth.uid() then raise exception 'email_in_use' using errcode = '42501'; end if;
    -- An unconfirmed email can't claim a record the trainer made (they confirm the email first)
    if c.user_id is null and not v_trusted then raise exception 'confirm_email_to_link' using errcode = '42501'; end if;
    if c.user_id is null then
      update public.coach_clients set user_id = auth.uid(), status = 'active', started_on = coalesce(started_on, current_date) where id = c.id;
    end if;
    update public.coach_clients set phone = p_phone where id = c.id;
    v_id := c.id;
  else
    insert into public.coach_clients (trainer_id, first_name, last_name, email, phone, user_id, status, started_on, source)
    values (v_trainer, p_first, p_last, lower(v_email), p_phone, auth.uid(), 'active', current_date, 'QR sign-up') returning id into v_id;
  end if;
  perform set_config('coach.linking', '', true);
  return v_id;
end
$$;

revoke execute on function public.coach_join_info(text), public.coach_join(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.coach_join_info(text) to anon, authenticated;
grant execute on function public.coach_join(text, text, text, text, text) to authenticated;
