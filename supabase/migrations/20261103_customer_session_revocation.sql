-- Durable, per-bearer logout revocation for signed customer sessions.
-- Apply and verify before enabling LINEN_CUSTOMER_SESSION_REVOCATION_REQUIRED=1.
-- Store only SHA-256 cookie digests, never plaintext cookies or account details.
create schema if not exists private;

create table if not exists private.customer_session_revocations(
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '31 days')
);

create index if not exists customer_session_revocations_expires_idx
  on private.customer_session_revocations(expires_at);

alter table private.customer_session_revocations enable row level security;
revoke all on table private.customer_session_revocations from public,anon,authenticated,service_role;

create or replace function public.customer_session_is_revoked(p_token_hash text)
returns boolean
language plpgsql security definer set search_path='public','private'
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid session token digest';
  end if;
  return exists(
    select 1 from private.customer_session_revocations
    where token_hash=p_token_hash and expires_at>now()
  );
end;
$$;

create or replace function public.customer_session_revoke(p_token_hash text)
returns boolean
language plpgsql security definer set search_path='public','private'
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid session token digest';
  end if;
  insert into private.customer_session_revocations(token_hash)
  values(p_token_hash)
  on conflict(token_hash) do update set
    revoked_at=now(),
    expires_at=greatest(customer_session_revocations.expires_at,now()+interval '31 days');
  return true;
end;
$$;

revoke all on function public.customer_session_is_revoked(text) from public,anon,authenticated;
revoke all on function public.customer_session_revoke(text) from public,anon,authenticated;
grant execute on function public.customer_session_is_revoked(text) to service_role;
grant execute on function public.customer_session_revoke(text) to service_role;
