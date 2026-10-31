#!/usr/bin/env bash
# M129 CI-ONLY falsification of the installed replay/event immutability audit.
# Every intentional DDL/ACL fault stays in a PostgreSQL transaction aborted by
# the existing DO catalog check. No COMMIT and no production/staging database.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${CI:-}" != "true" ]]; then
  echo "M129 refuses non-CI execution" >&2; exit 2
fi
container="${1:-}"
db="${2:-}"
if [[ -z "$container" || "$db" != "titan_production_idempotency" ]]; then
  echo "M129 refuses any database except disposable titan_production_idempotency" >&2; exit 2
fi

readonly preflight="scripts/ci/m122-qc-schema-readonly-preflight.sql"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Use the precise DO body of the already tested READ ONLY M124 catalog probe.
# The fault occurs before DO in the same uncommitted transaction, so its
# altered catalog is observed and the exception closes the whole transaction.
sed -n '/^DO \$titan\$$/,/^\$titan\$;$/p' "$preflight" > "$work/body.sql"
if ! grep -q '^DO \$titan\$$' "$work/body.sql" ||
   ! grep -q '^\$titan\$;$' "$work/body.sql"; then
  echo "M129 could not extract unchanged catalog preflight" >&2; exit 1
fi
run_sql(){
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db"
}
run_sql < "$preflight" > "$work/pristine.out"

for kind in delivery_receipt_update_off delivery_receipt_truncate_off \
            quote_event_update_off order_event_truncate_off \
            create_receipt_update_off quote_status_receipt_truncate_off \
            order_status_receipt_update_off client_receipt_read_grant \
            client_event_function_execute_grant; do
  case "$kind" in
    delivery_receipt_update_off)
      mutation="alter table private.production_delivery_request_receipts disable trigger production_delivery_receipt_append_only;"
      diagnostic="delivery replay receipt append-only trigger missing or disabled";;
    delivery_receipt_truncate_off)
      mutation="alter table private.production_delivery_request_receipts disable trigger production_delivery_receipt_no_truncate;"
      diagnostic="delivery replay receipt append-only trigger missing or disabled";;
    quote_event_update_off)
      mutation="alter table private.production_quote_events disable trigger production_quote_event_append_only;"
      diagnostic="production event append-only or TRUNCATE trigger missing or disabled";;
    order_event_truncate_off)
      mutation="alter table private.production_order_events disable trigger production_order_event_no_truncate;"
      diagnostic="production event append-only or TRUNCATE trigger missing or disabled";;
    create_receipt_update_off)
      mutation="alter table private.production_creation_request_receipts disable trigger production_creation_receipt_append_only;"
      diagnostic="request replay append-only trigger missing or disabled";;
    quote_status_receipt_truncate_off)
      mutation="alter table private.production_quote_status_request_receipts disable trigger production_quote_status_receipt_no_truncate;"
      diagnostic="request replay append-only trigger missing or disabled";;
    order_status_receipt_update_off)
      mutation="alter table private.production_order_status_request_receipts disable trigger production_order_status_receipt_append_only;"
      diagnostic="request replay append-only trigger missing or disabled";;
    client_receipt_read_grant)
      mutation="grant select on private.production_creation_request_receipts to authenticated;"
      diagnostic="request replay table missing or client grants unsafe";;
    client_event_function_execute_grant)
      mutation="grant execute on function private.reject_production_event_mutation() to authenticated;"
      diagnostic="production event rejection function insecure";;
  esac
  {
    printf 'BEGIN;\n%s\n' "$mutation"
    cat "$work/body.sql"
    printf '\nROLLBACK;\n'
  } > "$work/fault.sql"
  if run_sql < "$work/fault.sql" > "$work/$kind.out" 2> "$work/$kind.err"; then
    echo "M129 FAIL: installed catalog audit accepted $kind" >&2
    exit 1
  fi
  if ! grep -Fq "$diagnostic" "$work/$kind.err"; then
    echo "M129 FAIL: unexpected error rather than intended catalog rejection: $kind" >&2
    exit 1
  fi
  # Every faulted session disconnects with a failed transaction. The actual
  # installed READ ONLY catalog preflight must succeed again with no repair.
  if ! run_sql < "$preflight" > "$work/restored-$kind.out" 2> "$work/restored-$kind.err"; then
    echo "M129 FAIL: fault was not rolled back: $kind" >&2
    exit 1
  fi
  echo "M129 installed event/replay fault $kind rejected and rolled back PASS"
done
echo "M129 nine installed append-only and permission fault injections PASS"
