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
            or not 0.125 <= step_mm <= 1):
        # Each native trial rebuilds and checks source-scene BVH contacts.
        # Subprecision input must not create millions of near-identical probes.
        raise ValueError("Leg rollback step must be finite and within [0.125, 1] mm")
    if requested_mm > 0 and round(requested_mm, 6) == 0:
        raise ValueError("Leg rollback request is smaller than geometry precision")

    values = [round(max(0.0, requested_mm - index * step_mm), 6)
              for index in range(math.ceil(requested_mm / step_mm) + 1)]
    if values[-1] != 0.0:
        values.append(0.0)
    # Zero may duplicate due to rounding at the final boundary.
    return tuple(value for index, value in enumerate(values)
                 if index == 0 or value != values[index - 1])



def bounded_leg_gap_refinement_trials(unsafe_above_mm, safe_below_mm, *, subdivisions=4):
    """Probe only the bracket BETWEEN one rejected and one BVH-safe shift.

    Coarse <=0.5-mm rollback can miss a slightly narrower still-safe trouser
    stance. These candidates are ordered closer to the rejected geometry first,
    but each MUST undergo independent cloth/cloth and cloth/body BVH checks in
    Blender. This cannot infer safety from monotonicity or change body pose.
    """
    values = (unsafe_above_mm, safe_below_mm)
    if any(isinstance(v, (bool, str, bytes)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Refinement needs finite numeric source shifts")
    if (not 0 <= safe_below_mm < unsafe_above_mm <= MAX_INBOARD_MM
            or unsafe_above_mm-safe_below_mm > 1.0
            or unsafe_above_mm-safe_below_mm <= 0.00001):
        raise ValueError("Refinement needs a resolvable bounded rejected/safe bracket")
    if isinstance(subdivisions, bool) or not isinstance(subdivisions, int) or not 2 <= subdivisions <= 8:
        raise ValueError("Refinement subdivisions must be an integer from 2 to 8")
    candidates = tuple(round(
        unsafe_above_mm - (unsafe_above_mm-safe_below_mm)*step/subdivisions, 6
    ) for step in range(1, subdivisions))
    # Rounded, submicron contact trials must remain STRICTLY inside the actual
    # failed/safe BVH bracket. Returning a rounded endpoint could falsely
    # label an already rejected contact as a fresh refinement candidate.
    if not all(safe_below_mm < value < unsafe_above_mm for value in candidates):
        raise ValueError("Rounded leg refinement escaped the source contact bracket")
    if not all(a > b for a, b in zip(candidates, candidates[1:])):
        raise ValueError("Leg refinement produced duplicate BVH candidates")
    return candidates
