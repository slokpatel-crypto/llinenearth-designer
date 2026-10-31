-- Owner-authorized, READ-ONLY aggregate diagnosis. No raw supplier
-- document IDs, employee names, order IDs, UUIDs or physical metres output.
-- A clean count does NOT prove paper source authenticity or real inventory.
-- Columns: receipt_rows | duplicate_line_groups | duplicate_line_rows |
-- missing_source | missing_checker | missing_request_key |
-- padded_source | placeholder_source
BEGIN TRANSACTION READ ONLY;
WITH receipts AS (
  SELECT fabric_id, lower(btrim(coalesce(source_reference,''))) AS source_key,
         source_reference, recorded_by, request_key
  FROM private.fabric_stock_ledger WHERE event_type='receipt'
),
duplicate_lines AS (
  SELECT count(*)::bigint AS n FROM receipts WHERE source_key<>''
  GROUP BY fabric_id,source_key HAVING count(*)>1
),
counts AS (
  SELECT count(*)::bigint AS receipt_rows,
    count(*) FILTER (WHERE source_key='')::bigint AS missing_source,
    count(*) FILTER (WHERE length(btrim(coalesce(recorded_by,'')))<2)::bigint AS missing_checker,
    count(*) FILTER (WHERE request_key IS NULL OR btrim(request_key)='')::bigint AS missing_request_key,
    count(*) FILTER (WHERE coalesce(source_reference,'')<>btrim(coalesce(source_reference,'')))::bigint AS padded_source,
    count(*) FILTER (WHERE source_key IN ('unknown','tbd','pending','n/a','na','none','roll','sheet','approved','test'))::bigint AS placeholder_source
  FROM receipts
)
SELECT concat_ws('|',
  counts.receipt_rows,
  (SELECT count(*) FROM duplicate_lines),
  coalesce((SELECT sum(n) FROM duplicate_lines),0),
  counts.missing_source,counts.missing_checker,counts.missing_request_key,
  counts.padded_source,counts.placeholder_source
) AS physical_receipt_aggregate_audit FROM counts;
COMMIT;
