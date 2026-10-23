-- Phase 8: physical delivery audit claims must be internally consistent.
-- No historical record may claim zero design-data re-entry while listing
-- re-entered field IDs. Reject bad existing evidence rather than rewriting it.
-- This migration is source-only until explicitly applied by the shop owner.

do $$
begin
  if exists (
    select 1 from private.production_delivery_evidence
    where manual_design_reentry = false
      and jsonb_array_length(reentry_fields) > 0
  ) then
    raise exception 'Contradictory zero-reentry delivery audits exist. Review real records before installing the consistency gate.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.production_delivery_evidence'::regclass
      and conname = 'production_zero_reentry_fields_consistent'
  ) then
    alter table private.production_delivery_evidence
      add constraint production_zero_reentry_fields_consistent
      check (manual_design_reentry or jsonb_array_length(reentry_fields) = 0);
  end if;
end;
$$;
