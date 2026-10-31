#!/usr/bin/env bash
# Execute ONLY inside a GitHub Actions disposable Postgres 16 service container.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "Refusing production idempotency SQL outside isolated GitHub Actions." >&2
  exit 2
fi
container="${1:-}"
if [[ -z "$container" ]]; then echo "Missing disposable PostgreSQL container" >&2; exit 2; fi
db="titan_production_idempotency"
docker exec "$container" createdb -U postgres "$db"
run_file(){
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" < "$1"
}
query(){
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$1"
}
run_file scripts/ci/production-create-idempotency-setup.sql
run_file supabase/migrations/20261001_production_quotes_orders.sql
# This isolated test only needs the authenticated ownership column from the
# full vault migration. Do not seed accounts or fabricate real customer orders.
query 'alter table private.production_orders add column owner_user_id uuid references auth.users(id);' >/dev/null
run_file supabase/migrations/20261015_customer_production_outcomes.sql
run_file supabase/migrations/20261016_customer_outcome_learning_policy.sql
run_file supabase/migrations/20261017_production_learning_context.sql
run_file supabase/migrations/20261106_production_create_request_idempotency.sql
run_file supabase/migrations/20261107_production_creation_receipt_lookup.sql
run_file supabase/migrations/20261108_production_quote_status_idempotency.sql
run_file scripts/ci/production-quote-status-idempotency-assertions.sql
run_file scripts/ci/production-create-idempotency-assertions.sql
run_file scripts/ci/production-creation-receipt-lookup-assertions.sql

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
# Two independent SQL sessions race to create one quote with the same UUID.
quote_call="select public.production_quote_create_idempotent(
 '123e4567-e89b-42d3-a456-426614174110'::uuid,
 'LE-RACE-QUOTE-20261031',repeat('a',64),'INR',
 '[{\"label\":\"CI sewing\",\"amount\":901}]'::jsonb,0,'Race note'
);"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$quote_call" >"$tmpdir/q1" 2>"$tmpdir/q1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$quote_call" >"$tmpdir/q2" 2>"$tmpdir/q2.err" &
pid2=$!
wait "$pid1"
wait "$pid2"
q1=$(tr -d '\r\n' < "$tmpdir/q1")
q2=$(tr -d '\r\n' < "$tmpdir/q2")
if [[ -z "$q1" || "$q1" != "$q2" ]]; then echo "Concurrent same-key quote generated different UUIDs" >&2; exit 1; fi
if [[ $(query "select count(*) from private.production_quote_events where quote_id='$q1'::uuid") != "1" ]]; then
  echo "Concurrent quote replay emitted duplicate event" >&2; exit 1
fi

# Two sessions also race through the real context-creating order function;
# both must get one order ID and one durable design lineage.
order_call="select public.production_order_create_with_context_idempotent(
 '123e4567-e89b-42d3-a456-426614174111'::uuid,
 'LE-RACE-ORDER-20261031',repeat('a',64),null::uuid,'Race order',
 jsonb_build_object('version','linen-earth-production-learning-context-v1',
    'revisionId','LE-RACE-ORDER-20261031','recipeHash',repeat('a',64))
);"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$order_call" >"$tmpdir/o1" 2>"$tmpdir/o1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$order_call" >"$tmpdir/o2" 2>"$tmpdir/o2.err" &
pid2=$!
wait "$pid1"
wait "$pid2"
o1=$(tr -d '\r\n' < "$tmpdir/o1")
o2=$(tr -d '\r\n' < "$tmpdir/o2")
if [[ -z "$o1" || "$o1" != "$o2" ]]; then echo "Concurrent same-key order generated different UUIDs" >&2; exit 1; fi
if [[ $(query "select count(*) from private.production_order_events where order_id='$o1'::uuid") != "1" ]] ||
   [[ $(query "select count(*) from private.production_order_learning_context where order_id='$o1'::uuid") != "1" ]]; then
  echo "Concurrent order replay duplicated event or learning context" >&2; exit 1
fi
echo "TITAN isolated PostgreSQL atomic quote/order creation idempotency PASS"
