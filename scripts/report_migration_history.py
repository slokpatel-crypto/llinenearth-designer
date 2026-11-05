#!/usr/bin/env python3
"""Read-only migration inventory: distinguish legacy names from collisions.

This does NOT reconcile applied migrations or authorize db push.
"""
from __future__ import annotations

import argparse
import json
import hashlib
from collections import defaultdict
from pathlib import Path
import re
import sys

MIGRATION = re.compile(r"^(?P<version>(?:[0-9]{8}|[0-9]{14}))_(?P<label>[A-Za-z0-9_]+)\.sql$")


def report(directory: Path) -> dict:
    findings = {"directory": str(directory), "legacy": [], "modern": [],
                "malformed": [], "collisions": [], "missing": False, "fingerprints": []}
    if not directory.is_dir():
        findings["missing"] = True
        return findings
    versions = defaultdict(list)
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix != ".sql":
            continue
        match = MIGRATION.fullmatch(path.name)
        if not match:
            findings["malformed"].append(path.name)
            continue
        version = match.group("version")
        findings["legacy" if len(version) == 8 else "modern"].append(path.name)
        versions[version].append(path.name)
        findings["fingerprints"].append({"file": path.name, "version": version,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    findings["collisions"] = [
        {"version": version, "files": names}
        for version, names in sorted(versions.items()) if len(names) > 1
    ]
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", nargs="?", type=Path, default=Path("supabase/migrations"))
    args = parser.parse_args()
    findings = report(args.directory)
    print(json.dumps(findings, indent=2, sort_keys=True))
    if findings["missing"] or not (findings["legacy"] or findings["modern"]) or findings["malformed"] or findings["collisions"]:
        print("BLOCKED: migration inventory requires reconciliation; no database changes.", file=sys.stderr)
        return 1
    if findings["legacy"]:
        print("PENDING: legacy migration versions require applied-history reconciliation; do not db push.", file=sys.stderr)
        return 2
    print("Inventory syntax only; SQL replay and applied-history reconciliation remain pending.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
