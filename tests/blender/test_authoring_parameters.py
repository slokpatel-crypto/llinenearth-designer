"""Native Blender regression: tailoring geometry inputs cannot silently clamp.

Run from repo root:
  blender --background --factory-startup --python-exit-code 1 \\
    --python tests/blender/test_authoring_parameters.py
"""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

script = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_garment_author", script)
assert spec is not None and spec.loader is not None
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)

for field, limits, accepted in (
    ("Body clearance", (3.0, 18.0), (3.0, 7.0, 18.0)),
    ("Cloth shell thickness", (0.6, 4.0), (0.6, 1.6, 4.0)),
):
    low, high = limits
    for mm in accepted:
        actual = author.bounded_measured_mm(mm, field, low, high)
        assert math.isclose(actual, mm / 1000.0, abs_tol=1e-12), (field, mm, actual)
    for bad in (-5.0, 0.0, low - 0.001, high + 0.001, 999.0,
                float("nan"), float("inf"), -float("inf")):
        try:
            author.bounded_measured_mm(bad, field, low, high)
        except ValueError as err:
            assert "not be silently resized" in str(err)
        else:
            raise AssertionError(f"{field} silently allowed {bad!r}")

print("TITAN_GARMENT_AUTHORING_EXACT_MEASURED_INPUTS_PASSED")
