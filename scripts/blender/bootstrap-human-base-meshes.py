#!/usr/bin/env python3
"""Fetch and unpack the pinned CC0 Blender Human Base Meshes bundle for Linen Earth.

This prepares a reproducible local source library only. It does not create or
approve the production GarmentViewer model.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

BUNDLE_NAME = "Blender Human Base Meshes"
BUNDLE_VERSION = "1.4.1"
BUNDLE_LICENSE = "CC0"
BUNDLE_VERIFIED_AT = "2026-10-05"
OFFICIAL_PAGE = "https://www.blender.org/download/demo-files/"
BUNDLE_URL = (
    "https://download.blender.org/demo/asset-bundles/human-base-meshes/"
    "human-base-meshes-bundle-v1.4.1.zip"
)
EXPECTED_ARCHIVE_BYTES = 50_643_039
DEFAULT_DESTINATION = Path(".cache/linen-earth/blender-human-base-meshes-v1.4.1")


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download and unpack the pinned CC0 Blender Human Base Meshes bundle."
    )
    parser.add_argument("--destination", type=Path, default=DEFAULT_DESTINATION)
    parser.add_argument(
        "--archive",
        type=Path,
        help="Use an already-downloaded v1.4.1 archive instead of downloading it.",
    )
    parser.add_argument("--force", action="store_true", help="Replace an existing destination.")
    parser.add_argument(
        "--keep-archive",
        action="store_true",
        help="Keep the downloaded zip beside the extracted asset library.",
    )
    return parser.parse_args()


def verify_archive(path: Path) -> None:
    size = path.stat().st_size
    if size != EXPECTED_ARCHIVE_BYTES:
        raise RuntimeError(
            f"Unexpected archive size: {size} bytes. "
            f"Expected the pinned v{BUNDLE_VERSION} archive to be {EXPECTED_ARCHIVE_BYTES} bytes."
        )
    if not zipfile.is_zipfile(path):
        raise RuntimeError("Downloaded file is not a valid ZIP archive.")


def safe_extract(archive: Path, destination: Path) -> None:
    root = destination.resolve()
    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.infolist():
            target = (destination / member.filename).resolve()
            if target != root and root not in target.parents:
                raise RuntimeError(f"Unsafe path in asset archive: {member.filename}")
        bundle.extractall(destination)


def download_archive(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        BUNDLE_URL,
        headers={"User-Agent": "Linen-Earth-Model-Intake/1.0"},
    )
    with urllib.request.urlopen(request, timeout=180) as response, target.open("wb") as output:
        shutil.copyfileobj(response, output)


def write_provenance(destination: Path) -> None:
    payload = {
        "name": BUNDLE_NAME,
        "version": BUNDLE_VERSION,
        "license": BUNDLE_LICENSE,
        "verifiedAt": BUNDLE_VERIFIED_AT,
        "officialPage": OFFICIAL_PAGE,
        "downloadUrl": BUNDLE_URL,
        "expectedArchiveBytes": EXPECTED_ARCHIVE_BYTES,
        "status": "source-library-only-not-production-model",
    }
    (destination / "linen-earth-source-provenance.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    options = args()
    destination = options.destination.resolve()

    if destination.exists():
        if not options.force:
            marker = destination / "linen-earth-source-provenance.json"
            if marker.exists():
                print(f"Pinned source library already exists: {destination}")
                print(marker.read_text(encoding="utf-8").strip())
                return 0
            raise RuntimeError(
                f"Destination already exists without Linen Earth provenance: {destination}. "
                "Use --force only after checking its contents."
            )
        shutil.rmtree(destination)

    destination.mkdir(parents=True, exist_ok=True)
    downloaded = options.archive is None
    archive = (
        options.archive.resolve()
        if options.archive
        else destination.parent / f"human-base-meshes-bundle-v{BUNDLE_VERSION}.zip"
    )

    try:
        if downloaded:
            print(f"Downloading {BUNDLE_NAME} v{BUNDLE_VERSION} from Blender...")
            download_archive(archive)
        verify_archive(archive)
        safe_extract(archive, destination)
        write_provenance(destination)

        blend_files = sorted(destination.rglob("*.blend"))
        realistic_male = [
            path
            for path in blend_files
            if "realistic" in path.name.lower() and "male" in path.name.lower()
        ]

        print(f"Prepared CC0 source library: {destination}")
        print(f"Blend files found: {len(blend_files)}")
        if realistic_male:
            print("Realistic male candidates:")
            for path in realistic_male[:12]:
                print(f"  - {path.relative_to(destination)}")
        else:
            print(
                "No filename-level realistic-male candidate was found. "
                "Open the extracted asset library in Blender and choose the Realistic Male Body asset."
            )
        print(
            "Next: fit the Linen Earth tucked shirt and tailored trouser around the chosen body, "
            "then run scripts/blender/export-linen-earth-officewear.py."
        )
        return 0
    finally:
        if downloaded and archive.exists() and not options.keep_archive:
            archive.unlink()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Model-source bootstrap failed: {error}", file=sys.stderr)
        raise SystemExit(1)
