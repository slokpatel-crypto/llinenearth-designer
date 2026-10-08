"""Physically bounded provisional shoe-depth fitting for the locked realistic body.

The deterministic GLB sole is roughly 540 mm long, while a low-ankle
body slice covers only part of the foot. A direct bbox match shrank
right-foot footwear to 25% of its original depth.
"""
from __future__ import annotations
import math

def shoe_depth_bounds(sample_y, stature_m):
    """Return a plausible toe/heel Y range; never claim tailor approval."""
    values = tuple(float(value) for value in sample_y)
    if len(values) < 20 or not all(math.isfinite(value) for value in values):
        raise ValueError("Footwear fitting needs at least 20 finite foot samples.")
    if not math.isfinite(stature_m) or not 1.2 <= stature_m <= 2.2:
        raise ValueError("Locked body stature is outside the calibrated adult range.")
    low, high = min(values), max(values)
    length = max(high-low+0.028, max(0.220, min(0.310, 0.155*stature_m)))
    if length > 0.350:
        raise ValueError("Locked foot requires implausible shoe length; inspect body geometry.")
    middle = (low+high)*0.5
    return middle-length*0.5, middle+length*0.5
