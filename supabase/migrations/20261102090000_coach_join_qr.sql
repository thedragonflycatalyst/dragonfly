-- Dragonfly (coaching): in-person sign-up. The trainer shows a QR code; the client scans it, makes an account on the
-- page it opens, and is added straight to that trainer as an active client (then gets the app).
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

-- After signing up (email confirmed): become this trainer's client, or link the record they already made for you
create function public.coach_join(p_code text, p_first text, p_last text) returns uuid
language plpgsql security definer set search_path = '' as
$$
declare v_email text; v_trainer uuid; c public.coach_clients; v_id uuid;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'confirm_email_first' using errcode = '42501'; end if;
  if p_code !~ '^[A-Za-z0-9]{16,64}$' then raise exception 'bad_code' using errcode = '22023'; end if;
  select d.user_id into v_trainer from public.coach_trainer_details d where d.join_code = p_code;
  if v_trainer is null then raise exception 'bad_code' using errcode = '22023'; end if;
  if v_trainer = auth.uid() then raise exception 'own_code' using errcode = '22023'; end if;
  p_first := nullif(left(trim(coalesce(p_first, '')), 60), ''); p_last := left(trim(coalesce(p_last, '')), 60);
  if p_first is null then raise exception 'name_required' using errcode = '22023'; end if;

  perform set_config('coach.linking', 'on', true);
  select * into c from public.coach_clients x where x.trainer_id = v_trainer and lower(x.email) = lower(v_email);
  if found then
    if c.user_id is not null and c.user_id <> auth.uid() then raise exception 'email_in_use' using errcode = '42501'; end if;
    if c.user_id is null then
      update public.coach_clients set user_id = auth.uid(), status = 'active', started_on = coalesce(started_on, current_date) where id = c.id;
    end if;
    v_id := c.id;
  else
    insert into public.coach_clients (trainer_id, first_name, last_name, email, user_id, status, started_on, source)
    values (v_trainer, p_first, p_last, lower(v_email), auth.uid(), 'active', current_date, 'QR sign-up') returning id into v_id;
  end if;
  perform set_config('coach.linking', '', true);
  return v_id;
end
$$;

revoke execute on function public.coach_join_info(text), public.coach_join(text, text, text) from public;
grant execute on function public.coach_join_info(text) to anon, authenticated;
grant execute on function public.coach_join(text, text, text) to authenticated;
