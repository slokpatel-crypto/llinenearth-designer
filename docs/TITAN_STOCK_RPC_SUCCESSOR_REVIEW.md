# TITAN read-only stock RPC source successor review

This scoped draft is based on main commit `4dd8020abd83429449ff53ea5bb71b046394d86e`. It does not modify application source, production SQL, central source manifests, or the GitHub release settings.

## Purpose

Central source-parity draft #907 pins the two original Git blobs of draft #880. The verified follow-up draft #910 changes precisely these two paths. This isolated review job reads live PR #880 and #910 metadata, checks their exact pinned head and base relationships, compares the two changed-file SHA identities, independently hashes all four immutable Git blobs, and repeats head/main checks after reading to detect branch movement.

The resulting report always says `REVIEW_REQUIRED` and `release_ready:false`, even if all source bytes match. A green evidence workflow is not an independent human security review or permission to merge. It uses read-only GitHub API access.

Use `node --test tests/verify-stock-rpc-successor.test.mjs` to run isolated synthetic positive and negative cases. The GitHub Actions job uses a read-only workflow token for live evidence.

## Outstanding

After independent code review and explicit approval, central integration can consider updating the PR #907 source manifest with verified successor provenance and rerun parity on the final head. Do not silently re-pin or disable an old guard.

Supabase applied-migration-history collisions (#882), staging identity/ACL verification, external callers, GitHub main protection (#878), physical production evidence and owner launch approval remain release blockers.

No merge, deployment, SQL change, or live stock mutation is authorized by this draft.
