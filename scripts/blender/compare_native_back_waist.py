"""Fail-closed comparison of real native back-waist contact alternatives.

A genuine decrease in intersection pairs is only a provisional source-scene
geometry improvement. It does NOT approve fit, photographed identity, actual
tucked garment, measurement, fabric or production.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

BASELINE_BODY=1954
BASELINE_WAIST=72
EXPECTED_SLEEVES={"left_sleeve":479,"right_sleeve":471}


def _pairs(value,name):
    if type(value) is not int or value<0:
        raise ValueError(f"Missing genuine native contact count: {name}")
    return value


def evaluate_back_waist_report(report,side):
    if not isinstance(report,dict) or side not in ("inside","outside"):
        raise ValueError("Native contour report and trial identity required")
    if (report.get("sourceModelIdentity")!="linen-earth-studio-model-v1" or
        report.get("bodyAndBaselineGarmentsUnchanged") is not True or
        report.get("backWaistSourceContourTrial")!=side):
        raise ValueError("Source identity, body hashes or original waist choice violated")
    t=report.get("topology",{})
    if (not isinstance(t,dict) or t.get("connectedComponents")!=1 or
        t.get("nonmanifoldEdges")!=0 or t.get("windingErrors")!=0 or
        t.get("boundaryLoopsAfterSleeves")!=4 or
        t.get("bodySectionTangentRadiusCalibrated") is not True or
        t.get("backWaistSourceMeshReferenced") is not True):
        raise ValueError("Authentic native sewn sleeve/back topology missing")
    contacts=report.get("independentNativeBodyWaistContactPartitions",{})
    spatial=report.get("nativeSourceHeightBodyWaistContactPartitions",{})
    if not isinstance(contacts,dict) or not isinstance(spatial,dict):
        raise ValueError("Missing native independent collision partitions")
    for label,source in (("byPanel",contacts),("byHeight",spatial)):
        for side_of_contact in ("body","trouserWaist"):
            x=source.get(side_of_contact)
            if (not isinstance(x,dict) or
                x.get("regionMeasureAgreement") is not True):
                raise ValueError(f"Missing exact {label} {side_of_contact} consistency")
    body=_pairs(report.get("bodyClothIntersectingTrianglePairs"),"body")
    legs=report.get("clothTrouserIntersectingTrianglePairs")
    if not isinstance(legs,dict):
        raise ValueError("Native source waist/leg contact data missing")
    waist=_pairs(legs.get("TrouserWaistFabric"),"waist")
    if _pairs(legs.get("TrouserLegLFabric"),"left leg") or _pairs(legs.get("TrouserLegRFabric"),"right leg"):
        raise ValueError("New leg collisions cannot be accepted as waist improvement")
    region=contacts["body"].get("bodyContactPairsByGarmentRegion")
    waist_height=spatial["trouserWaist"].get("bodyContactPairsByGarmentRegion")
    if not isinstance(region,dict) or not isinstance(waist_height,dict):
        raise ValueError("Native source panel or height evidence missing")
    for name,count in EXPECTED_SLEEVES.items():
        if _pairs(region.get(name),name)!=count:
            raise ValueError("Previously verified source-posed sleeve geometry regressed")
    by_waist=_pairs(waist_height.get("back@waist"),"back waist")
    by_hem=_pairs(waist_height.get("back@hem"),"back hem")
    if by_waist+by_hem!=waist:
        raise ValueError("Waistband collides with non-back source regions")
    observations=report.get("backWaistSourceObservations")
    if (not isinstance(observations,list) or len(observations)!=25 or
        any(type(row.get("sourceWaistVertexSamples")) is not int or
            row["sourceWaistVertexSamples"]<4
            for row in observations if isinstance(row,dict)) or
        any(not isinstance(row,dict) for row in observations)):
        raise ValueError("Missing original source back-contour samples")
    improvement=waist<BASELINE_WAIST and body<=BASELINE_BODY
    return {
        "candidate":side,
        "wholeBodyPairs":body,
        "waistPairs":waist,
        "backWaistPairs":by_waist,
        "backHemPairs":by_hem,
        "sourceWaistSamples":len(observations),
        "sleeveBodyPairsUnchanged":True,
        "actualWaistReducedWithoutWorseningBody":improvement,
        "noWaistContact":waist==0,
        "fullGeometryContactGate":body==0 and waist==0,
        "canonicalPhotoIdentityApproved":False,
        "actualTailoringApproved":False,
        "productionReady":False,
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--inside",required=True)
    ap.add_argument("--outside",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    outcome={}
    for side,path in (("inside",args.inside),("outside",args.outside)):
        outcome[side]=evaluate_back_waist_report(
            json.loads(Path(path).read_text(encoding="utf-8")),side
        )
    output={
        "source":"independent_native_source_waist_3d_v1",
        "baselineWholeBodyPairs":BASELINE_BODY,
        "baselineWaistPairs":BASELINE_WAIST,
        "variants":outcome,
        "anyWaistImprovementWithoutWholeBodyRegression":any(
            val["actualWaistReducedWithoutWorseningBody"]
            for val in outcome.values()),
        "productionApproved":False,
    }
    file=Path(args.output)
    file.parent.mkdir(parents=True,exist_ok=True)
    file.write_text(json.dumps(output,indent=2)+"\n",encoding="utf-8")
    print("TITAN_3D_NATIVE_BACK_WAIST_COMPARISON="+json.dumps(output,sort_keys=True))


if __name__=="__main__":
    main()
