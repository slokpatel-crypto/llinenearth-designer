"""Experimental cloth-only sleeve stance, preserving original body and guides.

A smoother vertical sleeve inboard contour may help the source-derived candidate
approach the canonical photographed arm spacing. This is NOT an armature pose
correction; hands remain on the locked source and all real-body BVH/4-view
acceptance rules still apply. Keep unapproved until measured and inspected.
"""
from __future__ import annotations
import math

MAX_INBOARD_MM = 22.0
MIN_CUFF_RATIO = 0.61
SHOULDER_RELEASE_RATIO = 0.79


def candidate_sleeve_inboard_mm(panel, body_height_ratio, requested_mm):
    if panel not in ("ShirtSleeveLFabric", "ShirtSleeveRFabric"):
        raise ValueError("Cuff spacing adjustment is sleeve-only")
    if any(isinstance(x, (bool, str, bytes)) or not isinstance(x, (int, float))
           or not math.isfinite(x) for x in (body_height_ratio, requested_mm)):
        raise ValueError("Cuff stance uses finite numeric parameters")
    if not 0 <= requested_mm <= MAX_INBOARD_MM:
        raise ValueError("Cuff adjustment cannot exceed 22 mm per sleeve")
    if not 0 <= body_height_ratio <= 1:
        raise ValueError("Body height ratio must be in [0,1]")
    if body_height_ratio <= MIN_CUFF_RATIO:
        fade = 1.0
    elif body_height_ratio >= SHOULDER_RELEASE_RATIO:
        fade = 0.0
    else:
        t = (SHOULDER_RELEASE_RATIO - body_height_ratio) / (
            SHOULDER_RELEASE_RATIO - MIN_CUFF_RATIO
        )
        fade = t * t * (3.0 - 2.0 * t)
    return (requested_mm if panel == "ShirtSleeveLFabric" else -requested_mm) * fade
