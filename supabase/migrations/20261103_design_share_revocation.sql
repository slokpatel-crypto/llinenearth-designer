-- Capability-scoped public share revocation; no user data or plaintext share tokens.
-- Apply and test before enabling LINEN_DESIGN_SHARE_REVOCATION_REQUIRED=1.
create schema if not exists private;
create table if not exists private.designer_share_revocations(
  token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'),
  revoke_key_hash text not null check(revoke_key_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists designer_share_revocations_expiry_idx
  on private.designer_share_revocations(expires_at);
alter table private.designer_share_revocations enable row level security;
revoke all on table private.designer_share_revocations from public,anon,authenticated,service_role;

create or replace function public.designer_share_register(
  p_token_hash text,p_revoke_key_hash text,p_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_revoke_key_hash is null or p_revoke_key_hash !~ '^[a-f0-9]{64}$'
    or p_expires_at is null or p_expires_at<=now()
    or p_expires_at>now()+interval '31 days' then
    raise exception 'invalid share registration';
  end if;
  insert into private.designer_share_revocations(token_hash,revoke_key_hash,expires_at)
  values(p_token_hash,p_revoke_key_hash,p_expires_at)
  on conflict(token_hash) do nothing;
  return found;
end;$$;

create or replace function public.designer_share_is_revoked(p_token_hash text)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid share digest';
  end if;
  return exists(select 1 from private.designer_share_revocations
    where token_hash=p_token_hash and revoked_at is not null);
end;$$;

create or replace function public.designer_share_revoke(
  p_token_hash text,p_revoke_key_hash text
) returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_revoke_key_hash is null or p_revoke_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid share revocation';
  end if;
  update private.designer_share_revocations
  set revoked_at=coalesce(revoked_at,now())
  where token_hash=p_token_hash
    and revoke_key_hash=p_revoke_key_hash
    and expires_at>now();
  return found;
end;$$;

revoke all on function public.designer_share_register(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.designer_share_is_revoked(text) from public,anon,authenticated;
revoke all on function public.designer_share_revoke(text,text) from public,anon,authenticated;
grant execute on function public.designer_share_register(text,text,timestamptz) to service_role;
grant execute on function public.designer_share_is_revoked(text) to service_role;
grant execute on function public.designer_share_revoke(text,text) to service_role;
