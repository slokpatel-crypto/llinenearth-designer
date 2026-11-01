#!/usr/bin/env python3
"""Evidence-only intake for the ORIGINAL Linen Earth photographed 3D mannequin.

No single picture proves an object's hidden surfaces or mesh identity.
This preflight hashes supplied source files and four genuinely distinct views
to create a REVIEW PACKET, never a production acceptance certificate.

No files are modified, no paid AI, no source scan substituted. A missing owner
source is a BLOCKED result, not an excuse to invent a comparable mannequin.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

MODEL_ID="linen-earth-studio-model-v1"
REFERENCE="/designer/studio-tucked.webp"
ANGLES=("front","three-quarter","side","back")
REQUIRED_TARGETS=(
    "height","shoulderSeamWidth","outerArmSilhouette","shirtWaistWidth",
    "trouserWaistWidth","handCenterSpacing","legCenterSpacing","hemWidth"
)


def fingerprint(path, kind, *, minimum_bytes=16):
    path=Path(path)
    if not path.is_file():
        return None,"missing_file"
    if not path.is_symlink() and path.stat().st_size < minimum_bytes:
        return None,"file_too_small"
    if path.is_symlink():
        return None,"symbolic_link_not_accepted"
    size=path.stat().st_size
    with path.open("rb") as inp:
        head=inp.read(16)
        inp.seek(0)
        digest=hashlib.sha256()
        for block in iter(lambda:inp.read(1024*1024),b""):
            digest.update(block)
    if kind=="blend":
        if path.suffix.lower()!=".blend" or head[:7]!=b"BLENDER" or size<1024:
            return None,"not_a_blender_file"
    elif kind=="image":
        png=head.startswith(b"\x89PNG\r\n\x1a\n")
        jpeg=head.startswith(b"\xff\xd8\xff")
        webp=head[:4]==b"RIFF" and head[8:12]==b"WEBP"
        if not (png or jpeg or webp) or size<1024:
            return None,"invalid_image_signature"
    else:
        raise ValueError("Unsupported source artifact kind")
    return {"sha256":digest.hexdigest(),"bytes":size},None


def verify_identity_spec(spec):
    if not isinstance(spec,dict) or spec.get("version")!=MODEL_ID or spec.get("referenceImage")!=REFERENCE:
        raise ValueError("Different or unlocked canonical studio reference")
    dims=spec.get("physicalTargetsMm")
    if not isinstance(dims,dict) or any(
        type(dims.get(key)) not in (int,float) or
        not math.isfinite(dims[key]) or dims[key]<=0 for key in REQUIRED_TARGETS
    ):
        raise ValueError("Canonical identity measurements unavailable")
    if spec.get("referenceHeightMm")!=1727:
        raise ValueError("1727 mm photographed mannequin lock mismatch")
    views=spec.get("views",[])
    if not isinstance(views,list) or [row.get("id") for row in views if isinstance(row,dict)]!=list(ANGLES):
        raise ValueError("Reference viewing angles are not locked")
    return True


def intake_source(identity_spec,reference_path,model_path=None,views=None):
    verify_identity_spec(identity_spec)
    if views is None:
        views={}
    if not isinstance(views,dict) or any(k not in ANGLES for k in views):
        raise ValueError("Unrecognized photographic view label")
    ref,ref_error=fingerprint(reference_path,"image",minimum_bytes=1024)
    if ref_error:
        raise ValueError("Canonical reference missing or invalid: "+ref_error)
    master=None
    reasons=[]
    if model_path is None:
        reasons.append("owner_original_photo_matched_blend_not_supplied")
    else:
        master,error=fingerprint(model_path,"blend",minimum_bytes=1024)
        if error:
            reasons.append("source_3d_"+error)
    captured={}
    distinct=set()
    for angle in ANGLES:
        if angle not in views:
            reasons.append("missing_"+angle+"_independent_view")
            continue
        info,error=fingerprint(views[angle],"image",minimum_bytes=1024)
        if error:
            reasons.append(angle+"_"+error)
            continue
        if info["sha256"]==ref["sha256"]:
            reasons.append(angle+"_is_copy_of_canonical_studio_photo")
        if info["sha256"] in distinct:
            reasons.append(angle+"_duplicates_other_supplied_view")
        distinct.add(info["sha256"])
        captured[angle]=info
    complete=master is not None and len(captured)==4 and not reasons
    return {
        "schemaVersion":"linen-earth-canonical-source-intake-v1",
        "canonicalModelId":MODEL_ID,
        "canonicalReferenceImage":REFERENCE,
        "canonicalReferenceFingerprint":ref,
        "canonicalReferenceViewsAvailable":1,
        "sourceBlendFingerprint":master,
        "sourceFromOwnerPhotoMatchedMasterProven":False,
        "sourceRenderFingerprints":captured,
        "fourIndependentRendersCollected":len(captured)==4 and len(distinct)==4,
        "readyForIndependentOwnerAndTailorVisualReview":complete,
        "blockers":reasons,
        "reviewerIdentityAndApprovalPresent":False,
        "samePhotographicModelApproved":False,
        "actualShoulderAndTuckPatternMeasured":False,
        "clothPhysicalScaleAndGrainVerified":False,
        "customerProductionReady":False,
        "humanReviewRequired":True,
    }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--identity-spec",type=Path,required=True)
    parser.add_argument("--reference",type=Path,required=True)
    parser.add_argument("--source-blend",type=Path)
    for name in ANGLES:
        parser.add_argument("--"+name,type=Path)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--require-review-packet",action="store_true")
    parser.add_argument("--assert-blocked",action="store_true")
    opts=parser.parse_args()
    spec=json.loads(opts.identity_spec.read_text(encoding="utf-8"))
    views={name:getattr(opts,name.replace("-","_")) for name in ANGLES
           if getattr(opts,name.replace("-","_")) is not None}
    report=intake_source(spec,opts.reference,opts.source_blend,views)
    opts.output.parent.mkdir(parents=True,exist_ok=True)
    opts.output.write_text(json.dumps(report,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    print("TITAN_CANONICAL_MANNEQUIN_SOURCE_INTAKE="+json.dumps(report,sort_keys=True))
    if opts.require_review_packet and not report["readyForIndependentOwnerAndTailorVisualReview"]:
        raise SystemExit("BLOCKED: genuine source/4-view model intake incomplete")
    if opts.assert_blocked and report["readyForIndependentOwnerAndTailorVisualReview"]:
        raise SystemExit("Unexpected source package: CI must not silently approve it")


if __name__=="__main__":
    main()
