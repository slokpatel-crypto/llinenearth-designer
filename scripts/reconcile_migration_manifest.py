#!/usr/bin/env python3
"""Read-only comparison of repository SQL fingerprints to an independently exported staging manifest.

Manifest JSON: {"migrations":[{"version":"20261101000000","file":"20261101000000_name.sql","sha256":"<64 hex>"}]}.
A matching manifest does not prove a database replay or authorize migration.
"""
import argparse
import json
import re
from pathlib import Path
from scripts.report_migration_history import report

HEX = re.compile(r"[0-9a-f]{64}\Z")
VERSION = re.compile(r"(?:[0-9]{8}|[0-9]{14})\Z")

def reconcile(directory: Path, manifest: dict) -> dict:
    inventory = report(directory)
    errors = []
    entries = manifest.get("migrations") if isinstance(manifest, dict) else None
    if not isinstance(entries, list) or not entries:
        errors.append("missing or empty staging migrations")
        entries = []
    actual = {}
    for item in entries:
        if not isinstance(item, dict):
            errors.append("invalid staging entry")
            continue
        version, filename, digest = item.get("version"), item.get("file"), item.get("sha256")
        if not isinstance(version, str) or not VERSION.fullmatch(version):
            errors.append("invalid staging version")
            continue
        if version in actual:
            errors.append("duplicate staging version: " + version)
            continue
        if not isinstance(filename, str) or not isinstance(digest, str) or not HEX.fullmatch(digest):
            errors.append("missing file or verified SQL digest: " + version)
            continue
        actual[version] = (filename, digest)
    if inventory["missing"] or inventory["malformed"] or inventory["collisions"]:
        errors.append("repository inventory is ambiguous")
    expected = {x["version"]: (x["file"], x["sha256"]) for x in inventory["fingerprints"]}
    for version in sorted(expected.keys() - actual.keys()):
        errors.append("not recorded in staging: " + version)
    for version in sorted(actual.keys() - expected.keys()):
        errors.append("staging-only migration: " + version)
    for version in sorted(expected.keys() & actual.keys()):
        if expected[version] != actual[version]:
            errors.append("filename or SQL digest mismatch: " + version)
    return {"verified_manifest_match": bool(expected) and not errors, "errors": errors,
            "repository_versions": len(expected), "staging_versions": len(actual),
            "note": "Read-only manifest match only; source authenticity, DB replay and deployment remain unverified."}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--directory", type=Path, default=Path("supabase/migrations"))
    args = parser.parse_args()
    try:
        data = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(json.dumps({"verified_manifest_match": False, "errors": [str(exc)]}))
        return 1
    result = reconcile(args.directory, data)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["verified_manifest_match"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
