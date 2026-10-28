"""Independent sleeve-to-shirt contact receipt gate for the source-locked candidate.

The shirt armhole may intentionally touch its sleeve, so the source author
records its pre-correction BVH contact count. A candidate must not increase
that count, and the independent native preflight must reproduce the selected
counts from evaluated meshes. This is not tailor seam or photo approval.
"""
from __future__ import annotations

import json


def _unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate key in sleeve contact receipt")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError(f"Nonfinite value in sleeve contact receipt: {value}")


def _pairs(value, name):
    if (not isinstance(value, list) or len(value) != 2 or
            any(type(number) is not int or number < 0 for number in value)):
        raise ValueError(f"{name} must be two nonnegative integer BVH counts")
    return value


def validate_sleeve_torso_receipts(receipt_json_by_sleeve, measured_pairs):
    """Fail closed on missing, stale, forged-type or conflicting native evidence.

    Both sleeves must contain the same author receipt. The preflight uses its
    own current evaluated BVH counts, never only the author's boolean flag.
    A legitimate sewn armhole may have preexisting contact, but the cuff
    operation cannot add more intersections on either side.
    """
    if (not isinstance(receipt_json_by_sleeve, (list, tuple)) or
            len(receipt_json_by_sleeve) != 2 or
            any(not isinstance(value, str) or not value for value in receipt_json_by_sleeve)):
        raise ValueError("Both source sleeve contact receipts are required")
    if (not isinstance(measured_pairs, (list, tuple)) or
            len(measured_pairs) != 2):
        raise ValueError("Two independently measured sleeve/torso counts required")
    measured = _pairs(list(measured_pairs), "measured sleeve/torso contact")
    try:
        parsed = [
            json.loads(raw, object_pairs_hook=_unique_keys, parse_constant=_reject_constant)
            for raw in receipt_json_by_sleeve
        ]
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid source sleeve contact receipt: {exc}") from exc
    if any(not isinstance(item, dict) for item in parsed) or parsed[0] != parsed[1]:
        raise ValueError("Sleeve contact receipts disagree or are not objects")
    receipt = parsed[0]
    if (receipt.get("nativeWorldSpaceCollisionFree") is not True or
            receipt.get("shirtTorsoContactNotWorsened") is not True):
        raise ValueError("Sleeve contact author did not approve the collision trial")
    baseline = _pairs(receipt.get("shirtTorsoPairsAtOriginal"), "original sleeve/torso")
    selected = _pairs(receipt.get("shirtTorsoPairsAtSelected"), "selected sleeve/torso")
    if any(after > before for before, after in zip(baseline, selected)):
        raise ValueError("Selected sleeve geometry worsened source armhole contact")
    if selected != measured:
        raise ValueError("Independent sleeve/torso BVH counts differ from author receipt")
    return {
        "shirtTorsoPairsAtOriginal": baseline,
        "shirtTorsoPairsAtSelected": selected,
        "independentNativeBvhMatchesReceipt": True,
        "productionApproved": False,
        "tailorSeamApproved": False,
    }
