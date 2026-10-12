"""Pure, unit-testable weighting for UNAPPROVED Blender mobile-LOD diagnostics.

Coordinates remain in metres; the authentic locked human mesh, authored cloth,
UV mapping and tailoring guides cannot be edited by this scoring function.
"""
import math


def skin_protection_weight(distance_m: float) -> float:
    """Smoothly prioritize curvature near measured real-body intersections.

    At or within 55mm preserve the original triangle geometry most strongly.
    Fade linearly smoothly to zero over 115mm. The Blender tool still runs
    independent BVH, UV and section-width checks before considering a probe.
    """
    if not math.isfinite(distance_m) or distance_m < 0:
        raise ValueError("Contact distance must be finite and nonnegative.")
    if distance_m <= 0.055:
        return 1.0
    if distance_m >= 0.115:
        return 0.0
    fraction = (0.115 - distance_m) / 0.060
    return fraction * fraction * (3 - 2 * fraction)
