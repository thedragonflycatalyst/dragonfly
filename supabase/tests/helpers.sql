-- Shared test helpers: act as a user, assert, and detect refusals.
create schema t;
create table t.ids (k text primary key, v uuid);
create function t.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce((select v::text from t.ids where k = u), ''), false);
  execute 'set role authenticated';
end $$;
create function t.as_admin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;
create function t.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', what; end if;
  raise notice 'ok - %', what;
end $$;
-- true when the statement is refused (RLS, a guard, or a privilege error)
create function t.refused(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false;
exception when insufficient_privilege or check_violation or raise_exception or no_data_found or unique_violation or invalid_parameter_value or not_null_violation then return true;
end $$;
grant usage on schema t to authenticated, anon;
grant select on t.ids to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

