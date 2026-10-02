-- Authenticated customer ownership for private design and measurement vaults.
-- Auth is verified by the Next.js server against Supabase Auth; these RPCs remain service-role only.

alter table private.designer_locked_revision_vault
  add column if not exists owner_user_id uuid null references auth.users(id) on delete set null;

alter table private.measurement_profile_vault
  add column if not exists owner_user_id uuid null references auth.users(id) on delete set null;

create index if not exists designer_locked_revision_vault_owner_idx
  on private.designer_locked_revision_vault(owner_user_id,created_at desc)
  where owner_user_id is not null;

create index if not exists measurement_profile_vault_owner_idx
  on private.measurement_profile_vault(owner_user_id,created_at desc)
  where owner_user_id is not null;

create or replace function public.designer_locked_revision_vault_set_owner(
  p_vault_id uuid,p_access_hash text,p_owner_user_id uuid
)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  update private.designer_locked_revision_vault
  set owner_user_id=p_owner_user_id,updated_at=now()
  where vault_id=p_vault_id
    and access_hash=lower(coalesce(p_access_hash,''))
    and expires_at>now()
    and (owner_user_id is null or owner_user_id=p_owner_user_id);
  return found;
end;
$$;

create or replace function public.designer_locked_revision_vault_list_owned(p_owner_user_id uuid)
returns table(vault_id uuid,revision_id text,recipe_hash text,payload jsonb,created_at timestamptz,expires_at timestamptz)
language sql security definer set search_path='public','private' as $$
  select v.vault_id,v.revision_id,v.recipe_hash,v.payload,v.created_at,v.expires_at
  from private.designer_locked_revision_vault v
  where v.owner_user_id=p_owner_user_id and v.expires_at>now()
  order by v.created_at desc limit 100;
$$;

create or replace function public.designer_locked_revision_vault_get_owned(p_vault_id uuid,p_owner_user_id uuid)
returns table(payload jsonb,expires_at timestamptz)
language sql security definer set search_path='public','private' as $$
  select v.payload,v.expires_at
  from private.designer_locked_revision_vault v
  where v.vault_id=p_vault_id and v.owner_user_id=p_owner_user_id and v.expires_at>now()
  limit 1;
$$;

create or replace function public.designer_locked_revision_vault_delete_owned(p_vault_id uuid,p_owner_user_id uuid)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  delete from private.designer_locked_revision_vault where vault_id=p_vault_id and owner_user_id=p_owner_user_id;
  return found;
end;
$$;

create or replace function public.measurement_profile_vault_set_owner(
  p_vault_id uuid,p_access_hash text,p_owner_user_id uuid
)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  update private.measurement_profile_vault
  set owner_user_id=p_owner_user_id
  where vault_id=p_vault_id
    and access_hash=lower(coalesce(p_access_hash,''))
    and expires_at>now()
    and (owner_user_id is null or owner_user_id=p_owner_user_id);
  return found;
end;
$$;

create or replace function public.measurement_profile_vault_list_owned(p_owner_user_id uuid)
returns table(vault_id uuid,profile jsonb,observations jsonb,created_at timestamptz,expires_at timestamptz)
language sql security definer set search_path='public','private' as $$
  select v.vault_id,v.profile,v.observations,v.created_at,v.expires_at
  from private.measurement_profile_vault v
  where v.owner_user_id=p_owner_user_id and v.expires_at>now()
  order by v.created_at desc limit 50;
$$;

create or replace function public.measurement_profile_vault_get_owned(p_vault_id uuid,p_owner_user_id uuid)
returns table(profile jsonb,observations jsonb,expires_at timestamptz)
language sql security definer set search_path='public','private' as $$
  select v.profile,v.observations,v.expires_at
  from private.measurement_profile_vault v
  where v.vault_id=p_vault_id and v.owner_user_id=p_owner_user_id and v.expires_at>now()
  limit 1;
$$;

create or replace function public.measurement_profile_vault_delete_owned(p_vault_id uuid,p_owner_user_id uuid)
returns boolean language plpgsql security definer set search_path='public','private' as $$
begin
  delete from private.measurement_profile_vault where vault_id=p_vault_id and owner_user_id=p_owner_user_id;
  return found;
end;
$$;

revoke all on function public.designer_locked_revision_vault_set_owner(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.designer_locked_revision_vault_list_owned(uuid) from public,anon,authenticated;
revoke all on function public.designer_locked_revision_vault_get_owned(uuid,uuid) from public,anon,authenticated;
revoke all on function public.designer_locked_revision_vault_delete_owned(uuid,uuid) from public,anon,authenticated;
revoke all on function public.measurement_profile_vault_set_owner(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.measurement_profile_vault_list_owned(uuid) from public,anon,authenticated;
revoke all on function public.measurement_profile_vault_get_owned(uuid,uuid) from public,anon,authenticated;
revoke all on function public.measurement_profile_vault_delete_owned(uuid,uuid) from public,anon,authenticated;

grant execute on function public.designer_locked_revision_vault_set_owner(uuid,text,uuid) to service_role;
grant execute on function public.designer_locked_revision_vault_list_owned(uuid) to service_role;
grant execute on function public.designer_locked_revision_vault_get_owned(uuid,uuid) to service_role;
grant execute on function public.designer_locked_revision_vault_delete_owned(uuid,uuid) to service_role;
grant execute on function public.measurement_profile_vault_set_owner(uuid,text,uuid) to service_role;
grant execute on function public.measurement_profile_vault_list_owned(uuid) to service_role;
grant execute on function public.measurement_profile_vault_get_owned(uuid,uuid) to service_role;
grant execute on function public.measurement_profile_vault_delete_owned(uuid,uuid) to service_role;
