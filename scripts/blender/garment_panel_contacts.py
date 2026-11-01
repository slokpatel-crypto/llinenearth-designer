"""Independent, fail-closed garment-to-garment contact review.

This is evidence about TRIANGLE CROSSINGS, not a sewn-seam certificate. The
tucked torso/waist junction and left/right trouser-leg split already have
separate established gates in the native preflight; do not re-interpret or
weaken either of those thresholds here.

All other distinct garment pairs must be measured. A crossing at a proposed
sewn join remains UNAPPROVED until the topology and construction are authored
and independently reviewed. No numeric tolerance is invented for seams.
"""

from itertools import combinations

PANELS = (
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
)

# Named candidate joins, not approved topology or permission to intersect.
PROPOSED_SEWN_JOINS = frozenset({
    frozenset(("ShirtTorsoFabric", "ShirtSleeveLFabric")),
    frozenset(("ShirtTorsoFabric", "ShirtSleeveRFabric")),
    frozenset(("TrouserWaistFabric", "TrouserLegLFabric")),
    frozenset(("TrouserWaistFabric", "TrouserLegRFabric")),
})

ESTABLISHED_SEPARATE_GATES = frozenset({
    frozenset(("ShirtTorsoFabric", "TrouserWaistFabric")),  # tuck <=120
    frozenset(("TrouserLegLFabric", "TrouserLegRFabric")), # zero crossings
})


def remaining_panel_pairs():
    """The 13 pairs not covered by the two existing panel-vs-panel gates."""
    return tuple(
        (left, right)
        for left, right in combinations(PANELS, 2)
        if frozenset((left, right)) not in ESTABLISHED_SEPARATE_GATES
    )


def review_panel_contacts(garments, count_intersections):
    """Return (evidence, rejection_reasons) using independent evaluated BVHs.

    garments: name -> Blender object (or None). count_intersections must
    return None when a mesh is unavailable/unmeasurable, never fabricated 0.
    A successful zero crossing is geometric evidence only, not seam approval.
    """
    evidence = {}
    reasons = []
    for left, right in remaining_panel_pairs():
        key = left + "__" + right
        kind = (
            "proposed_sewn_join_unverified"
            if frozenset((left, right)) in PROPOSED_SEWN_JOINS
            else "unintended_panel_contact"
        )
        measured = count_intersections(garments.get(left), garments.get(right))
        # bool is an int in Python; True is not a legitimate BVH pair count.
        count = measured if type(measured) is int and measured >= 0 else None
        status = (
            "unmeasured" if count is None else
            "zero_crossings_not_seam_approval" if count == 0 else
            "crossings_unapproved"
        )
        evidence[key] = {
            "leftPanel": left,
            "rightPanel": right,
            "relationship": kind,
            "intersectionTrianglePairs": count,
            "status": status,
            "sewnConstructionApproved": False,
        }
        if count is None:
            reasons.append(
                f"Unmeasured garment panel contact {left}/{right}; "
                "the native boundary gate cannot approve unknown geometry."
            )
        elif count:
            reasons.append(
                f"Unapproved garment panel crossing {left}/{right}: "
                f"{count} intersecting triangle pairs ({kind}); reconstruct "
                "the actual panel join/seam or remove unintended intersections "
                "before production review."
            )
    return evidence, reasons
