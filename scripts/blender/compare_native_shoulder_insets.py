"""Fail-closed native assessment of alternative genuine back-shoulder panels.

Contact-pair counts alone cannot prove cloth coverage or physical fit. Both
independent four-angle rendered source scenes MUST receive visual review.
The original faceless canonical photographic mannequin is still unverified.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

BASELINE={"body":1954,"waist":72,"left_sleeve":479,"right_sleeve":471,
          "leftLeg":0,"rightLeg":0}
EXPECTED_SOURCE="linen-earth-studio-model-v1"


def actual_int(value,name):
    if type(value) is not int or value<0:
        raise ValueError("Native untrusted or missing triangle count: "+name)
    return value


def assess_native_shoulder(report):
    if not isinstance(report,dict):
        raise ValueError("Source Blender candidate report absent")
    if report.get("sourceModelIdentity")!=EXPECTED_SOURCE or report.get("bodyAndBaselineGarmentsUnchanged") is not True:
        raise ValueError("Original source body, six garment meshes or identity changed")
    rows=report.get("backShoulderInsetExperimentalRows")
    if type(rows) is not int or rows not in (2,3):
        raise ValueError("Source back inset pattern must use tested two or three rows")
    topo=report.get("topology",{})
    if (not isinstance(topo,dict) or topo.get("connectedComponents")!=1 or
        topo.get("nonmanifoldEdges")!=0 or topo.get("windingErrors")!=0 or
        topo.get("boundaryLoopsAfterSleeves")!=4 or
        topo.get("bodySectionTangentRadiusCalibrated") is not True or
        topo.get("actualBackShoulderInsetRows")!=rows or
        topo.get("backShoulderInsetFaceCount")!=rows*12 or
        topo.get("backShoulderInsetMeasuredTailoringApproved") is not False):
        raise ValueError("Authentic sewn source shoulder/armhole manifold not validated")
    groups=report.get("independentNativeBodyWaistContactPartitions")
    height=report.get("nativeSourceHeightBodyWaistContactPartitions")
    for source,label in ((groups,"region"),(height,"height")):
        if not isinstance(source,dict):
            raise ValueError("Missing native "+label+" source contacts")
        for key in ("body","trouserWaist"):
            data=source.get(key)
            if not isinstance(data,dict) or data.get("regionMeasureAgreement") is not True:
                raise ValueError("Native BVH source "+label+" partition invalid")
    contacts=groups["body"].get("bodyContactPairsByGarmentRegion")
    if not isinstance(contacts,dict):
        raise ValueError("No actual regions to compare")
    if actual_int(contacts.get("back_shoulder_inset"),"back inset")<0:
        raise ValueError("Native source inset not measured")
    for sleeve in ("left_sleeve","right_sleeve"):
        actual_int(contacts.get(sleeve),sleeve)
    other=report.get("clothTrouserIntersectingTrianglePairs")
    if not isinstance(other,dict):
        raise ValueError("Original waist and leg contacts missing")
    observed={
        "body":actual_int(report.get("bodyClothIntersectingTrianglePairs"),"whole body"),
        "waist":actual_int(other.get("TrouserWaistFabric"),"waist"),
        "left_sleeve":contacts["left_sleeve"],
        "right_sleeve":contacts["right_sleeve"],
        "leftLeg":actual_int(other.get("TrouserLegLFabric"),"left leg"),
        "rightLeg":actual_int(other.get("TrouserLegRFabric"),"right leg"),
    }
    # New sewn back areas are an actual geometry change; evaluate the whole
    # contact landscape, never assume reduced back holes because of a count.
    regressions={key:{"baseline":old,"observed":observed[key]}
                 for key,old in BASELINE.items() if observed[key]>old}
    reductions={key:{"baseline":old,"observed":observed[key]}
                for key,old in BASELINE.items() if observed[key]<old}
    return {
        "backShoulderInsetRows":rows,
        "nativeBodyPairsBySourceRole":dict(contacts),
        "contactCounts":observed,
        "contactRegressions":regressions,
        "contactReductions":reductions,
        "topologyPass":True,
        "provisionalEngineeringImprovementWithoutRegression":bool(
            reductions and not regressions
        ),
        "zeroBodyAndWaistContact":observed["body"]==0 and observed["waist"]==0,
        "fourAngleBodyCoverageReviewed":False,
        "sourceFacelessPhotoIdentityApproved":False,
        "measuredTailoringAndFabricApproved":False,
        "productionReady":False,
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--candidate",action="append",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    if len(args.candidate)!=2:
        raise ValueError("Both actual source-based shoulder inset experiments required")
    summaries={}
    for filename in args.candidate:
        receipt=json.loads(Path(filename).read_text(encoding="utf-8"))
        val=assess_native_shoulder(receipt)
        rows=val["backShoulderInsetRows"]
        if rows in summaries:
            raise ValueError("Duplicate source shoulder candidate")
        summaries[rows]=val
    if set(summaries)!={2,3}:
        raise ValueError("Two distinct authored back-shoulder inset variants missing")
    report={"nativeSource":"actual_manifold_back_shoulder_insets_v1",
            "baselineBodyPairs":1954,"baselineWaistPairs":72,
            "variants":summaries,"productionApproved":False}
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("TITAN_3D_NATIVE_SHOULDER_COMPARISON="+json.dumps(report,sort_keys=True))


if __name__=="__main__":
    main()
