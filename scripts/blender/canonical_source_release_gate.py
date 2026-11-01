"""Secondary release veto: a model ID is not actual face/body photo identity.

An explicit four-view owner visual-review attestation is required BEFORE any
measured production GLB export, even if all six-panel native mesh geometry
checks eventually pass. An attestation is not automated likeness detection,
supplier fabric proof, or physical tailor fit. Store review evidence privately.
"""
from __future__ import annotations
import re

SOURCE_ID="linen-earth-studio-model-v1"
REFERENCE_IMAGE="/designer/studio-tucked.webp"
OWNER_REVIEW_STATUS="owner_independent_four_angle_exact_faceless_studio_model_approved"


def require_independent_source_photo_review(scene):
    if scene.get("linen_earth_model_identity_id")!=SOURCE_ID:
        raise ValueError("Canonical photographed model ID absent")
    if scene.get("linen_earth_model_reference_image")!=REFERENCE_IMAGE:
        raise ValueError("Original canonical mannequin photograph changed")
    if scene.get("linen_earth_model_identity_locked") is not True:
        raise ValueError("Canonical original studio model lock disabled")
    if scene.get("linen_earth_source_photo_visual_parity_approved") is not True:
        raise ValueError("Generic scanned person is not the original faceless mannequin; owner photo parity not approved")
    count=scene.get("linen_earth_source_photo_reference_count")
    if type(count) is not int or count<4:
        raise ValueError("Independent front/three-quarter/side/back identity review is missing")
    if scene.get("linen_earth_source_photo_visual_parity_status")!=OWNER_REVIEW_STATUS:
        raise ValueError("Four-angle exact-faceless-source owner review status absent")
    evidence=scene.get("linen_earth_source_photo_owner_review_sha256")
    if not isinstance(evidence,str) or not re.fullmatch(r"[0-9a-f]{64}",evidence):
        raise ValueError("SHA256 owner review packet provenance absent")
    # Attestation is required but NOT alone a production release: Blender
    # collision/UV, supplier fibre truth, tailor fit and owner approval gates
    # remain independently mandatory.
    return {"sourcePhotoHumanReviewAttested":True,
            "reviewPacketSha256":evidence,
            "productionApproved":False}
