"""Fail-closed native Blender comparison for experimental authored shirt geometry.

Never turn a reduction in one contact category into "fit approved" when
another worsens. Exact real source receipts are required; no fabricated zeros.
This scores engineering evidence only, NOT original-model likeness, measured
sewn pattern, UV/grain truth, drape, human review or production readiness.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path

BASELINE={"body":2177,"waist":72,"leftLeg":0,"rightLeg":0}
REQUIRED_REGIONS=("front","back","yoke","left_sleeve","right_sleeve")


def _count(value, label):
    if type(value) is not int or value<0:
        raise ValueError(f"Missing or invalid native BVH count for {label}")
    return value


def evaluate_native_variant(data):
    if not isinstance(data,dict):
        raise ValueError("Native candidate report missing")
    if data.get("bodyAndBaselineGarmentsUnchanged") is not True:
        raise ValueError("Source body or baseline garments were altered")
    if data.get("sourceModelIdentity")!="linen-earth-studio-model-v1":
        raise ValueError("Model identity mismatch")
    topo=data.get("topology")
    if not isinstance(topo,dict):
        raise ValueError("Native topology evidence missing")
    regions=topo.get("panelFaceCounts")
    if not isinstance(regions,dict):
        raise ValueError("Native material/garment region evidence missing")
    topo_ok=(
        topo.get("connectedComponents")==1
        and topo.get("nonmanifoldEdges")==0
        and topo.get("windingErrors")==0
        and topo.get("boundaryLoopsAfterSleeves")==4
        and all(type(regions.get(name)) is int and regions[name]>0
                for name in REQUIRED_REGIONS)
        and topo.get("panelSeamsAuthored") is True
    )
    garment=data.get("clothTrouserIntersectingTrianglePairs")
    if not isinstance(garment,dict):
        raise ValueError("Native panel contact receipt missing")
    observed={
        "body":_count(data.get("bodyClothIntersectingTrianglePairs"),"body"),
        "waist":_count(garment.get("TrouserWaistFabric"),"waist"),
        "leftLeg":_count(garment.get("TrouserLegLFabric"),"left leg"),
        "rightLeg":_count(garment.get("TrouserLegRFabric"),"right leg"),
    }
    # These are hard engineering zero-contact requirements for this *new*
    # unsewn experimental shirt: no guessed seam allowances/waivers.
    worsened={key:{"baseline":limit,"observed":observed[key]}
              for key,limit in BASELINE.items() if observed[key]>limit}
    improved={key:{"baseline":limit,"observed":observed[key]}
              for key,limit in BASELINE.items() if observed[key]<limit}
    clear=all(v==0 for v in observed.values())
    geometry_gate=bool(topo_ok and clear)
    return {
        "nativeContacts":observed,
        "baselineContacts":dict(BASELINE),
        "contactImprovements":improved,
        "contactRegressions":worsened,
        "topologyPreserved":bool(topo_ok),
        "bodyAndGarmentsUnchanged":True,
        "nativeGeometryContactGatePass":geometry_gate,
        "provisionalImprovementWithoutContactRegression":bool(
            topo_ok and improved and not worsened
        ),
        "photoParityApproved":False,
        "supplierDimensionsAndUvVerified":False,
        "tailorApproved":False,
        "productionApproved":False,
        "status":"NOT_PRODUCTION_READY",
    }


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--candidate",action="append",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    if len(args.candidate)<1:
        raise ValueError("No native candidate file")
    details={}
    for name in args.candidate:
        data=json.loads(Path(name).read_text(encoding="utf-8"))
        details[Path(name).stem]=evaluate_native_variant(data)
    result={
        "comparison":"native-authored-shirt-ease-v1",
        "candidates":details,
        "anyProvisionalEngineeringGeometryPass":any(
            entry["nativeGeometryContactGatePass"] for entry in details.values()
        ),
        "sourceModelPhotoUnchanged":True,
        "productionApproved":False,
    }
    path=Path(args.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("TITAN_3D_NATIVE_CANDIDATE_COMPARISON="+json.dumps(result,sort_keys=True))


if __name__=="__main__":
    main()
