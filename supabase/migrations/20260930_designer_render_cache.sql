-- Durable server-side cache for final FASHN outfit renders.
-- Customer browsers never receive database credentials or direct table access.

create schema if not exists private;

create table if not exists private.designer_render_cache (
  cache_key text primary key,
  view text not null check (view in ('front','three-quarter','side','back')),
  result jsonb not null,
  hit_count bigint not null default 0,
  last_hit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists designer_render_cache_expiry_idx
  on private.designer_render_cache(expires_at);

alter table private.designer_render_cache enable row level security;
revoke all on private.designer_render_cache from public,anon,authenticated;

create or replace function public.designer_render_cache_get(p_cache_key text)
returns table(result jsonb)
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  update private.designer_render_cache
  set hit_count=hit_count+1,last_hit_at=now(),updated_at=updated_at
  where cache_key=p_cache_key and expires_at>now();

  return query
  select c.result
  from private.designer_render_cache c
  where c.cache_key=p_cache_key and c.expires_at>now()
  limit 1;
end;
$$;

create or replace function public.designer_render_cache_upsert(
  p_cache_key text,
  p_view text,
  p_result jsonb,
  p_ttl_hours integer default 720
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  if p_view not in ('front','three-quarter','side','back') then
    raise exception 'unsupported render view';
  end if;
  if coalesce(length(trim(p_cache_key)),0)<16 then
    raise exception 'invalid render cache key';
  end if;
  if jsonb_typeof(p_result)<>'object' or coalesce(p_result->>'image','')='' then
    raise exception 'invalid render result';
  end if;

  insert into private.designer_render_cache(cache_key,view,result,updated_at,expires_at)
  values(
    left(trim(p_cache_key),128),
    p_view,
    p_result,
    now(),
    now() + make_interval(hours=>greatest(1,least(coalesce(p_ttl_hours,720),2160)))
  )
  on conflict(cache_key) do update set
    view=excluded.view,
    result=excluded.result,
    updated_at=now(),
    expires_at=excluded.expires_at;

  delete from private.designer_render_cache
  where expires_at < now() - interval '7 days';

  return true;
end;
$$;

revoke all on function public.designer_render_cache_get(text) from public,anon,authenticated;
grant execute on function public.designer_render_cache_get(text) to service_role;
revoke all on function public.designer_render_cache_upsert(text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.designer_render_cache_upsert(text,text,jsonb,integer) to service_role;
