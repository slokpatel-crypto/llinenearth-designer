-- Opt-in private measurement profile vault.
-- Raw body measurements are stored only after explicit user action.
-- Recovery keys are not stored; only SHA-256 hashes are persisted.

create schema if not exists private;

create table if not exists private.measurement_profile_vault (
  vault_id uuid primary key default gen_random_uuid(),
  access_hash text not null,
  profile jsonb not null,
  observations jsonb not null default '{}'::jsonb,
  profile_version integer not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  check (access_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists measurement_profile_vault_expiry_idx
  on private.measurement_profile_vault(expires_at);

alter table private.measurement_profile_vault enable row level security;
revoke all on private.measurement_profile_vault from public,anon,authenticated;

create or replace function public.measurement_profile_vault_store(
  p_access_hash text,
  p_profile jsonb,
  p_observations jsonb,
  p_ttl_days integer default 180
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if lower(coalesce(p_access_hash,'')) !~ '^[a-f0-9]{64}$' then raise exception 'invalid access hash'; end if;
  if jsonb_typeof(p_profile)<>'object' or coalesce((p_profile->>'version')::integer,0)<>1 then
    raise exception 'invalid measurement profile';
  end if;
  if jsonb_typeof(p_observations)<>'object' then raise exception 'invalid observation profile'; end if;

  insert into private.measurement_profile_vault(access_hash,profile,observations,expires_at)
  values(
    lower(p_access_hash),p_profile,p_observations,
    now()+make_interval(days=>greatest(1,least(coalesce(p_ttl_days,180),365)))
  )
  returning vault_id into v_id;
  return v_id;
end;
$$;

create or replace function public.measurement_profile_vault_get(
  p_vault_id uuid,
  p_access_hash text
)
returns table(profile jsonb,observations jsonb,expires_at timestamptz)
language sql
security definer
set search_path='public','private'
as $$
  select v.profile,v.observations,v.expires_at
  from private.measurement_profile_vault v
  where v.vault_id=p_vault_id
    and v.access_hash=lower(coalesce(p_access_hash,''))
    and v.expires_at>now()
  limit 1;
$$;

create or replace function public.measurement_profile_vault_delete(
  p_vault_id uuid,
  p_access_hash text
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  delete from private.measurement_profile_vault
  where vault_id=p_vault_id and access_hash=lower(coalesce(p_access_hash,''));
  return found;
end;
$$;

revoke all on function public.measurement_profile_vault_store(text,jsonb,jsonb,integer) from public,anon,authenticated;
revoke all on function public.measurement_profile_vault_get(uuid,text) from public,anon,authenticated;
revoke all on function public.measurement_profile_vault_delete(uuid,text) from public,anon,authenticated;
grant execute on function public.measurement_profile_vault_store(text,jsonb,jsonb,integer) to service_role;
grant execute on function public.measurement_profile_vault_get(uuid,text) to service_role;
grant execute on function public.measurement_profile_vault_delete(uuid,text) to service_role;
