-- Update only the explicitly edited Lapis audio settings, never the full sync document.
-- This avoids the stale read/replace cycle in the Coach client.
create or replace function public.coach_patch_lapis_prefs(p_patch jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  k text;
  old_doc jsonb;
  old_prefs jsonb;
  next_prefs jsonb;
  stamp timestamptz := clock_timestamp();
  stamp_text text;
  next_doc jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'expected an object' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k not in ('voice', 'music', 'voiceLevel', 'voiceSpeed', 'haptics', 'bell') then
      raise exception 'invalid preference key: %', k using errcode = '22023';
    end if;
  end loop;
  if p_patch ? 'music' and (jsonb_typeof(p_patch->'music') <> 'string'
       or p_patch->>'music' not in ('mix', 'duck', 'pause')) then
    raise exception 'invalid music mode' using errcode = '22023';
  end if;
  if p_patch ? 'bell' and (jsonb_typeof(p_patch->'bell') <> 'string'
       or p_patch->>'bell' not in ('ring1', 'ring2', 'ring3')) then
    raise exception 'invalid bell' using errcode = '22023';
  end if;
  if p_patch ? 'haptics' and jsonb_typeof(p_patch->'haptics') <> 'boolean' then
    raise exception 'invalid haptics' using errcode = '22023';
  end if;
  if p_patch ? 'voiceLevel' and (jsonb_typeof(p_patch->'voiceLevel') <> 'number'
       or (p_patch->>'voiceLevel')::numeric not between 0 and 1) then
    raise exception 'invalid voice level' using errcode = '22023';
  end if;
  if p_patch ? 'voiceSpeed' and (jsonb_typeof(p_patch->'voiceSpeed') <> 'number'
       or (p_patch->>'voiceSpeed')::numeric not between 0.7 and 1.4) then
    raise exception 'invalid voice speed' using errcode = '22023';
  end if;
  if p_patch ? 'voice' and (
       jsonb_typeof(p_patch->'voice') <> 'object'
       or jsonb_typeof(p_patch #> '{voice,name}') <> 'string'
       or length(p_patch #>> '{voice,name}') > 100) then
    raise exception 'invalid voice' using errcode = '22023';
  end if;
  -- FOR UPDATE serializes concurrent Coach preference patches.
  -- Do not create a row if Lapis has not created its sync document yet.
  select doc into old_doc from public.lapis_sync
  where user_id = auth.uid() for update;
  if not found then return null; end if;
  if p_patch = '{}'::jsonb then return old_doc->'prefs'; end if;
  old_prefs := case when jsonb_typeof(old_doc #> '{prefs,data}') = 'object'
    then old_doc #> '{prefs,data}' else '{}'::jsonb end;
  next_prefs := old_prefs || p_patch;
  stamp_text := to_char(stamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  next_doc := jsonb_set(
    coalesce(old_doc, '{}'::jsonb),
    '{prefs}',
    jsonb_build_object('at', stamp_text, 'data', next_prefs),
    true
  );
  update public.lapis_sync
  set doc = next_doc, updated_at = stamp
  where user_id = auth.uid();
  return next_doc->'prefs';
end;
$$;
revoke all on function public.coach_patch_lapis_prefs(jsonb) from public, anon;
grant execute on function public.coach_patch_lapis_prefs(jsonb) to authenticated;
