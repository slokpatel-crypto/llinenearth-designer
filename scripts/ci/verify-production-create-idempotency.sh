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
run_file supabase/migrations/20261002_finished_garment_qc.sql
run_file supabase/migrations/20261027_finished_garment_qc_provenance.sql
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
run_file supabase/migrations/20261109_production_order_status_idempotency.sql
run_file scripts/ci/production-order-status-idempotency-assertions.sql
run_file supabase/migrations/20261110_delivery_qc_sql_gate.sql
run_file scripts/ci/m112-delivery-qc-gate-assertions.sql
run_file supabase/migrations/20261111_delivery_idempotency.sql
run_file scripts/ci/m112-delivery-idempotency-assertions.sql
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
# Two separate SQL sessions racing the same quote transition must create one
# event and one receipt, even when both clients lose their HTTP response.
status_quote=$(query "select public.production_quote_create(
  'LE-RACE-STATUS-20261031',repeat('a',64),'INR',
  '[{\"label\":\"CI quote status\",\"amount\":1}]'::jsonb,0,''
);")
status_call="select public.production_quote_set_status_idempotent(
  '123e4567-e89b-42d3-a456-426614174224'::uuid,
  '$status_quote'::uuid,'sent','Race status'
);"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$status_call" >"$tmpdir/s1" 2>"$tmpdir/s1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$status_call" >"$tmpdir/s2" 2>"$tmpdir/s2.err" &
pid2=$!
wait "$pid1"
wait "$pid2"
if [[ $(tr -d '\r\n' < "$tmpdir/s1") != "t" ]] ||
   [[ $(tr -d '\r\n' < "$tmpdir/s2") != "t" ]] ||
   [[ $(query "select count(*) from private.production_quote_events where quote_id='$status_quote'::uuid and event_type='sent'") != "1" ]] ||
   [[ $(query "select count(*) from private.production_quote_status_request_receipts where quote_id='$status_quote'::uuid") != "1" ]]; then
  echo "Concurrent same-key quote status replay duplicated a transition" >&2; exit 1
fi
# Two separate sessions replay a non-delivery order status using the same key.
status_order=$(query "select public.production_order_create(
  'LE-RACE-ORDER-STATUS-20261031',repeat('a',64),null,''
);")
order_status_call="select public.production_order_set_status_idempotent(
  '123e4567-e89b-42d3-a456-426614174234'::uuid,
  '$status_order'::uuid,'cloth_reserved','Race reserve'
);"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$order_status_call" >"$tmpdir/os1" 2>"$tmpdir/os1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$order_status_call" >"$tmpdir/os2" 2>"$tmpdir/os2.err" &
pid2=$!
wait "$pid1"
wait "$pid2"
if [[ $(tr -d '\r\n' < "$tmpdir/os1") != "t" ]] ||
   [[ $(tr -d '\r\n' < "$tmpdir/os2") != "t" ]] ||
   [[ $(query "select count(*) from private.production_order_events where order_id='$status_order'::uuid and status='cloth_reserved'") != "1" ]] ||
   [[ $(query "select count(*) from private.production_order_status_request_receipts where order_id='$status_order'::uuid") != "1" ]]; then
  echo "Concurrent same-key order status replay duplicated a transition" >&2; exit 1
fi
# Two independent PostgreSQL sessions replay the SAME delivered request UUID.
# They must serialize under the per-request advisory transaction lock, with
# only one delivery event, one private receipt and one order transition.
delivery_order=$(query "select public.production_order_create('LE-M112-DELIVERY-RACE',repeat('a',64),null,'');")
query "select public.production_order_set_status('$delivery_order'::uuid,'cloth_reserved','');" >/dev/null
query "select public.production_order_set_status('$delivery_order'::uuid,'cutting','');" >/dev/null
query "select public.production_order_set_status('$delivery_order'::uuid,'stitching','');" >/dev/null
query "select public.production_order_set_status('$delivery_order'::uuid,'ready','');" >/dev/null
query "select public.finished_garment_qc_record_v2('$delivery_order'::uuid,'approved',
  '{\"recipe_match\":true,\"fabric_match\":true,\"measurement_check\":true,\"pattern_alignment\":true,\"stitching_finish\":true,\"clean_damage_free\":true}'::jsonb,
  '[]'::jsonb,'','CI inspector','CI-M112-RACE');" >/dev/null
delivery_call="select public.production_order_deliver_idempotent(
  '123e4567-e89b-42d3-a456-426614174343'::uuid,
  '$delivery_order'::uuid,'CI delivered'
);"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$delivery_call" >"$tmpdir/d1" 2>"$tmpdir/d1.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$delivery_call" >"$tmpdir/d2" 2>"$tmpdir/d2.err" &
pid2=$!
wait "$pid1"
wait "$pid2"
if [[ $(tr -d '\r\n' < "$tmpdir/d1") != "t" ]] ||
   [[ $(tr -d '\r\n' < "$tmpdir/d2") != "t" ]] ||
   [[ $(query "select count(*) from private.production_order_events where order_id='$delivery_order'::uuid and status='delivered'") != "1" ]] ||
   [[ $(query "select count(*) from private.production_delivery_request_receipts where order_id='$delivery_order'::uuid") != "1" ]] ||
   [[ $(query "select status from private.production_orders where order_id='$delivery_order'::uuid") != "delivered" ]]; then
  echo "Concurrent same-key delivery replay duplicated or lost a transition" >&2; exit 1
fi
# A physical rework insert must never race through a delivery commit.
# Both service-role functions acquire the SAME target order FOR UPDATE. In two
# independent sessions precisely one can win: delivered OR rework to stitching.
race_order=$(query "select public.production_order_create('LE-M112-REWORK-RACE',repeat('b',64),null,'');")
query "select public.production_order_set_status('$race_order'::uuid,'cloth_reserved','');" >/dev/null
query "select public.production_order_set_status('$race_order'::uuid,'cutting','');" >/dev/null
query "select public.production_order_set_status('$race_order'::uuid,'stitching','');" >/dev/null
query "select public.production_order_set_status('$race_order'::uuid,'ready','');" >/dev/null
query "select public.finished_garment_qc_record_v2('$race_order'::uuid,'approved',
  '{\"recipe_match\":true,\"fabric_match\":true,\"measurement_check\":true,\"pattern_alignment\":true,\"stitching_finish\":true,\"clean_damage_free\":true}'::jsonb,
  '[]'::jsonb,'','CI inspector','CI-M112-INITIAL');" >/dev/null
race_delivery="select public.production_order_deliver_idempotent(
  '123e4567-e89b-42d3-a456-426614174344'::uuid,'$race_order'::uuid,'Race delivered'
);"
race_rework="select public.finished_garment_qc_record_v2(
  '$race_order'::uuid,'rework','{}'::jsonb,'[\"measurement\"]'::jsonb,
  'Recheck fit','CI inspector','CI-M112-REWORK'
);"
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$race_delivery" >"$tmpdir/rd" 2>"$tmpdir/rd.err" &
pid1=$!
docker exec "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc "$race_rework" >"$tmpdir/rq" 2>"$tmpdir/rq.err" &
pid2=$!
delivery_success=0
rework_success=0
if wait "$pid1"; then delivery_success=1; fi
if wait "$pid2"; then rework_success=1; fi
if (( delivery_success + rework_success != 1 )); then
  echo "Concurrent delivery/rework must serialize to exactly one success" >&2
  cat "$tmpdir/rd.err" "$tmpdir/rq.err" >&2
  exit 1
fi
if [[ $delivery_success == 1 ]]; then
  if [[ $(query "select status from private.production_orders where order_id='$race_order'::uuid") != "delivered" ]] ||
     [[ $(query "select count(*) from private.finished_garment_qc_inspections where order_id='$race_order'::uuid and decision='rework'") != "0" ]] ||
     [[ $(query "select count(*) from private.production_order_events where order_id='$race_order'::uuid and status='delivered'") != "1" ]]; then
    echo "Delivery won race but rework/event truth diverged" >&2; exit 1
  fi
else
  if [[ $(query "select status from private.production_orders where order_id='$race_order'::uuid") != "stitching" ]] ||
     [[ $(query "select count(*) from private.finished_garment_qc_inspections where order_id='$race_order'::uuid and decision='rework'") != "1" ]] ||
     [[ $(query "select count(*) from private.production_delivery_request_receipts where order_id='$race_order'::uuid") != "0" ]]; then
    echo "Rework won race but delivery receipt/order status diverged" >&2; exit 1
  fi
fi
echo "TITAN isolated PostgreSQL status, delivery replay and QC-vs-delivery race PASS"
