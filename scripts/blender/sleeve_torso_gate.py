"""Independent sleeve-to-shirt contact receipt gate for the source-locked candidate.

The shirt armhole may intentionally touch its sleeve, so the source author
records its pre-correction BVH contact count. A candidate must not increase
that count, and the independent native preflight must reproduce the selected
counts from evaluated meshes. This is not tailor seam or photo approval.
"""
from __future__ import annotations

import json
import math


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
    requested = receipt.get("requestedMmPerSleeve")
    selected_shift = receipt.get("selectedMmPerSleeve")
    for name, value in (("requestedMmPerSleeve", requested),
                        ("selectedMmPerSleeve", selected_shift)):
        if (type(value) not in (int, float) or not math.isfinite(value)
                or not 0 <= value <= 22):
            raise ValueError(f"{name} must be a bounded finite source shift")
    if selected_shift > requested:
        raise ValueError("Selected sleeve shift exceeds the author request")
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


def validate_outer_cuff_torso_receipts(receipt_json_by_sleeve, measured_pairs):
    """Verify the *second* source cuff operation against the final evaluated mesh.

    A whole-sleeve shift and a later exterior contour are distinct stages.
    Preflight must compare the first-stage selected counts to the second-stage
    baseline, then compare the second-stage selected counts to CURRENT BVH.
    Never certify an intermediate mesh using the final mesh by accident.
    """
    if (not isinstance(receipt_json_by_sleeve, (list, tuple)) or
            len(receipt_json_by_sleeve) != 2 or
            any(not isinstance(raw, str) or not raw for raw in receipt_json_by_sleeve)):
        raise ValueError("Both exterior cuff contact receipts are required")
    if not isinstance(measured_pairs, (list, tuple)) or len(measured_pairs) != 2:
        raise ValueError("Two current exterior cuff BVH counts are required")
    measured = _pairs(list(measured_pairs), "current exterior cuff contact")
    try:
        receipts = [
            json.loads(raw, object_pairs_hook=_unique_keys, parse_constant=_reject_constant)
            for raw in receipt_json_by_sleeve
        ]
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid exterior cuff contact receipt: {exc}") from exc
    if any(not isinstance(item, dict) for item in receipts) or receipts[0] != receipts[1]:
        raise ValueError("Exterior cuff receipts disagree or are not objects")
    receipt = receipts[0]
    if (receipt.get("cuffContourMethod") != "original_mesh_outer_perimeter_only_unapproved"
            or receipt.get("nativeWorldSpaceCollisionFree") is not True
            or receipt.get("shirtTorsoContactNotWorsened") is not True
            or any(receipt.get(key) is not False for key in (
                "photoPoseApproved", "physicalDrapeApproved", "tailorApproved", "productionApproved"
            ))):
        raise ValueError("Exterior cuff is not an unapproved, contact-safe source trial")
    requested = receipt.get("requestedMmPerSleeve")
    selected_mm = receipt.get("selectedMmPerSleeve")
    for name, value in (("requestedMmPerSleeve", requested), ("selectedMmPerSleeve", selected_mm)):
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 36:
            raise ValueError(f"{name} must be a bounded finite exterior cuff shift")
    if selected_mm > requested:
        raise ValueError("Exterior cuff selected shift exceeds its request")
    baseline = _pairs(receipt.get("shirtTorsoPairsAtOriginal"), "outer cuff original torso")
    selected = _pairs(receipt.get("shirtTorsoPairsAtSelected"), "outer cuff selected torso")
    if any(after > before for before, after in zip(baseline, selected)):
        raise ValueError("Exterior cuff worsened source armhole contact")
    if selected != measured:
        raise ValueError("Final evaluated exterior cuff BVH disagrees with author")
    if selected_mm == 0 and selected != baseline:
        raise ValueError("Zero exterior cuff shift changed source armhole contact")
    trials = receipt.get("trials")
    if not isinstance(trials, list) or not trials:
        raise ValueError("Exterior cuff has no independently measured candidate trials")
    matches = []
    for trial in trials:
        if not isinstance(trial, dict):
            raise ValueError("Exterior cuff trial must be an object")
        mm = trial.get("requestedOuterContourMmPerSleeve")
        if type(mm) not in (int, float) or not math.isfinite(mm) or not 0 <= mm <= requested:
            raise ValueError("Exterior cuff trial has invalid source displacement")
        if mm == selected_mm:
            matches.append(trial)
    if len(matches) != 1:
        raise ValueError("Selected exterior cuff trial is missing or ambiguous")
    selected_trial = matches[0]
    if (selected_trial.get("nativeWorldSpaceCollisionFree") is not True
            or selected_trial.get("shirtTorsoContactNotWorsened") is not True
            or _pairs(selected_trial.get("shirtTorsoPairsAtTrial"), "selected trial torso") != selected
            or _pairs(selected_trial.get("shirtTorsoPairsAtOriginal"), "selected trial baseline") != baseline
            or _pairs(selected_trial.get("bodyContactPairs"), "selected trial skin") != [0, 0]
            or type(selected_trial.get("betweenSleevesContactPairs")) is not int
            or selected_trial["betweenSleevesContactPairs"] != 0):
        raise ValueError("Selected exterior cuff trial lacks consistent BVH proof")
    return {
        "shirtTorsoPairsAtOriginal": baseline,
        "shirtTorsoPairsAtSelected": selected,
        "independentNativeBvhMatchesReceipt": True,
        "photoPoseApproved": False,
        "productionApproved": False,
        "tailorSeamApproved": False,
    }
