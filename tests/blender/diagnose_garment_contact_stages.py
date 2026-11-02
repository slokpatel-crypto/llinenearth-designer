"""Native Blender QA: locate where real authored garment/body intersections arise.

Run from repo root with the existing identity-locked body .blend:
  blender --background .cache/linen-earth/linen-earth-officewear-body-base.blend \
    --python-exit-code 1 --python tests/blender/diagnose_garment_contact_stages.py -- \
    --output .cache/linen-earth/linen-earth-officewear-authored.blend

Wrap the real authoring module's modifier application without changing its
construction, dimensions, source asset, production model, or acceptance gates.
"""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
AUTHOR_PATH = ROOT / "scripts/blender/author-linen-earth-officewear.py"
PREFLIGHT_PATH = ROOT / "scripts/blender/preflight-linen-earth-officewear.py"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not import native Blender QA module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


author = load_module("titan_author", AUTHOR_PATH)
preflight = load_module("titan_preflight", PREFLIGHT_PATH)
body = bpy.data.objects.get(author.BODY_NAME)
if body is None or body.type != "MESH":
    raise RuntimeError("Real identity-locked Body mesh must exist for contact diagnostics.")
if (
    bpy.context.scene.get("linen_earth_model_identity_id") != author.MODEL_IDENTITY_ID
    or bpy.context.scene.get("linen_earth_model_identity_locked") is not True
):
    raise RuntimeError("Cannot diagnose an unverified or unlocked source body.")

stages = (
    ("LE_BODY_CLEARANCE", "afterClearance"),
    ("LE_GARMENT_SMOOTH", "afterSmoothing"),
    ("LE_CLOTH_THICKNESS", "afterThickness"),
)
stage_names = dict(stages)
observations = {}
real_apply = author.apply_modifier


def traced_apply(obj, modifier):
    name = modifier.name
    real_apply(obj, modifier)
    if name not in stage_names:
        raise RuntimeError(f"Unexpected authoring modifier in collision diagnostic: {name}")
    bpy.context.view_layer.update()
    count = preflight.intersection_pair_count(body, obj)
    if count is None:
        raise RuntimeError(f"Could not measure world-space contact after {name} on {obj.name}")
    entry = observations.setdefault(obj.name, {})
    key = stage_names[name]
    if key in entry:
        raise RuntimeError(f"Duplicate measured authoring stage {key} for {obj.name}")
    entry[key] = count
    print(f"TITAN_CONTACT_STAGE {obj.name} {key}: {count} world-space triangle pairs")


author.apply_modifier = traced_apply
author.main()  # The unchanged production candidate authoring routine

if set(observations) != set(author.GARMENT_OBJECTS):
    raise RuntimeError(f"Missing six-piece contact evidence: {sorted(observations)}")
if any(set(observations[name]) != set(stage_names.values()) for name in author.GARMENT_OBJECTS):
    raise RuntimeError("Each real garment must have clearance/smoothing/thickness measurements.")

result = {
    "version": "titan-native-garment-contact-stages-v1",
    "candidateOnly": True,
    "productionApproved": False,
    "modelIdentityId": author.MODEL_IDENTITY_ID,
    "stageOrder": [stage for _, stage in stages],
    "panels": {name: observations[name] for name in author.GARMENT_OBJECTS},
    "totals": {
        stage: sum(observations[name][stage] for name in author.GARMENT_OBJECTS)
        for _, stage in stages
    },
}
path = ROOT / ".cache/linen-earth/garment-contact-stages.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print("TITAN_REAL_CONTACT_STAGE_EVIDENCE " + json.dumps(result, sort_keys=True))
print("Candidate only: no production-fit certification, model promotion or source mutation.")
