-- READ-ONLY, aggregate-only diagnostic for an authorized database owner.
-- No physical stock receipts, source documents, customer names, or UUIDs
-- appear in its output. Run only with deliberate owner permission on a
-- selected nonproduction or production database using appropriate read access.
-- This file DOES NOT apply a migration or repair/delete inventory.
--
-- One pipe-separated row, with exactly these ten nonnegative COUNT fields:
-- reservation_rows | duplicate_line_groups | duplicate_line_rows |
-- missing_locked_revision | missing_source | missing_checker |
-- missing_request_key | missing_reservation_uuid | padded_source |
-- placeholder_source
--
-- A source string is NOT proof of a genuine measured paper sheet/roll.
-- Confirm each source and line physically before approving migration.
BEGIN TRANSACTION READ ONLY;
WITH reservations AS (
  SELECT
    fabric_id,
    revision_id,
    lower(btrim(coalesce(source_reference,''))) AS source_key,
    source_reference,
    recorded_by,
    request_key,
    reservation_id
  FROM private.fabric_stock_ledger
  WHERE event_type='reserve'
),
duplicate_lines AS (
  SELECT count(*)::bigint AS n
  FROM reservations
  WHERE revision_id IS NOT NULL AND btrim(revision_id)<>''
    AND source_key<>''
  GROUP BY fabric_id,revision_id,source_key
  HAVING count(*)>1
),
counts AS (
  SELECT
    count(*)::bigint AS reservation_rows,
    count(*) FILTER (WHERE revision_id IS NULL
      OR btrim(revision_id)='')::bigint AS missing_locked_revision,
    count(*) FILTER (WHERE source_key='')::bigint AS missing_source,
    count(*) FILTER (WHERE length(btrim(coalesce(recorded_by,'')))<2)::bigint AS missing_checker,
    count(*) FILTER (WHERE request_key IS NULL
      OR btrim(request_key)='')::bigint AS missing_request_key,
    count(*) FILTER (WHERE reservation_id IS NULL)::bigint AS missing_reservation_uuid,
    count(*) FILTER (WHERE coalesce(source_reference,'')<>btrim(coalesce(source_reference,'')))::bigint AS padded_source,
    count(*) FILTER (WHERE source_key IN (
      'unknown','tbd','pending','n/a','na','none','sheet','approved','test'
    ))::bigint AS placeholder_source
  FROM reservations
)
SELECT concat_ws('|',
  counts.reservation_rows,
  (SELECT count(*) FROM duplicate_lines),
  coalesce((SELECT sum(n) FROM duplicate_lines),0),
  counts.missing_locked_revision,
  counts.missing_source,
  counts.missing_checker,
  counts.missing_request_key,
  counts.missing_reservation_uuid,
  counts.padded_source,
  counts.placeholder_source
) AS stock_reservation_aggregate_audit
FROM counts;
COMMIT;
