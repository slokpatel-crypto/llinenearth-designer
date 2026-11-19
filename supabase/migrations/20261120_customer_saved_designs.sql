-- Ordinary Designer saved recipes: independent of signed locked-design vault.
-- UNAPPLIED. Server must verify Supabase session and derive p_owner_user_id.
create schema if not exists private;
create table if not exists private.customer_saved_designs (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  design_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, design_id),
  constraint customer_saved_design_id_check check (design_id ~ '^[A-Za-z0-9_-]{1,160}$'),
  constraint customer_saved_design_payload_check check (
    jsonb_typeof(payload) = 'object'
    and payload->'schemaVersion' = '1'::jsonb
    and payload->>'designId' = design_id
    and jsonb_typeof(payload->'recipe') = 'object'
    and octet_length(payload::text) <= 1048576
  )
);
create index if not exists customer_saved_designs_owner_recent_idx
  on private.customer_saved_designs(owner_user_id, updated_at desc);
alter table private.customer_saved_designs enable row level security;
revoke all on private.customer_saved_designs from public, anon, authenticated;

create or replace function public.customer_saved_design_upsert_owned(
  p_owner_user_id uuid, p_design_id text, p_payload jsonb
) returns boolean language plpgsql security definer
set search_path = 'pg_catalog', 'public', 'private' as $$
begin
  if p_owner_user_id is null or p_design_id is null
     or p_design_id !~ '^[A-Za-z0-9_-]{1,160}$'
     or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload->'schemaVersion' is distinct from '1'::jsonb
     or p_payload->>'designId' is distinct from p_design_id
     or octet_length(p_payload::text) > 1048576 then
    return false;
  end if;
  insert into private.customer_saved_designs(owner_user_id, design_id, payload)
    values(p_owner_user_id, p_design_id, p_payload)
    on conflict (owner_user_id, design_id) do update
      set payload=excluded.payload, updated_at=now();
  return true;
end;
$$;

create or replace function public.customer_saved_design_list_owned(p_owner_user_id uuid)
returns table(design_id text, payload jsonb, updated_at timestamptz)
language sql security definer set search_path = 'pg_catalog', 'public', 'private' as $$
  select d.design_id, d.payload, d.updated_at
  from private.customer_saved_designs d
  where d.owner_user_id=p_owner_user_id
  order by d.updated_at desc, d.design_id limit 24;
$$;

create or replace function public.customer_saved_design_get_owned(
  p_owner_user_id uuid, p_design_id text
) returns table(payload jsonb, updated_at timestamptz)
language sql security definer set search_path = 'pg_catalog', 'public', 'private' as $$
  select d.payload, d.updated_at
  from private.customer_saved_designs d
  where d.owner_user_id=p_owner_user_id and d.design_id=p_design_id limit 1;
$$;

create or replace function public.customer_saved_design_delete_owned(
  p_owner_user_id uuid, p_design_id text
) returns boolean language plpgsql security definer
set search_path = 'pg_catalog', 'public', 'private' as $$
begin
  delete from private.customer_saved_designs
  where owner_user_id=p_owner_user_id and design_id=p_design_id;
  return found;
end;
$$;

revoke all on function public.customer_saved_design_upsert_owned(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.customer_saved_design_list_owned(uuid) from public,anon,authenticated;
revoke all on function public.customer_saved_design_get_owned(uuid,text) from public,anon,authenticated;
revoke all on function public.customer_saved_design_delete_owned(uuid,text) from public,anon,authenticated;
grant execute on function public.customer_saved_design_upsert_owned(uuid,text,jsonb) to service_role;
grant execute on function public.customer_saved_design_list_owned(uuid) to service_role;
grant execute on function public.customer_saved_design_get_owned(uuid,text) to service_role;
grant execute on function public.customer_saved_design_delete_owned(uuid,text) to service_role;
