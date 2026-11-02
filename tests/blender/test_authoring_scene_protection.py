"""Real Blender guard: authoring must preserve the source body .blend file.

Run from repository root with Blender 4.2+:
  blender --background --factory-startup --python-exit-code 1 \\
    --python tests/blender/test_authoring_scene_protection.py
"""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

script = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_garment_author", script)
assert spec is not None and spec.loader is not None
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)

with tempfile.TemporaryDirectory(prefix="titan-source-preservation-") as tmp:
    directory = Path(tmp)
    original = directory / "source-body.blend"
    original.write_bytes(b"unchanged-source-sentinel")
    candidate = directory / "authored-candidate.blend"
    assert author.safe_candidate_output(str(candidate), str(original)) == candidate.resolve()
    assert original.read_bytes() == b"unchanged-source-sentinel"
    assert not candidate.exists()

    alias = directory / "linked-source.blend"
    alias.symlink_to(original)
    for requested in (
        str(original),
        str(directory / "subdirectory" / ".." / "source-body.blend"),
        str(alias),
    ):
        try:
            author.safe_candidate_output(requested, str(original))
        except ValueError as error:
            assert "original" in str(error), requested
        else:
            raise AssertionError(f"Overwriting original source unexpectedly accepted: {requested}")

    for output, src in (
        (str(candidate), ""),
        (str(candidate), str(directory / "no-source.blend")),
        (str(candidate), str(directory / "invalid-source.txt")),
        (str(directory / "not-blend.glb"), str(original)),
    ):
        try:
            author.safe_candidate_output(output, src)
        except (ValueError, RuntimeError):
            pass
        else:
            raise AssertionError(f"Invalid source/destination accepted: {output}, {src}")
    assert original.read_bytes() == b"unchanged-source-sentinel"

print("TITAN_BLENDER_AUTHORING_SOURCE_PROTECTION_PASSED")
