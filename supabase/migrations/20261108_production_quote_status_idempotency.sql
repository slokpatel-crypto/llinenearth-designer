-- M110: atomic same-key quote status transitions, draft-only pending owner approval.
-- Do not apply to live Supabase without a reviewed migration plan.
create table if not exists private.production_quote_status_request_receipts (
  request_key uuid primary key,
  intent_sha256 bytea not null check (octet_length(intent_sha256)=32),
  quote_id uuid not null references private.production_quotes(quote_id),
  target_status text not null check (target_status in ('sent','accepted','void')),
  created_at timestamptz not null default now()
);
alter table private.production_quote_status_request_receipts enable row level security;
revoke all on private.production_quote_status_request_receipts from public,anon,authenticated;

create or replace function public.production_quote_set_status_idempotent(
  p_request_key uuid,
  p_quote_id uuid,
  p_status text,
  p_note text default ''
)
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_intent bytea;
  v_saved bytea;
  v_updated boolean;
begin
  if p_request_key is null or p_request_key::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
    raise exception 'invalid quote status request key';
  end if;
  v_intent:=sha256(convert_to(jsonb_build_object(
    'quoteId',p_quote_id,'status',p_status,'note',coalesce(p_note,'')
  )::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('production-status:quote:'||p_request_key::text,0));
  select intent_sha256 into v_saved
    from private.production_quote_status_request_receipts where request_key=p_request_key;
  if found then
    if v_saved<>v_intent then
      raise exception 'quote status request key belongs to different instructions';
    end if;
    return true;
  end if;
  -- A rejected transition never consumes its request key. The status row,
  -- event and request receipt commit together or roll back together.
  v_updated:=public.production_quote_set_status(p_quote_id,p_status,p_note);
  if v_updated is distinct from true then return false; end if;
  insert into private.production_quote_status_request_receipts(
    request_key,intent_sha256,quote_id,target_status
  ) values(p_request_key,v_intent,p_quote_id,p_status);
  return true;
end;
$$;

revoke all on function public.production_quote_set_status_idempotent(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.production_quote_set_status_idempotent(uuid,uuid,text,text)
  to service_role;
