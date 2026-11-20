"""Fail-closed offline verification of original-geometry UV experiment records."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

REQUIRED = (
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
)

def verify(data):
    if data.get("version")!="titan-surface-grain-research-v1":
        raise ValueError("Wrong native UV evidence version")
    required = {"candidateOnly":True,"productionApproved":False,
                "modelIdentityId":"linen-earth-studio-model-v1",
                "referenceImage":"/designer/studio-tucked.webp",
                "sourceSha256Preserved":True,"bodyGeometryPreserved":True,
                "physicalFabricRepeatVerified":False,"tailorApproved":False,
                "fourAnglePhotographicParityApproved":False}
    if any(data.get(key)!=val for key,val in required.items()):
        raise ValueError("Missing original identity, source protection or candidate-only veto")
    panels = data.get("panels")
    if not isinstance(panels,dict) or set(panels)!=set(REQUIRED):
        raise ValueError("Not all six real scanned source garments measured")
    improved=0
    for name,panel in panels.items():
        if panel.get("geometryPreserved") is not True or panel.get("originalUvPreserved") is not True:
            raise ValueError(name+" geometry or original UV was rewritten")
        if panel.get("physicalGrainApproved") is not False or panel.get("seamContinuityApproved") is not False:
            raise ValueError(name+" unreviewed grain/UV seams promoted")
        original,candidate,trial=(panel.get("original"),panel.get("candidate"),
                                  panel.get("surfaceArcTrial"))
        if any(not isinstance(x,dict) for x in (original,candidate,trial)):
            raise ValueError(name+" baseline, trial or selected UV evidence missing")
        selected=panel.get("selectedMapping")
        if selected not in ("surface_arc","original_uv_density_guard"):
            raise ValueError(name+" unrecognized UV research selection")
        if selected=="original_uv_density_guard":
            if candidate!=original or (
                trial.get("collapsedUvTriangles") != original.get("collapsedUvTriangles")
            ):
                raise ValueError(name+" original UV preservation guard lied")
        elif candidate!=trial:
            raise ValueError(name+" selected arc UV does not match its native trial")
        ot,ct=original.get("triangles"),candidate.get("triangles")
        o,c=original.get("collapsedUvTriangles"),candidate.get("collapsedUvTriangles")
        if type(ot)!=int or ot<=0 or type(ct)!=int or ct!=ot:
            raise ValueError(name+" real triangle count changed")
        if type(o)!=int or type(c)!=int or c<0 or o<0 or c>o or c>ot:
            raise ValueError(name+" UV count is invalid or worsened")
        for metric in (original,candidate,trial):
            ratio=metric.get("uvAreaDensityP90P10")
            if ratio is not None and (type(ratio) not in (int,float) or
                                      not math.isfinite(ratio) or ratio<1):
                raise ValueError(name+" invalid measured triangle-area density")
        old_ratio=original.get("uvAreaDensityP90P10")
        new_ratio=candidate.get("uvAreaDensityP90P10")
        if (o == c and old_ratio is not None and new_ratio is not None
                and new_ratio > old_ratio + 1e-5):
            raise ValueError(name+" candidate worsened real UV area-density dispersion")
        if selected=="original_uv_density_guard":
            trial_ratio=trial.get("uvAreaDensityP90P10")
            if old_ratio is None or trial_ratio is None or trial_ratio <= old_ratio+1e-6:
                raise ValueError(name+" false claim of density-based regression")
        for key in ("faceLocalFallbackIslands","radialSeamWrapFaces"):
            if type(panel.get(key))!=int or not 0<=panel[key]<=ot:
                raise ValueError(name+" invalid native UV structural count")
        axis=panel.get("inferredAxisWorld")
        if not isinstance(axis,list) or len(axis)!=3 or any(type(x) not in (int,float) for x in axis):
            raise ValueError(name+" missing native longitudinal axis")
        improved+=int(c<o)
    return {"panelCount":len(panels),"panelsWithFewerCollapsedUvs":improved,
            "productionApproved":False}

def test_fixtures():
    panel={"original":{"triangles":100,"collapsedUvTriangles":12,"uvAreaDensityP90P10":2.1},
           "surfaceArcTrial":{"triangles":100,"collapsedUvTriangles":0,"uvAreaDensityP90P10":2.5},
           "candidate":{"triangles":100,"collapsedUvTriangles":0,"uvAreaDensityP90P10":2.5},
           "selectedMapping":"surface_arc",
           "faceLocalFallbackIslands":5,"radialSeamWrapFaces":3,
           "inferredAxisWorld":[0,0,1],"geometryPreserved":True,
           "originalUvPreserved":True,"physicalGrainApproved":False,
           "seamContinuityApproved":False}
    example={"version":"titan-surface-grain-research-v1","candidateOnly":True,
             "productionApproved":False,"modelIdentityId":"linen-earth-studio-model-v1",
             "referenceImage":"/designer/studio-tucked.webp",
             "sourceSha256Preserved":True,"bodyGeometryPreserved":True,
             "physicalFabricRepeatVerified":False,"tailorApproved":False,
             "fourAnglePhotographicParityApproved":False,
             "panels":{name:dict(panel) for name in REQUIRED}}
    assert verify(example)["panelsWithFewerCollapsedUvs"]==6
    for field,bad in (("productionApproved",True),("sourceSha256Preserved",False),
                      ("physicalFabricRepeatVerified",True),("modelIdentityId","fake")):
        x=dict(example);x[field]=bad
        try: verify(x)
        except ValueError: pass
        else: raise AssertionError("Untrusted geometry/physical approval passed: "+field)
    x=json.loads(json.dumps(example))
    x["panels"]["ShirtTorsoFabric"]["candidate"]["collapsedUvTriangles"]=13
    try: verify(x)
    except ValueError: pass
    else: raise AssertionError("Worsening native UV must fail closed")
    # Counterexample from the real CC0 right trouser leg: if both UVs have
    # zero collapses, a trial with higher p90/p10 distortion MUST preserve
    # the original UV rather than ship the worse projection.
    guarded=json.loads(json.dumps(example))
    for name in REQUIRED:
        p=guarded["panels"][name]
        p["original"]={"triangles":100,"collapsedUvTriangles":0,"uvAreaDensityP90P10":9.4}
        p["surfaceArcTrial"]={"triangles":100,"collapsedUvTriangles":0,"uvAreaDensityP90P10":13.8}
        p["candidate"]=dict(p["original"])
        p["selectedMapping"]="original_uv_density_guard"
    assert verify(guarded)["productionApproved"] is False
    bad=json.loads(json.dumps(guarded))
    bad["panels"]["TrouserLegRFabric"]["candidate"]["uvAreaDensityP90P10"]=13.8
    try: verify(bad)
    except ValueError: pass
    else: raise AssertionError("Worse signed-off UV density must fail closed")

if __name__=="__main__":
    test_fixtures()
    if len(sys.argv)>1:
        data=json.loads(Path(sys.argv[1]).read_text(encoding="utf8"))
        print("TITAN_NATIVE_UV_RESEARCH_VERIFIED",json.dumps(verify(data),sort_keys=True))
    else:
        print("TITAN_NATIVE_UV_REPORT_CONTRACT_FIXTURES_PASSED")
