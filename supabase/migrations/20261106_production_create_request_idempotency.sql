-- Atomic, retry-safe creation receipts for private operator quotes/orders.
-- New RPCs wrap the existing legacy functions in one PostgreSQL transaction.
-- Nothing in this migration changes live records; owner migration approval is
-- required before the application branch is deployed.
create schema if not exists private;

create table if not exists private.production_creation_request_receipts (
  action text not null check (action in ('create_quote','create_order')),
  request_key uuid not null,
  intent_sha256 bytea not null check (octet_length(intent_sha256)=32),
  receipt_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(action,request_key)
);

alter table private.production_creation_request_receipts enable row level security;
revoke all on private.production_creation_request_receipts from public,anon,authenticated;
create index if not exists production_creation_request_receipts_created_idx
  on private.production_creation_request_receipts(created_at desc);

-- An advisory transaction lock serializes exactly identical operation keys.
-- The SHA-256 hashes never store the note, quote line prices or design context
-- in duplicate. A retry with a different intent is never treated as success.
create or replace function public.production_quote_create_idempotent(
  p_request_key uuid,
  p_revision_id text,
  p_recipe_hash text,
  p_currency text,
  p_line_items jsonb,
  p_adjustment numeric,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_intent bytea;
  v_saved bytea;
  v_receipt uuid;
begin
  if p_request_key is null or p_request_key::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
    raise exception 'invalid production creation request key';
  end if;
  -- Do not leak the operator's recovery token into SQL. This fingerprint is
  -- derived from the exact normalized arguments submitted to the creation RPC.
  v_intent:=sha256(convert_to(jsonb_build_object(
    'revisionId',trim(p_revision_id),
    'recipeHash',lower(p_recipe_hash),
    'currency',upper(p_currency),
    'lineItems',p_line_items,
    'adjustment',p_adjustment,
    'note',coalesce(p_note,'')
  )::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('production-create:quote:'||p_request_key::text,0));
  select intent_sha256,receipt_id into v_saved,v_receipt
    from private.production_creation_request_receipts
    where action='create_quote' and request_key=p_request_key;
  if found then
    if v_saved<>v_intent then
      raise exception 'production creation request key belongs to different quote instructions';
    end if;
    return v_receipt;
  end if;
  v_receipt:=public.production_quote_create(
    p_revision_id,p_recipe_hash,p_currency,p_line_items,p_adjustment,p_note
  );
  insert into private.production_creation_request_receipts(action,request_key,intent_sha256,receipt_id)
  values('create_quote',p_request_key,v_intent,v_receipt);
  return v_receipt;
end;
$$;

create or replace function public.production_order_create_with_context_idempotent(
  p_request_key uuid,
  p_revision_id text,
  p_recipe_hash text,
  p_quote_id uuid,
  p_note text,
  p_context jsonb
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_intent bytea;
  v_saved bytea;
  v_receipt uuid;
begin
  if p_request_key is null or p_request_key::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
    raise exception 'invalid production creation request key';
  end if;
  v_intent:=sha256(convert_to(jsonb_build_object(
    'revisionId',trim(p_revision_id),
    'recipeHash',lower(p_recipe_hash),
    'quoteId',p_quote_id,
    'note',coalesce(p_note,''),
    'context',p_context
  )::text,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('production-create:order:'||p_request_key::text,0));
  select intent_sha256,receipt_id into v_saved,v_receipt
    from private.production_creation_request_receipts
    where action='create_order' and request_key=p_request_key;
  if found then
    if v_saved<>v_intent then
      raise exception 'production creation request key belongs to different order instructions';
    end if;
    return v_receipt;
  end if;
  v_receipt:=public.production_order_create_with_context(
    p_revision_id,p_recipe_hash,p_quote_id,p_note,p_context
  );
  insert into private.production_creation_request_receipts(action,request_key,intent_sha256,receipt_id)
  values('create_order',p_request_key,v_intent,v_receipt);
  return v_receipt;
end;
$$;

revoke all on function public.production_quote_create_idempotent(uuid,text,text,text,jsonb,numeric,text)
  from public,anon,authenticated;
revoke all on function public.production_order_create_with_context_idempotent(uuid,text,text,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.production_quote_create_idempotent(uuid,text,text,text,jsonb,numeric,text)
  to service_role;
grant execute on function public.production_order_create_with_context_idempotent(uuid,text,text,uuid,text,jsonb)
  to service_role;
