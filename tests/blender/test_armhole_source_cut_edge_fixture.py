"""Native adversarial seam ownership regression, not physical garment evidence."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy

script = Path(__file__).resolve().with_name("test_actual_armhole_source_ownership.py")
spec = importlib.util.spec_from_file_location("titan_armhole_edge_analysis", script)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

mesh = bpy.data.meshes.new("TEST_ORIGINAL_BODY_ADJACENT_SOURCE_FACES")
mesh.from_pydata([
    (0.0, 0.0, 0.0),
    (1.0, 0.0, 0.0),
    (0.0, 1.0, 0.0),
    (1.0, 1.0, 0.0),
    (4.0, 0.0, 0.0),
    (5.0, 0.0, 0.0),
    (4.0, 1.0, 0.0),
], [], [(0, 1, 2), (1, 3, 2), (4, 5, 6)])
mesh.update(calc_edges=True)
first = module.source_cut_edge_keys(mesh, {0})
adjacent = module.source_cut_edge_keys(mesh, {1})
separated = module.source_cut_edge_keys(mesh, {2})
assert first & adjacent == {(1, 2)}, (first, adjacent)
assert first.isdisjoint(separated)
assert len(first) == len(adjacent) == len(separated) == 3
combined = module.source_cut_edge_keys(mesh, {0, 1})
assert (1, 2) not in combined and len(combined) == 4, combined

bad = bpy.data.meshes.new("TEST_NON_MANIFOLD_SOURCE")
bad.from_pydata(
    [(0,0,0),(1,0,0),(0,1,0),(1,1,0),(0,0,1)],
    [], [(0,1,2),(1,0,3),(0,1,4)],
)
bad.update(calc_edges=True)
try:
    module.source_cut_edge_keys(bad, {0,1,2})
except RuntimeError as exc:
    assert "Nonmanifold" in str(exc), str(exc)
else:
    raise AssertionError("Three faces on the same cut edge cannot be silently certified")

print("TITAN_NATIVE_ORIGINAL_SOURCE_ARMHOLE_CUT_EDGE_FIXTURE_PASSED")
