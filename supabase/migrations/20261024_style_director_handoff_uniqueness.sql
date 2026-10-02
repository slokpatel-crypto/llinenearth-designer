-- Prevent one signed Style Director handoff from inflating multiple real-user cases.
-- The API stores only a SHA-256 token fingerprint. Replaying the same signed token
-- returns the same audit id, and one audit id may support only one user-test row.

alter table private.style_director_handoff_audit
  add column if not exists token_fingerprint text;

alter table private.style_director_handoff_audit
  drop constraint if exists style_director_handoff_audit_token_fingerprint_check;
alter table private.style_director_handoff_audit
  add constraint style_director_handoff_audit_token_fingerprint_check
  check (token_fingerprint is null or token_fingerprint ~ '^[a-f0-9]{64}$');

create unique index if not exists style_director_handoff_audit_token_unique
  on private.style_director_handoff_audit(token_fingerprint)
  where token_fingerprint is not null;

create unique index if not exists style_director_user_tests_handoff_unique
  on private.style_director_user_tests(handoff_audit_id)
  where handoff_audit_id is not null;

create or replace function public.style_director_handoff_audit_record_v2(
  p_source_look_id text,
  p_shirt_id text,
  p_pant_id text,
  p_occasion text,
  p_token_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_id uuid;
begin
  if coalesce(length(trim(p_source_look_id)),0)<2 then raise exception 'source look id is required'; end if;
  if coalesce(length(trim(p_shirt_id)),0)<2 or coalesce(length(trim(p_pant_id)),0)<2 then raise exception 'stock pair is required'; end if;
  if lower(trim(coalesce(p_token_fingerprint,''))) !~ '^[a-f0-9]{64}$' then raise exception 'valid handoff token fingerprint is required'; end if;

  select a.audit_id into v_id
  from private.style_director_handoff_audit a
  where a.token_fingerprint=lower(trim(p_token_fingerprint))
  limit 1;
  if v_id is not null then return v_id; end if;

  insert into private.style_director_handoff_audit(
    source_look_id,shirt_id,pant_id,occasion,token_fingerprint
  ) values(
    left(trim(p_source_look_id),180),left(trim(p_shirt_id),180),left(trim(p_pant_id),180),left(trim(coalesce(p_occasion,'')),40),lower(trim(p_token_fingerprint))
  )
  on conflict (token_fingerprint) where token_fingerprint is not null
  do update set token_fingerprint=excluded.token_fingerprint
  returning audit_id into v_id;

  return v_id;
end;
$$;

revoke all on function public.style_director_handoff_audit_record_v2(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.style_director_handoff_audit_record_v2(text,text,text,text,text) to service_role;
