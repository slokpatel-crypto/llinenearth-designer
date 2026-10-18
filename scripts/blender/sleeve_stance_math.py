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


def source_arm_band_geometry(points_xyz, *, guide_z_m, side,
                             source_center_x_m=0.0,
                             min_lateral_offset_m=0.155, band_half_height_m=0.06):
    """Measure the original BODY arm-side envelope at the cuff guide height.

    This keeps the scanned body untouched and reports only a lateral band
    centre derived from actual world-space source vertices, NOT an anatomical
    hand-joint location or permission to alter the locked model pose. Cuff
    cloth shifting away from a measured arm shell can be collision-unsafe.
    """
    controls = (guide_z_m, source_center_x_m,
                min_lateral_offset_m, band_half_height_m)
    if (isinstance(side, bool) or side not in (-1, 1)
            or any(isinstance(v, (str, bytes, bool))
                   or not isinstance(v, (int, float)) or not math.isfinite(v)
                   for v in controls)
            or not 0 < min_lateral_offset_m <= .5
            or not 0 < band_half_height_m <= .12):
        raise ValueError("Body arm-band reference needs finite bounded guides")
    leftmost = math.inf
    rightmost = -math.inf
    n = 0
    for xyz in points_xyz:
        if len(xyz) != 3 or any(
            isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
            or not math.isfinite(v) for v in xyz
        ):
            raise ValueError("Body arm-band source positions need finite XYZ")
        x, _, z = xyz
        if (abs(z-guide_z_m) <= band_half_height_m and
                side*(x-source_center_x_m) >= min_lateral_offset_m):
            leftmost = min(leftmost, x)
            rightmost = max(rightmost, x)
            n += 1
    if n < 4:
        return None
    return {
        "sourceSideBandCentreXMm": round((leftmost+rightmost)*500.0, 4),
        "sourceSideBandWidthMm": round((rightmost-leftmost)*1000.0, 4),
        "sampledSourceVertexCount": n,
        "anatomicalJointCentreMeasured": False,
        "photoPoseApproved": False,
        "productionApproved": False,
    }
