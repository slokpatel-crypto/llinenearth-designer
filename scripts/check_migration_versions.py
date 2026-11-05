#!/usr/bin/env python3
"""Fail-closed Supabase migration filename/version preflight; no database access."""
from __future__ import annotations
import argparse
from collections import defaultdict
from pathlib import Path
import re
import sys

NAME = re.compile(r"^(?P<version>[0-9]{14})_(?P<label>[a-zA-Z0-9_]+)\.sql$")

def inspect_migrations(directory: Path) -> list[str]:
    errors: list[str] = []
    versions: dict[str, list[str]] = defaultdict(list)
    if not directory.is_dir():
        return [f"missing migration directory: {directory}"]
    files = sorted(directory.iterdir())
    if not any(p.is_file() and p.suffix == ".sql" for p in files):
        errors.append(f"no SQL migrations in {directory}")
    for path in files:
        if not path.is_file() or path.suffix != ".sql":
            continue
        match = NAME.fullmatch(path.name)
        if match is None:
            errors.append(f"invalid migration filename: {path.name}")
            continue
        versions[match.group("version")].append(path.name)
    for version, names in sorted(versions.items()):
        if len(names) > 1:
            errors.append(f"duplicate migration version {version}: {', '.join(names)}")
    return errors

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path, nargs="?", default=Path("supabase/migrations"))
    args = parser.parse_args()
    problems = inspect_migrations(args.directory)
    for problem in problems:
        print(f"BLOCKED: {problem}", file=sys.stderr)
    if problems:
        print(f"Migration preflight BLOCKED ({len(problems)} finding(s)); do not apply to staging/live.", file=sys.stderr)
        return 1
    print("Migration filename/version preflight passed (not a SQL replay or staging approval).")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
