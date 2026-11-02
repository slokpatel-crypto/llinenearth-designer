"""Native Blender regression for bounded, real four-angle QA settings.

Does not render frames or modify source .blend.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

script = Path(__file__).resolve().parents[2] / "scripts/blender/render-linen-earth-model-qa.py"
spec = importlib.util.spec_from_file_location("titan_model_qa", script)
assert spec is not None and spec.loader is not None
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

for width, height, samples in (
    (480, 640, 8), (768, 1088, 48), (1920, 1080, 128), (2048, 2048, 256),
):
    qa.verify_render_settings(width, height, samples)

for width, height, samples in (
    (0, 1088, 48), (479, 1088, 48), (2049, 1088, 48),
    (768, 639, 48), (768, 3073, 48), (2048, 3072, 48),
    (768, 1088, 7), (768, 1088, 257),
):
    try:
        qa.verify_render_settings(width, height, samples)
    except ValueError:
        pass
    else:
        raise AssertionError(f"Unsafe render size/samples accepted: {width}, {height}, {samples}")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
for sample_count in (8, 48, 128):
    qa.apply_render_samples(scene, sample_count)
    eevee = getattr(scene, "eevee", None)
    assert eevee is not None
    assert any(getattr(eevee, name, None) == sample_count
               for name in ("taa_render_samples", "taa_samples")), (
        f"Requested QA samples were not actually applied: {sample_count}"
    )

print("TITAN_NATIVE_FOUR_ANGLE_RENDER_QA_SETTINGS_PASSED")
