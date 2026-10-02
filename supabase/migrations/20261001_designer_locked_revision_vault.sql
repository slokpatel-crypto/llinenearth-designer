-- Durable private vault for locked Linen Earth design revisions.
-- Access is only through service-role RPCs; browsers never receive database credentials.
-- The recovery key is never stored, only its SHA-256 hash.

create schema if not exists private;

create table if not exists private.designer_locked_revision_vault (
  vault_id uuid primary key default gen_random_uuid(),
  revision_id text not null,
  recipe_hash text not null,
  access_hash text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  check (length(revision_id) between 12 and 220),
  check (recipe_hash ~ '^[a-f0-9]{64}$'),
  check (access_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists designer_locked_revision_vault_expiry_idx
  on private.designer_locked_revision_vault(expires_at);

create index if not exists designer_locked_revision_vault_revision_idx
  on private.designer_locked_revision_vault(revision_id,created_at desc);

alter table private.designer_locked_revision_vault enable row level security;
revoke all on private.designer_locked_revision_vault from public,anon,authenticated;

create or replace function public.designer_locked_revision_vault_store(
  p_revision_id text,
  p_recipe_hash text,
  p_access_hash text,
  p_payload jsonb,
  p_ttl_days integer default 180
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare v_id uuid;
begin
  if coalesce(length(trim(p_revision_id)),0)<12 then raise exception 'invalid revision id'; end if;
  if lower(coalesce(p_recipe_hash,'')) !~ '^[a-f0-9]{64}$' then raise exception 'invalid recipe hash'; end if;
  if lower(coalesce(p_access_hash,'')) !~ '^[a-f0-9]{64}$' then raise exception 'invalid access hash'; end if;
  if jsonb_typeof(p_payload)<>'object' or p_payload->>'version'<>'linen-earth-design-lock-v1' then
    raise exception 'invalid locked revision payload';
  end if;

  insert into private.designer_locked_revision_vault(
    revision_id,recipe_hash,access_hash,payload,expires_at
  ) values(
    left(trim(p_revision_id),220),
    lower(p_recipe_hash),
    lower(p_access_hash),
    p_payload,
    now()+make_interval(days=>greatest(1,least(coalesce(p_ttl_days,180),365)))
  )
  returning vault_id into v_id;

  return v_id;
end;
$$;

create or replace function public.designer_locked_revision_vault_get(
  p_vault_id uuid,
  p_access_hash text
)
returns table(payload jsonb,expires_at timestamptz)
language sql
security definer
set search_path='public','private'
as $$
  select v.payload,v.expires_at
  from private.designer_locked_revision_vault v
  where v.vault_id=p_vault_id
    and v.access_hash=lower(coalesce(p_access_hash,''))
    and v.expires_at>now()
  limit 1;
$$;

create or replace function public.designer_locked_revision_vault_delete(
  p_vault_id uuid,
  p_access_hash text
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  delete from private.designer_locked_revision_vault
  where vault_id=p_vault_id and access_hash=lower(coalesce(p_access_hash,''));
  return found;
end;
$$;

revoke all on function public.designer_locked_revision_vault_store(text,text,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.designer_locked_revision_vault_get(uuid,text) from public,anon,authenticated;
revoke all on function public.designer_locked_revision_vault_delete(uuid,text) from public,anon,authenticated;

grant execute on function public.designer_locked_revision_vault_store(text,text,text,jsonb,integer) to service_role;
grant execute on function public.designer_locked_revision_vault_get(uuid,text) to service_role;
grant execute on function public.designer_locked_revision_vault_delete(uuid,text) to service_role;
