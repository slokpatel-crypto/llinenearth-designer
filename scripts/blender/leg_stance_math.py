"""Bounded unapproved trouser stance experiment on existing body-derived cloth.

The native source-candidate preflight measured 223.39mm leg centres against
the locked 210mm guide (2026-10-18 run 39105743107). A symmetric 7mm shift
per garment leg is a physical-shell experiment, not a new body/person and not
an approved posture or fabric-drape measurement. BVH and coverage must rerun.
"""
from __future__ import annotations

import math

MAX_INBOARD_MM = 8.0


def candidate_leg_inboard_mm(panel, height_ratio, requested_mm):
    if panel not in ("TrouserLegLFabric", "TrouserLegRFabric"):
        raise ValueError("Trouser stance adjustment is leg-shell only")
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in (height_ratio, requested_mm)):
        raise ValueError("Leg stance needs finite numeric values")
    if not 0 <= height_ratio <= 1 or not 0 <= requested_mm <= MAX_INBOARD_MM:
        raise ValueError("Leg stance height/shift outside bounded candidate range")
    if height_ratio <= 0.10 or height_ratio >= 0.52:
        fade = 0.0
    elif height_ratio < 0.28:
        t = (height_ratio - 0.10) / 0.18
        fade = t * t * (3 - 2*t)
    elif height_ratio <= 0.42:
        fade = 1.0
    else:
        t = (0.52 - height_ratio) / 0.10
        fade = t * t * (3 - 2*t)
    return (requested_mm if panel == "TrouserLegLFabric" else -requested_mm) * fade


MAX_INNER_SEAM_RELIEF_MM = 10.0


def candidate_inner_seam_relief_mm(panel, height_ratio, x_from_midline_m, peak_mm):
    """Small garment-only OUTBOARD displacement around the crotch seam.

    Applies solely to the inner-leg overlap band seen in native mesh evidence
    at height ratios 0.4..0.5 and near the midline. Does not alter body pose,
    lower-leg silhouette, hem, fabric properties or human fit approval.
    """
    if panel not in ("TrouserLegLFabric", "TrouserLegRFabric"):
        raise ValueError("Only source trouser legs may receive inner-seam relief")
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
           or not math.isfinite(v)
           for v in (height_ratio, x_from_midline_m, peak_mm)):
        raise ValueError("Inner seam candidate needs finite numeric coordinates")
    if not 0 <= height_ratio <= 1 or not 0 <= peak_mm <= MAX_INNER_SEAM_RELIEF_MM:
        raise ValueError("Inner seam candidate outside approved geometry-only bound")

    def smoothstep(t):
        t = min(1.0, max(0.0, t))
        return t * t * (3 - 2 * t)

    lower = smoothstep((height_ratio - .39) / .05)
    upper = smoothstep((.55 - height_ratio) / .05)
    near_midline = 1.0 - smoothstep((abs(x_from_midline_m) - .015) / .065)
    amount = peak_mm * lower * upper * near_midline
    return -amount if panel == "TrouserLegLFabric" else amount
