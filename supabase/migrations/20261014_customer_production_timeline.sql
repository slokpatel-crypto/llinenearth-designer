-- Privacy-safe production timeline for authenticated customer accounts.
-- Exposes only order status timestamps; internal operator payloads and notes remain private.

create or replace function public.production_order_event_list_owned(
  p_owner_user_id uuid,
  p_limit integer default 300
)
returns table(
  event_id uuid,
  order_id uuid,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path='public','private'
as $$
  select e.event_id,e.order_id,e.status,e.created_at
  from private.production_order_events e
  join private.production_orders o on o.order_id=e.order_id
  where o.owner_user_id=p_owner_user_id
  order by e.created_at desc
  limit greatest(1,least(coalesce(p_limit,300),1000));
$$;

revoke all on function public.production_order_event_list_owned(uuid,integer) from public,anon,authenticated;
grant execute on function public.production_order_event_list_owned(uuid,integer) to service_role;
