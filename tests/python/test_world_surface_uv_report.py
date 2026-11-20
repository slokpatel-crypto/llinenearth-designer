"""Fail-closed offline verification of original-geometry UV experiment records."""
from __future__ import annotations

import json
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
        original,candidate=panel.get("original"),panel.get("candidate")
        if not isinstance(original,dict) or not isinstance(candidate,dict):
            raise ValueError(name+" baseline or new UV evidence missing")
        ot,ct=original.get("triangles"),candidate.get("triangles")
        o,c=original.get("collapsedUvTriangles"),candidate.get("collapsedUvTriangles")
        if type(ot)!=int or ot<=0 or type(ct)!=int or ct!=ot:
            raise ValueError(name+" real triangle count changed")
        if type(o)!=int or type(c)!=int or c<0 or o<0 or c>o or c>ot:
            raise ValueError(name+" UV count is invalid or worsened")
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
    panel={"original":{"triangles":100,"collapsedUvTriangles":12},
           "candidate":{"triangles":100,"collapsedUvTriangles":0},
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

if __name__=="__main__":
    test_fixtures()
    if len(sys.argv)>1:
        data=json.loads(Path(sys.argv[1]).read_text(encoding="utf8"))
        print("TITAN_NATIVE_UV_RESEARCH_VERIFIED",json.dumps(verify(data),sort_keys=True))
    else:
        print("TITAN_NATIVE_UV_REPORT_CONTRACT_FIXTURES_PASSED")
