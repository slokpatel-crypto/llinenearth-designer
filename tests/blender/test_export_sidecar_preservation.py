"""Native Blender regression: unmeasured GLBs must not inherit prior measured sidecars.

Only tests output-preflight guard; no GLB is generated and no existing asset
or physical measurement is rewritten.
"""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

source = Path(__file__).resolve().parents[2] / "scripts/blender/export-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_export", source)
assert spec is not None and spec.loader is not None
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)

with tempfile.TemporaryDirectory(prefix="titan-export-pair-safety-") as temp:
    folder = Path(temp)
    glb = folder / "linen-earth-candidate.glb"
    sidecar = folder / "linen-earth-candidate.viewer.json"
    assert export.validate_export_destination(str(glb), None) == str(sidecar)
    glb.write_bytes(b"unchanged-old-candidate")
    sidecar.write_text('{"panels":{"old":"physical evidence"}}', encoding="utf-8")
    for spec_path in (None, ""):
        try:
            export.validate_export_destination(str(glb), spec_path)
        except RuntimeError as exc:
            assert "Refusing to overwrite a GLB" in str(exc)
        else:
            raise AssertionError("Unmeasured GLB could retain stale measured sidecar")
    assert glb.read_bytes() == b"unchanged-old-candidate"
    assert sidecar.read_text(encoding="utf-8") == '{"panels":{"old":"physical evidence"}}'
    # Explicit panel-spec changes are permitted, though load_panel_spec
    # separately validates their content before exporting.
    assert export.validate_export_destination(str(glb), str(folder / "measured.json")) == str(sidecar)
    for path in ("linen-earth-candidate.gltf", "linen-earth-candidate.blend"):
        try:
            export.validate_export_destination(str(folder / path), "measured.json")
        except RuntimeError as exc:
            assert "end in .glb" in str(exc)
        else:
            raise AssertionError("Non-GLB export target accepted")
    # Different output basename cannot steal the old sidecar.
    clean = folder / "different-candidate.glb"
    assert export.validate_export_destination(str(clean), None) == str(folder / "different-candidate.viewer.json")

print("TITAN_NATIVE_MEASURED_SIDECAR_EXPORT_GUARD_PASSED")
