"""Research only: move existing CC0 garment cuff geometry toward real photo guides.

This never replaces the locked source body, changes production authoring,
exports a GLB, invents measured fabric drape or approves tailoring.
All 21 body/garment and garment/garment contact pairs are remeasured.
"""
from __future__ import annotations
import argparse, hashlib, json, math, runpy, struct, sys
from pathlib import Path
import bpy
from mathutils import Vector

NAMES=("ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
       "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric")
SLEEVES=("ShirtSleeveLFabric","ShirtSleeveRFabric")
PHOTO="/designer/studio-tucked.webp"
ID="linen-earth-studio-model-v1"
SHIFTS=(0.,10.,20.,30.,37.)
PHOTO_GUIDES=("LE_GUIDE_LEFT_HAND_CENTER_H","LE_GUIDE_RIGHT_HAND_CENTER_H")
PREFLIGHT=runpy.run_path(str(Path(__file__).resolve().parent/"preflight-linen-earth-officewear.py"),
                       run_name="titan_read_only_cuff_preflight")
CONTACT=PREFLIGHT["intersection_pair_count"]

def bounded_shift_mm(amount):
    if not math.isfinite(amount) or not 0<=amount<=40:
        raise RuntimeError("Only bounded 0-40mm native cuff movement allowed")
    return amount

def weight(z,z_hand):
    if not (math.isfinite(z) and math.isfinite(z_hand)):
        raise RuntimeError("Nonfinite actual guide or cloth coordinate")
    t=max(0.,min(1.,(z-z_hand)/.145))
    return 1.-t*t*(3.-2.*t)

def digest_mesh(obj):
    d=hashlib.sha256()
    for vertex in obj.data.vertices:
        point=obj.matrix_world @ vertex.co
        if not all(math.isfinite(float(x)) for x in point):
            raise RuntimeError("Nonfinite real garment geometry")
        d.update(struct.pack("<ddd",*point))
    for polygon in obj.data.polygons:
        d.update(struct.pack("<I",len(polygon.vertices)))
        for vertex in polygon.vertices:
            d.update(struct.pack("<I",int(vertex)))
    return d.hexdigest()

def guide_heights():
    collection=bpy.data.collections.get("LinenEarthIdentityGuides")
    if collection is None:
        raise RuntimeError("Missing locked real-photo hand guides")
    result=[]
    for name in PHOTO_GUIDES:
        guide=collection.objects.get(name)
        if guide is None or guide.type!="CURVE":
            raise RuntimeError("Missing exact photographed hand guide "+name)
        pts=[guide.matrix_world @ Vector(p.co[:3])
             for spline in guide.data.splines for p in spline.points]
        if len(pts)<2:raise RuntimeError("Malformed scanned hand guide")
        result.append(sum(p.z for p in pts)/len(pts))
    return tuple(result)

def cuff_center_x(obj,z):
    xs=[(obj.matrix_world @ v.co).x for v in obj.data.vertices
        if abs((obj.matrix_world @ v.co).z-z)<=.060]
    if len(xs)<4:raise RuntimeError("Insufficient actual cuff vertices")
    return (min(xs)+max(xs))/2.

def spacing_mm(objects,heights):
    left=cuff_center_x(objects[SLEEVES[0]],heights[0])
    right=cuff_center_x(objects[SLEEVES[1]],heights[1])
    return abs(right-left)*1000.

def snapshot(objects):
    return {name:[v.co.copy() for v in objects[name].data.vertices] for name in SLEEVES}

def restore(objects,original):
    for name in SLEEVES:
        obj=objects[name]
        if len(obj.data.vertices)!=len(original[name]):
            raise RuntimeError("Cloth source topology changed")
        for v,source in zip(obj.data.vertices,original[name]):
            v.co=source
        obj.data.update()
    bpy.context.view_layer.update()

def move_cuffs(objects,heights,shift_mm):
    bounded_shift_mm(shift_mm)
    moved={}
    for name,z,side in zip(SLEEVES,heights,(1.,-1.)):
        obj=objects[name]
        if any(abs(v)>1e-7 for v in obj.rotation_euler) or any(abs(v-1.)>1e-7 for v in obj.scale):
            raise RuntimeError("Physical transforms must be applied before cuff trial")
        count=0
        for v in obj.data.vertices:
            w=weight(v.co.z,z)
            if w>0 and shift_mm:
                v.co.x+=side*shift_mm/1000.*w
                count+=1
        obj.data.update()
        moved[name]=count
    bpy.context.view_layer.update()
    return moved

def contact_counts(objects):
    # Precisely the evaluated world-space BVH helper and 0.5mm epsilon
    # used by the current production preflight: nothing is exempted.
    counts={}
    for name in NAMES:
        counts["Body::"+name]=CONTACT(objects["Body"],objects[name])
    for i,left in enumerate(NAMES):
        for right in NAMES[i+1:]:
            counts[left+"::"+right]=CONTACT(objects[left],objects[right])
    if len(counts)!=21 or any(type(v)!=int or v<0 for v in counts.values()):
        raise RuntimeError("Incomplete actual body/garment contact evidence")
    return counts

def investigate():
    scene=bpy.context.scene
    if (scene.get("linen_earth_model_identity_id")!=ID
        or scene.get("linen_earth_model_reference_image")!=PHOTO
        or not bool(scene.get("linen_earth_model_identity_locked"))):
        raise RuntimeError("Unapproved source mannequin rejected")
    objs={name:bpy.data.objects.get(name) for name in ("Body",)+NAMES}
    if any(obj is None or obj.type!="MESH" for obj in objs.values()):
        raise RuntimeError("All six real garment surfaces and body are required")
    src=Path(bpy.data.filepath).resolve()
    if not src.is_file() or src.suffix!=".blend":
        raise RuntimeError("Load the saved pinned original source .blend")
    sha=hashlib.sha256(src.read_bytes()).hexdigest()
    heights=guide_heights()
    originals={name:digest_mesh(obj) for name,obj in objs.items()}
    vertices=snapshot(objs)
    contacts=contact_counts(objs)
    spacing=spacing_mm(objs,heights)
    if not 540<=spacing<=620:
        raise RuntimeError("Unexpected original cuff spacing, fail closed")
    trials=[]
    for amount in SHIFTS:
        restore(objs,vertices)
        changed=move_cuffs(objs,heights,amount)
        current_contacts=contact_counts(objs)
        current_spacing=spacing_mm(objs,heights)
        regressions={key:value-contacts[key] for key,value in current_contacts.items()
                     if value>contacts[key]}
        if any(digest_mesh(objs[name])!=originals[name] for name in ("Body",)+tuple(n for n in NAMES if n not in SLEEVES)):
            raise RuntimeError("Trial modified body or other 4 original panels")
        trials.append({
            "inwardShiftMmPerSleeve":amount,
            "measuredCuffSpacingMm":round(current_spacing,3),
            "contacts":current_contacts,
            "increasedContactPairs":regressions,
            "cuffVerticesMoved":changed,
            "nonSleeveGeometryPreserved":True,
            "researchGatePassed":not regressions and abs(current_spacing-500)<abs(spacing-500),
            "productionApproved":False,
        })
    restore(objs,vertices)
    if any(digest_mesh(obj)!=originals[name] for name,obj in objs.items()):
        raise RuntimeError("Native source geometry did not restore")
    if hashlib.sha256(src.read_bytes()).hexdigest()!=sha:
        raise RuntimeError("Original source .blend was changed")
    return {
        "version":"titan-native-cuff-guide-research-v1",
        "modelIdentityId":ID,"referenceImage":PHOTO,
        "candidateOnly":True,"productionApproved":False,"physicalFitApproved":False,
        "tailorApproved":False,"fourAngleApproved":False,
        "originalSourcePreserved":True,
        "guideHeightsM":[round(z,6) for z in heights],
        "originalSourceSha256":sha,
        "originalSpacingMm":round(spacing,3),
        "originalContacts":contacts,
        "trials":trials,
    }

if __name__=="__main__":
    try:
        args=sys.argv
        args=args[args.index("--")+1:] if "--" in args else []
        parser=argparse.ArgumentParser()
        parser.add_argument("--report",type=Path,required=True)
        opts=parser.parse_args(args)
        result=investigate()
        dest=opts.report.resolve()
        if dest==Path(bpy.data.filepath).resolve() or dest.suffix!=".json":
            raise RuntimeError("Native cuff research writes JSON only, never the source .blend")
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf8")
        print("TITAN_NATIVE_CUFF_RESEARCH_EVIDENCE_ONLY",
              [(x["inwardShiftMmPerSleeve"],x["measuredCuffSpacingMm"],
                len(x["increasedContactPairs"]),x["researchGatePassed"]) for x in result["trials"]])
    except Exception as exc:
        print("TITAN_RESEARCH_CUFF_REJECTED",exc,file=sys.stderr)
        raise SystemExit(1)
