"""Native Blender regression: unmeasured GLBs must not inherit prior measured sidecars.

Only tests output-preflight guard; no GLB is generated and no existing asset
or physical measurement is rewritten.
"""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path

import bpy

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

    # A failed measured-manifest serialization must not truncate or replace
    # the last complete evidence file paired with the existing GLB.
    old_manifest = sidecar.read_bytes()
    original_dump = export.json.dump
    def fail_after_partial_write(payload, handle, **kwargs):
        handle.write('{"partial":')
        raise RuntimeError("simulated manifest serialization failure")
    export.json.dump = fail_after_partial_write
    try:
        export.write_viewer_manifest(
            str(glb), 1.727, {"name": "fixture"},
            {"id": export.MODEL_IDENTITY_ID}, {"panels": {"fixture": {}}},
        )
    except RuntimeError as exc:
        assert "simulated manifest" in str(exc)
    else:
        raise AssertionError("Manifest serialization failure was swallowed")
    finally:
        export.json.dump = original_dump
    assert sidecar.read_bytes() == old_manifest
    assert not list(folder.glob(".linen-earth-viewer-*.tmp"))

    written = export.write_viewer_manifest(
        str(glb), 1.727, {"name": "fixture"},
        {"id": export.MODEL_IDENTITY_ID}, {"panels": {"fixture": {}}},
    )
    assert written == str(sidecar)
    manifest = json.loads(sidecar.read_text(encoding="utf-8"))
    assert manifest["modelIdentity"]["id"] == export.MODEL_IDENTITY_ID
    assert manifest["referenceHeightMm"] == 1727
    assert not list(folder.glob(".linen-earth-viewer-*.tmp"))

# A previously rejected UV research .blend cannot become exportable merely
# because its geometry preflight is improved in a future development branch.
scene=bpy.context.scene
assert export.reject_research_scene_for_export(scene) is None
for key,value in (
    ("linen_earth_asset_status","research-surface-grain-uv-unapproved"),
    ("titan_surface_uv_research_candidate_only",True),
    ("titan_surface_uv_production_approved",False),
):
    scene[key]=value
    try:
        export.reject_research_scene_for_export(scene)
    except RuntimeError as exc:
        assert "Research-only Blender scene" in str(exc),exc
    else:
        raise AssertionError(f"Experimental Blender scene escaped export block: {key}")
    del scene[key]

bpy.ops.mesh.primitive_cube_add(size=1)
panel=bpy.context.object
panel.name="ShirtTorsoFabric"
try:
    panel["titan_surface_uv_candidate_only"]=True
    try:
        export.reject_research_scene_for_export(scene)
    except RuntimeError as exc:
        assert "Research-only garment UV" in str(exc),exc
    else:
        raise AssertionError("Explicit research mesh flag escaped exporter quarantine")
    del panel["titan_surface_uv_candidate_only"]
    panel.data.uv_layers.new(name=export.RESEARCH_SURFACE_UV_LAYER)
    try:
        export.reject_research_scene_for_export(scene)
    except RuntimeError as exc:
        assert "Research-only garment UV" in str(exc),exc
    else:
        raise AssertionError("Named research UV layer escaped exporter quarantine")
finally:
    bpy.data.objects.remove(panel,do_unlink=True)
assert export.reject_research_scene_for_export(scene) is None
print("TITAN_NATIVE_RESEARCH_UV_EXPORT_QUARANTINE_PASSED")
print("TITAN_NATIVE_MEASURED_SIDECAR_EXPORT_GUARD_PASSED")
