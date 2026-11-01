"""Source-sampled sleeve centreline, not a guessed hand-pose correction.

Uses actual immutable scanned Body surface slices to position each sleeve's
cross-section over the source forearm. This generic CC0 body is NOT proven to
be the canonical photographed model. Values are source observations only:
garment ease, fabric mechanics and production fit remain unverified.
"""
from __future__ import annotations
import math
from statistics import median


def _finite_vec(x):
    return (isinstance(x,(tuple,list)) and len(x)==3 and
            all(type(v) in (int,float) and math.isfinite(v) for v in x))


def sample_scanned_arm_path(body_vertices, side, root_center, *,
                            center_x=0.0, wrist_z=0.985,
                            sample_half_band_m=0.022):
    if side not in ("left_sleeve","right_sleeve"):
        raise ValueError("Source sleeve must specify correct side")
    if not _finite_vec(root_center) or not math.isfinite(center_x) or not math.isfinite(wrist_z):
        raise ValueError("Invalid scanned arm/root provenance")
    if type(sample_half_band_m) not in (int,float) or not .010<=sample_half_band_m<=.035:
        raise ValueError("Unsupported source cross-section sampling range")
    if (not isinstance(body_vertices,(tuple,list)) or
        len(body_vertices)<50 or not all(_finite_vec(v) for v in body_vertices)):
        raise ValueError("Actual 3D source-body vertices missing or corrupt")
    root_z=root_center[2]
    sign=-1 if side=="left_sleeve" else 1
    if (not .28<=root_z-wrist_z<=.52 or
        sign*(root_center[0]-center_x)<.13):
        raise ValueError("Unverified armhole or sampled wrist geometry")
    # Keep the body scan's torso away from arm sampling; no body movement.
    minimum_lateral=max(.207,sign*(root_center[0]-center_x)-.012)
    targets=[]
    receipts=[]
    for step in range(1,6):
        t=step/5
        z=root_z+(wrist_z-root_z)*t
        slab=[point for point in body_vertices
              if abs(point[2]-z)<=sample_half_band_m
              and minimum_lateral<sign*(point[0]-center_x)<.75
              and abs(point[1])<.40]
        if len(slab)<12:
            raise ValueError(f"Insufficient immutable scan arm section: {side} step {step}")
        # The laterally outer scanned 65% excludes the nearby torso/hip
        # surface when source shoulders project into the same z slice.
        slab.sort(key=lambda p:sign*(p[0]-center_x),reverse=True)
        chosen=slab[:max(12,math.ceil(len(slab)*.65))]
        med_x=median(p[0] for p in chosen)
        med_y=median(p[1] for p in chosen)
        lateral=sign*(med_x-center_x)
        if not .205<=lateral<=.65 or abs(med_y)>.28:
            raise ValueError("Implausible source arm centre; do not substitute invented pose")
        targets.append((float(med_x),float(med_y),float(z)))
        receipts.append({
            "sourceHeightM":round(z,6),
            "scannedSurfacePoints":len(slab),
            "lateralArmSubsetPoints":len(chosen),
            "estimatedSectionCenterM":[round(med_x,6),round(med_y,6),round(z,6)],
        })
    if len(targets)!=5:
        raise ValueError("Missing actual scanned arm sections")
    return {
        "side":side,
        "rootCenterM":list(root_center),
        "sourceSliceObservations":receipts,
        "centerline":targets,
        "sourceBasedArmPose":True,
        "originalPhotoIdentityProven":False,
        "fabricAndTailorFitApproved":False,
    }
