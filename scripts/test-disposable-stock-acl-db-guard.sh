#!/usr/bin/env bash
set -euo pipefail
# Synthetic-only preflight: negative controls must fail before SQL mutation.
guard="scripts/assert-disposable-stock-acl-db.sh"
bash -n "$guard"
bash "$guard"
must_reject() {
  local label="$1" keyvalue="$2" output status
  set +e
  output=$(env "$keyvalue" bash "$guard" 2>&1)
  status=$?
  set -e
  if [[ "$status" -eq 0 || "$output" != *"BLOCKED: legacy stock ACL mutation tests"* ]]; then
    echo "FAIL: unsafe $label target not blocked" >&2
    exit 1
  fi
}
must_reject "database" PGDATABASE=postgres
must_reject "host" PGHOST=staging.example.invalid
must_reject "port" PGPORT=5433
must_reject "user" PGUSER=postgres
must_reject "credential" PGPASSWORD=wrong
must_reject "service" PGSERVICE=staging
must_reject "service file" PGSERVICEFILE=/tmp/staging-service
must_reject "hostaddr" PGHOSTADDR=127.0.0.1
must_reject "CI context" GITHUB_ACTIONS=false
must_reject "CI marker" GITHUB_RUN_ID=999999999999999
echo "PASS: ten unsafe PostgreSQL connection/CI-run targets rejected before mutation"
