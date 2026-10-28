"""Independent, read-only integrity gate for source-locked four-angle Blender QA.

This verifies file provenance, not visual identity, real drape, tailoring,
supplier calibration, or production approval. No Blender/Pillow dependency.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
from pathlib import Path

IDENTITY = "linen-earth-studio-model-v1"
REFERENCE = "/designer/studio-tucked.webp"
VIEWS = (("front", 0.0), ("three-quarter", 35.0),
         ("side", 90.0), ("back", 180.0))
UNAPPROVED_FLAGS = (
    "supplierColorCalibration", "photographicMatchApproved",
    "realismApproved", "tailorApproved", "measuredFabricDrapeApproved",
)
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
HEX_SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate manifest key: {key}")
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError(f"Non-finite JSON constant: {value}")


def _expect(condition, reason):
    if not condition:
        raise ValueError(reason)


def verify_turntable(manifest_path: Path, candidate_path: Path,
                     source_blend_path: Path) -> dict:
    """Require four exact source-derived files before a human review sheet."""
    manifest_path = Path(manifest_path).resolve(strict=True)
    candidate_path = Path(candidate_path).resolve(strict=True)
    source_blend_path = Path(source_blend_path).resolve(strict=True)
    _expect(manifest_path.is_file() and source_blend_path.is_file(),
            "Missing turntable manifest or original Blender source")
    data = json.loads(manifest_path.read_text(encoding="utf-8"),
                      object_pairs_hook=_unique_pairs,
                      parse_constant=_invalid_constant)
    _expect(isinstance(data, dict), "Turntable manifest must be an object")
    _expect(data.get("version") == "linen-earth-model-qa-turntable-v1",
            "Unknown turntable manifest version")
    _expect(data.get("modelIdentityId") == IDENTITY
            and data.get("referenceImage") == REFERENCE,
            "Turntable is not bound to the locked studio identity")
    for flag in ("identityLocked", "candidateOnly", "diagnosticColorsOnly"):
        _expect(data.get(flag) is True, f"Missing exact true {flag}")
    for flag in UNAPPROVED_FLAGS:
        _expect(data.get(flag) is False,
                f"QA manifest must not assert {flag}")
    _expect(data.get("renderEngine") == "BLENDER_EEVEE_NEXT",
            "Unexpected source render engine")
    size = data.get("resolution")
    _expect(isinstance(size, list) and len(size) == 2
            and all(type(n) is int for n in size)
            and 480 <= size[0] <= 4096 and 640 <= size[1] <= 4096,
            "Invalid source QA frame resolution")
    _expect(source_blend_path.suffix == ".blend"
            and data.get("sourceBlendName") == source_blend_path.name,
            "Wrong original Blender source filename")
    source_sha = data.get("sourceBlendSha256")
    _expect(isinstance(source_sha, str)
            and HEX_SHA256.fullmatch(source_sha) is not None
            and sha256(source_blend_path) == source_sha,
            "Original Blender source digest mismatch")
    angles = data.get("angles")
    _expect(isinstance(angles, list) and len(angles) == len(VIEWS),
            "Four source-derived camera angles are required")
    hashes = {}
    for entry, (view, yaw) in zip(angles, VIEWS):
        _expect(isinstance(entry, dict)
                and entry.get("view") == view
                and type(entry.get("yawDeg")) in (int, float)
                and math.isfinite(entry["yawDeg"])
                and entry["yawDeg"] == yaw,
                f"Missing or incorrect {view} camera yaw")
        filename = f"linen-earth-model-{view}.png"
        _expect(entry.get("file") == filename,
                f"Unexpected {view} frame path")
        frame = manifest_path.parent / filename
        _expect(frame.resolve(strict=True).parent == manifest_path.parent
                and frame.is_file() and frame.stat().st_size >= 12000,
                f"Missing, escaped or undersized {view} frame")
        with frame.open("rb") as handle:
            header = handle.read(24)
        _expect(len(header) == 24 and header[:8] == PNG_MAGIC
                and header[12:16] == b"IHDR"
                and struct.unpack(">II", header[16:24]) == tuple(size),
                f"Invalid {view} PNG header/dimensions")
        expected = entry.get("sha256")
        _expect(isinstance(expected, str)
                and HEX_SHA256.fullmatch(expected) is not None
                and sha256(frame) == expected,
                f"Changed or untrusted {view} frame digest")
        hashes[view] = expected
    _expect(len(set(hashes.values())) == len(VIEWS),
            "Duplicate camera frames are not four independent views")
    _expect(candidate_path == manifest_path.parent / "linen-earth-model-front.png",
            "Reference comparison must use the manifest-bound front frame")
    return {
        "modelIdentityId": IDENTITY,
        "manifestSha256": sha256(manifest_path),
        "sourceBlendSha256": source_sha,
        "frameSha256ByView": hashes,
        "photographicMatchApproved": False,
        "tailorApproved": False,
    }


def verify_canonical_reference(reference_path: Path, repo_root: Path) -> Path:
    """Do not label a substituted photograph as the locked studio original."""
    expected = (Path(repo_root) / "public" / "designer" / "studio-tucked.webp").resolve(strict=True)
    actual = Path(reference_path).resolve(strict=True)
    _expect(actual == expected and actual.is_file(),
            "Reference is not the canonical checked-out Designer Studio photograph")
    return actual
