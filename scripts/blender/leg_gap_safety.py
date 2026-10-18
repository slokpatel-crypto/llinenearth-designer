"""Deterministic maximum-safe trouser stance candidates (unapproved garment only).

The native source scan remains immutable. Collision evaluation happens in Blender
after cloth/body fitting, using independent world-space BVH measurements.
This helper only orders bounded rollback trials and does not certify fit.
"""
from __future__ import annotations

import math

from leg_stance_math import MAX_INBOARD_MM


def bounded_leg_gap_trials(requested_mm, *, step_mm=0.5):
    """Try the requested inward cloth shift first, then retreat to zero.

    The last trial is always zero. Real cloth/cloth AND cloth/body contact must
    be measured at each position. Never choose a shift merely from a guide.
    """
    if (isinstance(requested_mm, (str, bytes, bool))
            or not isinstance(requested_mm, (int, float))
            or not math.isfinite(requested_mm)
            or not 0 <= requested_mm <= MAX_INBOARD_MM):
        raise ValueError("Requested trouser inboard shift must be finite and within 0..8 mm")
    if (isinstance(step_mm, (str, bytes, bool))
            or not isinstance(step_mm, (int, float))
            or not math.isfinite(step_mm)
            or not 0 < step_mm <= 1):
        raise ValueError("Leg rollback step must be finite and within (0, 1] mm")

    values = [round(max(0.0, requested_mm - index * step_mm), 6)
              for index in range(math.ceil(requested_mm / step_mm) + 1)]
    if values[-1] != 0.0:
        values.append(0.0)
    # Zero may duplicate due to rounding at the final boundary.
    return tuple(value for index, value in enumerate(values)
                 if index == 0 or value != values[index - 1])
