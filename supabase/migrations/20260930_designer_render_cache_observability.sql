-- Backend-only observability for the durable final-render cache.

alter table private.designer_render_cache
  add column if not exists shirt_id text,
  add column if not exists pant_id text;

create index if not exists designer_render_cache_pair_idx
  on private.designer_render_cache(shirt_id,pant_id,hit_count desc);

create or replace function public.designer_render_cache_upsert_v2(
  p_cache_key text,
  p_view text,
  p_shirt_id text,
  p_pant_id text,
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
  if coalesce(length(trim(p_cache_key)),0)<16
    or coalesce(length(trim(p_shirt_id)),0)=0
    or coalesce(length(trim(p_pant_id)),0)=0 then
    raise exception 'invalid render cache identity';
  end if;
  if jsonb_typeof(p_result)<>'object' or coalesce(p_result->>'image','')='' then
    raise exception 'invalid render result';
  end if;

  insert into private.designer_render_cache(
    cache_key,view,shirt_id,pant_id,result,updated_at,expires_at
  )
  values(
    left(trim(p_cache_key),128),
    p_view,
    left(trim(p_shirt_id),160),
    left(trim(p_pant_id),160),
    p_result,
    now(),
    now() + make_interval(hours=>greatest(1,least(coalesce(p_ttl_hours,720),2160)))
  )
  on conflict(cache_key) do update set
    view=excluded.view,
    shirt_id=excluded.shirt_id,
    pant_id=excluded.pant_id,
    result=excluded.result,
    updated_at=now(),
    expires_at=excluded.expires_at;

  return true;
end;
$$;

create or replace function public.designer_render_cache_stats()
returns table(
  total_entries bigint,
  fresh_entries bigint,
  total_hits bigint,
  distinct_pairs bigint,
  last_hit_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select
    count(*)::bigint,
    count(*) filter(where expires_at>now())::bigint,
    coalesce(sum(hit_count),0)::bigint,
    count(distinct (shirt_id,pant_id)) filter(where shirt_id is not null and pant_id is not null)::bigint,
    max(last_hit_at)
  from private.designer_render_cache;
$$;

create or replace function public.designer_render_cache_popular(p_limit integer default 20)
returns table(
  shirt_id text,
  pant_id text,
  cache_hits bigint,
  cached_variants bigint,
  last_hit_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select
    c.shirt_id,
    c.pant_id,
    coalesce(sum(c.hit_count),0)::bigint as cache_hits,
    count(*)::bigint as cached_variants,
    max(c.last_hit_at) as last_hit_at
  from private.designer_render_cache c
  where c.shirt_id is not null and c.pant_id is not null and c.expires_at>now()
  group by c.shirt_id,c.pant_id
  order by coalesce(sum(c.hit_count),0) desc,count(*) desc,c.shirt_id,c.pant_id
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

revoke all on function public.designer_render_cache_upsert_v2(text,text,text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.designer_render_cache_upsert_v2(text,text,text,text,jsonb,integer) to service_role;
revoke all on function public.designer_render_cache_stats() from public,anon,authenticated;
grant execute on function public.designer_render_cache_stats() to service_role;
revoke all on function public.designer_render_cache_popular(integer) from public,anon,authenticated;
grant execute on function public.designer_render_cache_popular(integer) to service_role;
