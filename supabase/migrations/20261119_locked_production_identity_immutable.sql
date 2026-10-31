-- M130: authoritative locked design and financial quote identity are immutable.
-- Existing operator RPCs may still update status, note, updated_at and the
-- QC sequencing counter, but cannot rewrite original design, linked quote
-- or quoted financial inputs after the creation receipt was issued.
-- Draft only; explicit owner security/schema review and staging required.
create or replace function private.reject_locked_production_identity_mutation()
returns trigger
language plpgsql
set search_path='pg_catalog'
as $$
begin
  if tg_table_name='production_quotes' then
    if new.quote_id is distinct from old.quote_id
       or new.revision_id is distinct from old.revision_id
       or new.recipe_hash is distinct from old.recipe_hash
       or new.currency is distinct from old.currency
       or new.line_items is distinct from old.line_items
       or new.subtotal is distinct from old.subtotal
       or new.adjustment is distinct from old.adjustment
       or new.total is distinct from old.total
       or new.created_at is distinct from old.created_at then
      raise exception 'locked production quote design and financial identity cannot change'
        using errcode='55000';
    end if;
  elsif tg_table_name='production_orders' then
    if new.order_id is distinct from old.order_id
       or new.revision_id is distinct from old.revision_id
       or new.recipe_hash is distinct from old.recipe_hash
       or new.quote_id is distinct from old.quote_id
       or new.created_at is distinct from old.created_at then
      raise exception 'locked production order design and quote identity cannot change'
        using errcode='55000';
    end if;
  else
    raise exception 'locked production identity trigger attached to unexpected table'
      using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function private.reject_locked_production_identity_mutation()
  from public,anon,authenticated;

drop trigger if exists production_quote_locked_identity
  on private.production_quotes;
create trigger production_quote_locked_identity
  before update on private.production_quotes
  for each row execute function private.reject_locked_production_identity_mutation();

drop trigger if exists production_order_locked_identity
  on private.production_orders;
create trigger production_order_locked_identity
  before update on private.production_orders
  for each row execute function private.reject_locked_production_identity_mutation();

-- No UPDATE, DELETE, reset or backfill of any historical quote/order/price.
-- All original status state machines and QC insert sequencing stay intact.
