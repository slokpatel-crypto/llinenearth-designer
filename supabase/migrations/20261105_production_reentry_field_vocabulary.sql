-- Phase 8: retain the exact closed vocabulary for physical re-entry evidence.
-- Refuse unknown historical values instead of deleting or relabelling them.
-- This migration is source-only until explicitly reviewed and applied.

do $$
begin
  if exists (
    select 1 from private.production_delivery_evidence
    where reentry_fields is null
      or jsonb_typeof(reentry_fields) is distinct from 'array'
      or not (reentry_fields <@ '["fabric_identity","construction","fit_measurements","style_recipe","quote_order_identity","other"]'::jsonb)
  ) then
    raise exception 'Unknown production re-entry field IDs exist. Review real records before installing the vocabulary gate.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.production_delivery_evidence'::regclass
      and conname = 'production_reentry_fields_known'
  ) then
    alter table private.production_delivery_evidence
      add constraint production_reentry_fields_known
      check (reentry_fields is not null
        and jsonb_typeof(reentry_fields) = 'array'
        and reentry_fields <@ '["fabric_identity","construction","fit_measurements","style_recipe","quote_order_identity","other"]'::jsonb);
  end if;
end;
$$;
