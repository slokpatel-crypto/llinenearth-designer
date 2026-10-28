"""Offline, candidate-only integrity checks for four-angle Blender QA artifacts.

Passing this validator proves file identity and completeness, NOT photographic
likeness, UV continuity, physical drape, tailor signoff or release readiness.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import runpy
import struct
import zlib
from pathlib import Path

MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"
REFERENCE_IMAGE = "/designer/studio-tucked.webp"
MANIFEST_VERSION = "linen-earth-model-qa-turntable-v1"
PREFLIGHT_GATE = "linen-earth-officewear-scene-preflight-v1"
GARMENT_OBJECTS = ("ShirtTorsoFabric", "ShirtSleeveLFabric", "ShirtSleeveRFabric", "TrouserWaistFabric", "TrouserLegLFabric", "TrouserLegRFabric")
PREFLIGHT_REPORT_FILE = "model-qa-native-preflight.json"
VIEWS = (("front", 0.0), ("three-quarter", 35.0), ("side", 90.0), ("back", 180.0))
HASH_PATTERN = re.compile(r"[0-9a-f]{64}\Z")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def validate_native_preflight_report(report: object) -> list[str]:
    """Independently reject contradictory or incomplete native geometry evidence."""
    if not isinstance(report, dict):
        return ["Native preflight report is missing or malformed"]
    reasons: list[str] = []
    if report.get("gate") != PREFLIGHT_GATE or report.get("ready") is not True or report.get("reasons") != []:
        reasons.append("Native scene preflight did not report an unblocked geometry/UV gate")
    identity = report.get("modelIdentity")
    if (not isinstance(identity, dict) or identity.get("id") != MODEL_IDENTITY_ID
        or identity.get("referenceImage") != REFERENCE_IMAGE or identity.get("locked") is not True):
        reasons.append("Native preflight model identity differs from canonical studio photo")
    if report.get("requiredGarmentObjects") != list(GARMENT_OBJECTS):
        reasons.append("Native preflight garment panel inventory differs from contract")
    fit = report.get("identityFitMeasurementsMm")
    if not isinstance(fit, dict):
        reasons.append("Native preflight lacks silhouette measurements")
    else:
        for key, target, tolerance in (("sleeveCenterSpacingMm", 500.0, 36.0),
                                       ("legCenterSpacingMm", 210.0, 24.0)):
            value = fit.get(key)
            if type(value) not in (int, float) or not math.isfinite(value) or abs(value - target) > tolerance:
                reasons.append(f"Native preflight {key} fails locked silhouette target")
    objects = report.get("objects")
    if not isinstance(objects, dict):
        reasons.append("Native preflight has no evaluated garment objects")
    else:
        for name in GARMENT_OBJECTS:
            entry = objects.get(name)
            if not isinstance(entry, dict) or entry.get("present") is not True or entry.get("inExportCollection") is not True:
                reasons.append(f"Native preflight missing canonical garment mesh {name}")
                continue
            uv = entry.get("uvQuality")
            if not isinstance(uv, dict):
                reasons.append(f"Native preflight missing UV continuity evidence for {name}")
                continue
            for key in ("invalidUvFaces", "nonfiniteUvFaces", "collapsedUvFaces",
                        "discontinuousSharedUvEdges", "nonmanifoldUvEdges"):
                if type(uv.get(key)) is not int or uv[key] != 0:
                    reasons.append(f"Native preflight {name} has unreviewed {key}")
            if type(uv.get("sharedUvEdges")) is not int or uv["sharedUvEdges"] <= 0:
                reasons.append(f"Native preflight {name} lacks shared-edge UV evidence")
    intersections = report.get("boundaryIntersections")
    if not isinstance(intersections, dict):
        reasons.append("Native preflight lacks body/garment intersection evidence")
    else:
        for key in ("bodyShirtTorso", "bodySleeveL", "bodySleeveR", "bodyTrouserWaist",
                    "bodyTrouserLegL", "bodyTrouserLegR"):
            if type(intersections.get(key)) is not int or intersections[key] != 0:
                reasons.append(f"Native preflight {key} has unreviewed collisions")
        tuck = intersections.get("shirtTrouserTuck")
        if type(tuck) is not int or tuck < 0 or tuck > 120:
            reasons.append("Native preflight shirt/trouser tuck collision budget failed")
    return reasons


def run_native_preflight(script: Path) -> dict:
    """Execute the real Blender scene preflight and require its actual report."""
    if not script.is_file() or script.is_symlink():
        raise RuntimeError("Native scene preflight script is missing or symlinked")
    namespace = runpy.run_path(str(script), run_name="linen_earth_candidate_preflight")
    checker = namespace.get("main")
    if not callable(checker):
        raise RuntimeError("Native scene preflight does not expose main()")
    try:
        report = checker()
    except SystemExit as error:
        if error.code not in (None, 0):
            raise RuntimeError("Native scene geometry/UV preflight failed; QA render blocked") from error
        raise RuntimeError("Native preflight exited without an auditable report") from error
    reasons = validate_native_preflight_report(report)
    if reasons:
        raise RuntimeError("Native scene preflight evidence failed: " + "; ".join(reasons))
    return report


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def png_dimensions(path: Path) -> tuple[int, int]:
    """Reject incomplete/truncated or corrupt PNG chunks, not only file extensions."""
    with path.open("rb") as handle:
        if handle.read(8) != PNG_SIGNATURE:
            raise ValueError("Invalid PNG signature")
        width = height = None
        saw_image_data = False
        while True:
            header = handle.read(8)
            if len(header) != 8:
                raise ValueError("Missing PNG IEND or truncated chunk header")
            size, kind = struct.unpack(">I4s", header)
            if size > 64 * 1024 * 1024:
                raise ValueError("PNG chunk exceeds bounded inspection size")
            payload = handle.read(size)
            checksum = handle.read(4)
            if len(payload) != size or len(checksum) != 4:
                raise ValueError("Truncated PNG chunk")
            actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
            if actual_crc != struct.unpack(">I", checksum)[0]:
                raise ValueError("PNG chunk CRC mismatch")
            if width is None:
                if kind != b"IHDR" or size != 13:
                    raise ValueError("PNG must start with a valid IHDR")
                width, height = struct.unpack(">II", payload[:8])
                if not (0 < width <= 8192 and 0 < height <= 8192):
                    raise ValueError("PNG dimensions outside inspection bounds")
            elif kind == b"IHDR":
                raise ValueError("Duplicate PNG IHDR")
            if kind == b"IDAT":
                saw_image_data = True
            if kind == b"IEND":
                if size or not saw_image_data or handle.read(1):
                    raise ValueError("PNG IEND invalid, no image data or trailing bytes")
                return width, height


def validate_candidate_manifest(manifest: object, directory: Path,
                                *, source: Path | None = None,
                                preflight_script: Path | None = None,
                                reference_photo: Path | None = None) -> list[str]:
    """Validate a *candidate* manifest; this never constitutes model approval."""
    reasons: list[str] = []
    if not isinstance(manifest, dict):
        return ["Candidate QA manifest must be an object"]
    for key, expected in (
        ("version", MANIFEST_VERSION),
        ("modelIdentityId", MODEL_IDENTITY_ID),
        ("referenceImage", REFERENCE_IMAGE),
        ("nativePreflightGate", PREFLIGHT_GATE),
    ):
        if manifest.get(key) != expected:
            reasons.append(f"Incorrect {key}")
    for key, expected in (
        ("identityLocked", True), ("candidateOnly", True),
        ("nativePreflightPassed", True),
        ("photographicMatchApproved", False), ("realismApproved", False),
        ("tailorApproved", False), ("measuredFabricDrapeApproved", False),
    ):
        if manifest.get(key) is not expected:
            reasons.append(f"Candidate evidence must keep {key}={expected}")
    resolution = manifest.get("resolution")
    if (not isinstance(resolution, list) or len(resolution) != 2
        or any(type(value) is not int for value in resolution)
        or resolution[0] < 480 or resolution[1] < 640
        or resolution[0] > 8192 or resolution[1] > 8192):
        reasons.append("Invalid render resolution")
        resolution = None
    if manifest.get("renderEngine") != "BLENDER_EEVEE_NEXT":
        reasons.append("Unexpected render engine")
    for key, path in (("sourceBlendSha256", source),
                      ("nativePreflightScriptSha256", preflight_script),
                      ("referencePhotoSha256", reference_photo)):
        value = manifest.get(key)
        if not isinstance(value, str) or not HASH_PATTERN.fullmatch(value):
            reasons.append(f"Missing or malformed {key}")
        elif path is not None:
            try:
                if path.is_symlink() or not path.is_file() or sha256_file(path) != value:
                    reasons.append(f"{key} does not match the supplied file")
            except OSError:
                reasons.append(f"Cannot verify {key}")
    report_name = manifest.get("nativePreflightReportFile")
    report_sha = manifest.get("nativePreflightReportSha256")
    if report_name != PREFLIGHT_REPORT_FILE or not isinstance(report_sha, str) or not HASH_PATTERN.fullmatch(report_sha):
        reasons.append("Missing native preflight report identity/digest")
    else:
        report_path = directory / PREFLIGHT_REPORT_FILE
        try:
            if report_path.is_symlink() or not report_path.is_file() or report_path.stat().st_size > 2_000_000:
                raise ValueError("Native preflight report missing, symlinked or oversized")
            if sha256_file(report_path) != report_sha:
                raise ValueError("Native preflight report SHA-256 differs from manifest")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            reasons.extend(validate_native_preflight_report(report))
        except (OSError, ValueError, UnicodeError) as error:
            reasons.append(f"Invalid native preflight report: {error}")
    if source is not None and manifest.get("sourceBlendName") != source.name:
        reasons.append("Source .blend filename differs from manifest")
    elif not isinstance(manifest.get("sourceBlendName"), str) or not manifest["sourceBlendName"].endswith(".blend"):
        reasons.append("Source .blend filename missing")

    angles = manifest.get("angles")
    if not isinstance(angles, list) or len(angles) != len(VIEWS):
        return reasons + ["Exactly four camera-angle entries are required"]
    for index, (view, yaw) in enumerate(VIEWS):
        entry = angles[index]
        if not isinstance(entry, dict):
            reasons.append(f"Angle {view} is not an object")
            continue
        filename = f"linen-earth-model-{view}.png"
        if entry.get("view") != view or entry.get("file") != filename:
            reasons.append(f"Angle {view} is missing, reordered or has an unsafe filename")
            continue
        value = entry.get("yawDeg")
        if type(value) not in (int, float) or not math.isfinite(value) or value != yaw:
            reasons.append(f"Incorrect camera yaw for {view}")
        digest = entry.get("sha256")
        if not isinstance(digest, str) or not HASH_PATTERN.fullmatch(digest):
            reasons.append(f"Malformed PNG digest for {view}")
            continue
        image_path = directory / filename
        try:
            if image_path.is_symlink() or not image_path.is_file():
                raise ValueError("Missing or symlinked PNG")
            size = image_path.stat().st_size
            if size < 12_000 or size > 100_000_000:
                raise ValueError("PNG size outside evidence bounds")
            if resolution is not None and png_dimensions(image_path) != tuple(resolution):
                raise ValueError("PNG dimensions differ from render manifest")
            if sha256_file(image_path) != digest:
                raise ValueError("PNG digest differs from manifest")
        except (OSError, ValueError) as error:
            reasons.append(f"Invalid {view} frame: {error}")
    return reasons


def main() -> int:
    """Independently recheck the exact candidate files without running Blender."""
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Validate candidate four-angle QA file integrity (not visual approval).")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--source-blend", type=Path, required=True)
    parser.add_argument("--preflight-script", type=Path, required=True)
    parser.add_argument("--reference-photo", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.manifest.is_symlink() or not args.manifest.is_file():
            raise ValueError("Manifest missing or symlinked")
        if args.manifest.stat().st_size > 100_000:
            raise ValueError("Candidate manifest exceeds size limit")
        payload = json.loads(args.manifest.read_text(encoding="utf-8"))
        reasons = validate_candidate_manifest(
            payload, args.manifest.parent,
            source=args.source_blend, preflight_script=args.preflight_script,
            reference_photo=args.reference_photo,
        )
    except (OSError, ValueError, UnicodeError) as error:
        reasons = [f"Could not inspect candidate manifest: {error}"]
    if reasons:
        for reason in reasons:
            print(f"FAIL: {reason}")
        return 1
    print("PASS: candidate file integrity only; photo parity, physical drape and tailor approval remain unverified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
