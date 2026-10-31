-- M113 draft: monotonic per-order physical QC acceptance chronology.
-- PostgreSQL now() is the transaction-start timestamp, not inspection insertion
-- time. An inspection waiting on the order lock could sort BEFORE an older
-- approved inspection and incorrectly unlock a later delivery. A per-order
-- sequence assigned under that same lock closes this chronology gap.
-- Draft only; no production migration without owner schema/security approval.
alter table private.production_orders
  add column if not exists qc_latest_sequence bigint not null default 0
  check(qc_latest_sequence>=0);

-- Legacy inspections intentionally have no sequence: their physical ordering
-- cannot be established from timestamps alone. A fresh provenanced inspection
-- is required to authorize delivery after this migration.
alter table private.finished_garment_qc_inspections
  add column if not exists inspection_sequence bigint
  check(inspection_sequence>0);
create unique index if not exists finished_garment_qc_order_sequence_unique
  on private.finished_garment_qc_inspections(order_id,inspection_sequence)
  where inspection_sequence is not null;

-- Covers BOTH legacy and v2 RPCs, plus any direct privileged insertion, without
-- relying on all callers remembering an advisory lock. UPDATE takes a row lock.
create or replace function private.assign_finished_garment_qc_sequence()
returns trigger
language plpgsql
security definer
set search_path='private','public'
as $$
begin
  update private.production_orders
    set qc_latest_sequence=qc_latest_sequence+1
    where order_id=new.order_id and status='ready'
    returning qc_latest_sequence into new.inspection_sequence;
  if not found then
    raise exception 'physical QC requires a ready order';
  end if;
  -- Capture actual insertion time after acquiring the order lock. The
  -- sequence, NOT this clock timestamp, is authoritative for delivery.
  new.created_at:=clock_timestamp();
  return new;
end;
$$;
revoke all on function private.assign_finished_garment_qc_sequence()
  from public,anon,authenticated;

drop trigger if exists finished_garment_qc_assign_sequence
  on private.finished_garment_qc_inspections;
create trigger finished_garment_qc_assign_sequence
  before insert on private.finished_garment_qc_inspections
  for each row execute function private.assign_finished_garment_qc_sequence();

-- Keep legacy inspection rows readable, but never make timestamp-only history
-- proof of latest QC after this point. Only strictly sequenced new evidence may
-- authorize a new delivered event.
