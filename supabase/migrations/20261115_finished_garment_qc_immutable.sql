-- M122 draft: physical garment QC receipts must be immutable evidence.
-- Earlier schema called inspections append-only but service-role/privileged
-- direct UPDATE or DELETE could rewrite an approved inspection or remove rework.
-- This protects existing and new rows without backfilling historic chronology.
-- No live migration without separate owner schema/security approval.
create or replace function private.reject_finished_garment_qc_mutation()
returns trigger
language plpgsql
set search_path='pg_catalog'
as $$
begin
  raise exception 'finished garment QC evidence is append-only'
    using errcode='55000';
end;
$$;

revoke all on function private.reject_finished_garment_qc_mutation()
  from public,anon,authenticated;

drop trigger if exists finished_garment_qc_append_only
  on private.finished_garment_qc_inspections;
create trigger finished_garment_qc_append_only
  before update or delete on private.finished_garment_qc_inspections
  for each row execute function private.reject_finished_garment_qc_mutation();

-- TRUNCATE bypasses row-level DELETE triggers; block it explicitly too.
drop trigger if exists finished_garment_qc_no_truncate
  on private.finished_garment_qc_inspections;
create trigger finished_garment_qc_no_truncate
  before truncate on private.finished_garment_qc_inspections
  for each statement execute function private.reject_finished_garment_qc_mutation();

-- INSERT remains through the existing locked order + monotonic QC sequence
-- trigger; legitimate corrections are NEW inspections, never history edits.
