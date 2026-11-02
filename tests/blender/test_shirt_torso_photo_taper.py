"""Native Blender: taper experimental shirt shell by locked photo guides."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path

source = Path(__file__).resolve().parents[2] / "scripts/blender/author-linen-earth-officewear.py"
spec = importlib.util.spec_from_file_location("titan_author", source)
assert spec and spec.loader
author = importlib.util.module_from_spec(spec)
spec.loader.exec_module(author)

waist, shoulder = 1.11, 1.45
fn = author.shirt_torso_half_width_at_height
assert math.isclose(fn(waist, waist, shoulder), 0.159, abs_tol=1e-9)
assert math.isclose(fn(shoulder, waist, shoulder), 0.245, abs_tol=1e-9)
assert math.isclose(fn((waist + shoulder)/2, waist, shoulder), 0.202, abs_tol=1e-9)
assert math.isclose(fn(waist-0.1, waist, shoulder), 0.159, abs_tol=1e-9)
assert math.isclose(fn(shoulder+0.1, waist, shoulder), 0.245, abs_tol=1e-9)
for bad in (float("nan"), float("inf"), -float("inf")):
    try:
        fn(bad, waist, shoulder)
    except ValueError:
        pass
    else:
        raise AssertionError(f"Invalid photographic sample accepted: {bad}")
try:
    fn(waist, shoulder, waist)
except ValueError:
    pass
else:
    raise AssertionError("Invalid waist/shoulder ordering accepted")
print("TITAN_NATIVE_PHOTO_GUIDED_TORSO_WAIST_TAPER_PASSED")
