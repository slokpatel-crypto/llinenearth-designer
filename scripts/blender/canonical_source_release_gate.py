"""Secondary release veto: a model ID is not actual face/body photo identity.

An explicit four-view owner visual-review attestation is required BEFORE any
measured production GLB export, even if all six-panel native mesh geometry
checks eventually pass. An attestation is not automated likeness detection,
supplier fabric proof, or physical tailor fit. Store review evidence privately.
"""
from __future__ import annotations
import hashlib
import json
from datetime import date
from pathlib import Path

from canonical_model_source_intake import ANGLES, intake_source

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
    # Do NOT store the receipt hash in this .blend and then require that
    # receipt to hash the same .blend. That creates an impossible SHA256 cycle.
    # The independently stored owner receipt binds the fully SAVED scene
    # bytes and four renders; see verify_external_owner_review_packet.
    return {"sourceSceneReviewFlagsPresent":True,
            "ownerEvidenceMustBeExternallyVerified":True,
            "productionApproved":False}

def verify_external_owner_review_packet(
    scene, *, scene_blend_path, reference_path, identity_spec_path, review_path
):
    """Check actual, private four-angle evidence, not scene labels alone.

    The receipt is a HUMAN attestation. It cannot perform visual recognition
    and never approves cloth fit, metric UV, supplier truth or production.
    """
    require_independent_source_photo_review(scene)
    if not review_path:
        raise ValueError("LINEN_OWNER_MODEL_REVIEW_RECEIPT is required for measured production export")
    doc=Path(review_path)
    if not doc.is_file() or doc.is_symlink():
        raise ValueError("Owner review file missing or symlinked")
    bytes_written=doc.read_bytes()
    sha=hashlib.sha256(bytes_written).hexdigest()
    # This digest is evidence of the external packet, not embedded in the
    # model that the packet fingerprints; avoid cyclic hash dependencies.
    try:
        packet=json.loads(bytes_written)
        identity=json.loads(Path(identity_spec_path).read_text(encoding="utf-8"))
    except (ValueError,UnicodeDecodeError,OSError) as error:
        raise ValueError("Owner review document or locked model spec is invalid") from error
    if not isinstance(packet,dict):
        raise ValueError("Owner review object is not a JSON mapping")
    if (packet.get("schemaVersion")!="linen-earth-owner-four-angle-review-v1" or
        packet.get("canonicalModelId")!=SOURCE_ID or
        packet.get("ownerConfirmsSameFacelessStudioModel") is not True):
        raise ValueError("No explicit owner photo-matched ORIGINAL mannequin approval")
    reviewer=packet.get("reviewerName")
    stamp=packet.get("reviewedAt")
    if not isinstance(reviewer,str) or len(reviewer.strip())<3:
        raise ValueError("Named independent reviewer missing")
    if not isinstance(stamp,str):
        raise ValueError("Owner review date missing")
    try:
        date.fromisoformat(stamp)
    except ValueError as error:
        raise ValueError("Owner review date must be genuine YYYY-MM-DD") from error
    must_check=("facelessHead","shouldersAndArms","backTuckAndWaist","legsAndShoes")
    checks=packet.get("manualVisualChecks")
    if not isinstance(checks,dict) or any(checks.get(key) is not True for key in must_check):
        raise ValueError("Independent owner has not approved all four visual checkpoints")
    view_paths=packet.get("viewPaths")
    if not isinstance(view_paths,dict) or set(view_paths)!=set(ANGLES):
        raise ValueError("Exact 4-angle photo-source render path list is missing")
    root=doc.parent.resolve()
    views={}
    for label in ANGLES:
        candidate=Path(view_paths[label])
        if candidate.is_absolute() or ".." in candidate.parts or not candidate.parts:
            raise ValueError("Four-angle render paths must stay inside private review directory")
        views[label]=root/candidate
    source=Path(scene_blend_path)
    reference=Path(reference_path)
    intake=intake_source(identity,reference,source,views)
    if not intake["readyForIndependentOwnerAndTailorVisualReview"]:
        raise ValueError("Missing/duplicate/bad source file or physical views in owner review packet")
    if (packet.get("sceneBlendSha256")!=intake["sourceBlendFingerprint"]["sha256"] or
        packet.get("canonicalReferenceSha256")!=intake["canonicalReferenceFingerprint"]["sha256"]):
        raise ValueError("Owner review is stale for this actual Blender scene or canonical photograph")
    rendered=packet.get("renderSha256")
    if not isinstance(rendered,dict) or set(rendered)!=set(ANGLES) or any(
        rendered[name]!=intake["sourceRenderFingerprints"][name]["sha256"]
        for name in ANGLES
    ):
        raise ValueError("Owner review render content changed since visual signoff")
    return {
        "independentOwnerSourcePhotoReviewPacketSha256":sha,
        "sameOriginalFacelessModelHumanAttestation":True,
        "actualProductionApproved":False,
    }
