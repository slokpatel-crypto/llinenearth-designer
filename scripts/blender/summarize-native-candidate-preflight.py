#!/usr/bin/env python3
"""Fail-closed evidence from a real native Blender source→candidate→preflight run.

The source candidate remains UNAPPROVED even if structural checks later pass.
Never convert a failed Blender bootstrap, missing report, or missing garment
panels into a successful 'expected preflight failure' QA result.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"
GARMENT_OBJECTS = (
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
)


def find_blender_preflight_report(log: str) -> dict:
    decoder = json.JSONDecoder()
    for offset, character in enumerate(log):
        if character != "{":
            continue
        try:
            document, _ = decoder.raw_decode(log[offset:])
        except json.JSONDecodeError:
            continue
        if isinstance(document, dict) and document.get("gate") == "linen-earth-officewear-scene-preflight-v1":
            return document
    raise RuntimeError("Native Blender preflight did not emit its structured gate report.")


def legacy_waist_reason_count(reasons: list[str], contacts: dict) -> int:
    """Check all real panel crossings yet keep the historic waist comparison stable.

    Every new positive pair must remain one explicit production rejection.
    Only those independently matched NEW reasons are excluded from the legacy
    baseline; no fit tolerance, intersection count or preflight gate is relaxed.
    """
    pairs = {
        f"{left}::{right}"
        for index, left in enumerate(GARMENT_OBJECTS)
        for right in GARMENT_OBJECTS[index + 1:]
    }
    if not isinstance(contacts, dict) or set(contacts) != pairs:
        raise RuntimeError("Native rejection must include all fifteen garment contact pairs.")
    if any(type(value) is not int or value < 0 for value in contacts.values()):
        raise RuntimeError("Garment contact evidence must have real nonnegative intersection counts.")
    separately_gated = {
        "TrouserLegLFabric::TrouserLegRFabric",
        "ShirtTorsoFabric::TrouserWaistFabric",
    }
    new_reasons = 0
    for pair, count in contacts.items():
        if pair in separately_gated:
            continue
        matches = [
            reason for reason in reasons
            if reason.startswith(f"{pair} has ")
        ]
        if len(matches) != (1 if count > 0 else 0) or (
            count > 0 and not matches[0].startswith(
                f"{pair} has {count} intersecting triangle pairs; "
            )
        ):
            raise RuntimeError(f"Unreviewed real garment crossing must block preflight: {pair}.")
        new_reasons += len(matches)
    return len(reasons) - new_reasons


def summarize(log: str, blender_exit_code: int) -> dict:
    if blender_exit_code != 1:
        raise RuntimeError(
            f"Expected explicit preflight rejection (exit 1), got {blender_exit_code}; "
            "do not mark a crash, absent check, or unreviewed candidate as passing."
        )
    report = find_blender_preflight_report(log)
    if report.get("ready") is not False:
        raise RuntimeError("A ready/ambiguous Blender candidate cannot be labeled rejected.")
    reasons = report.get("reasons")
    if not isinstance(reasons, list) or not reasons or any(
        not isinstance(message, str) or not message.strip() for message in reasons
    ):
        raise RuntimeError("Real candidate rejection must carry explicit, nonempty reasons.")
    identity = report.get("modelIdentity")
    if not isinstance(identity, dict) or identity.get("id") != MODEL_IDENTITY_ID or identity.get("locked") is not True:
        raise RuntimeError("The tested candidate did not retain the locked Studio model identity.")
    height = report.get("bodyHeightMm")
    if isinstance(height, bool) or not isinstance(height, (int, float)) or not math.isfinite(height) or abs(height - 1727) > 20:
        raise RuntimeError("The tested candidate lacks a realistic measured 1727mm source body.")
    names = report.get("requiredGarmentObjects")
    if names != list(GARMENT_OBJECTS):
        raise RuntimeError("The tested candidate did not use the exact six-piece garment contract.")
    objects = report.get("objects")
    if not isinstance(objects, dict) or any(
        not isinstance(objects.get(name), dict)
        or objects[name].get("triangles", 0) <= 0
        or objects[name].get("uvLayers", 0) <= 0
        for name in GARMENT_OBJECTS
    ):
        raise RuntimeError("Candidate body-shell authoring did not produce all six real UV-mapped meshes.")
    old_reason_count = legacy_waist_reason_count(reasons, report.get("garmentPairIntersections"))
    return {
        "version": "titan-native-source-candidate-rejection-v1",
        "candidateOnly": True,
        "productionApproved": False,
        "realBodySourceMeasured": True,
        "modelIdentityId": MODEL_IDENTITY_ID,
        "bodyHeightMm": height,
        "requiredGarmentObjects": list(GARMENT_OBJECTS),
        "preflightReady": False,
        "nativeBlenderExitCode": blender_exit_code,
        "rejectionReasonCount": len(reasons),
        "legacyWaistRejectionReasonCount": old_reason_count,
        "reasons": reasons,
        "identityFitMeasurementsMm": report.get("identityFitMeasurementsMm"),
        "boundaryIntersections": report.get("boundaryIntersections"),
        "garmentPairIntersections": report.get("garmentPairIntersections"),
        "meshSummary": {
            name: {
                "vertices": objects[name].get("vertices"),
                "triangles": objects[name].get("triangles"),
                "uvLayers": objects[name].get("uvLayers"),
            } for name in GARMENT_OBJECTS
        },
        "measuredFabricRepeatVerified": False,
        "physicalTailorApproved": False,
        "photographicIdentityApproved": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--exit-code", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = summarize(args.log.read_text(encoding="utf-8", errors="replace"), args.exit_code)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Confirmed native six-mesh source candidate rejection: {len(result['reasons'])} reasons.")
    for reason in result["reasons"][:16]:
        print("BLOCKED: " + reason)
    print("Candidate only: no model promotion or physical/textile sign-off.")


if __name__ == "__main__":
    main()
