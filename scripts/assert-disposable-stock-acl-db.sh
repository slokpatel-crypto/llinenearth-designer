#!/usr/bin/env bash
set -euo pipefail
# CI-only synthetic database safety guard. Must run before mutating ACL tests.
# Loopback may be forwarded; require an exact per-run marker in the connected DB.
block() { echo "BLOCKED: legacy stock ACL mutation tests require verified disposable CI PostgreSQL" >&2; exit 1; }
[[ "${GITHUB_ACTIONS:-}" == "true" ]] || block
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ ]] || block
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGPORT:-}" == "5432" ]] || block
[[ "${PGUSER:-}" == "titan" && "${PGPASSWORD:-}" == "synthetic_only" ]] || block
[[ "${PGDATABASE:-}" == "titan_synthetic" ]] || block
[[ -z "${PGSERVICE:-}" && -z "${PGSERVICEFILE:-}" && -z "${PGHOSTADDR:-}" ]] || block
actual=$(psql -X -v ON_ERROR_STOP=1 -At -v expected_run="$GITHUB_RUN_ID" <<'SQL' 2>/dev/null
select current_database() || '|' || session_user || '|' ||
  (select count(*)::text from titan_ci_guard.run_marker
   where run_id = :'expected_run');
SQL
) || block
[[ "$actual" == "titan_synthetic|titan|1" ]] || block
