"""Fail-closed validator for real source cuff experiment, not fit certification."""
import json,math,sys
from pathlib import Path

TRIALS=(0.,10.,20.,30.,37.)

def verify(data):
    fixed={"version":"titan-native-cuff-guide-research-v1",
        "modelIdentityId":"linen-earth-studio-model-v1",
        "referenceImage":"/designer/studio-tucked.webp",
        "candidateOnly":True,"productionApproved":False,
        "physicalFitApproved":False,"tailorApproved":False,
        "fourAngleApproved":False,"originalSourcePreserved":True}
    if any(data.get(k)!=v for k,v in fixed.items()):
        raise ValueError("Falsified original identity or physical approval")
    base=data.get("originalContacts")
    if not isinstance(base,dict) or len(base)!=21:
        raise ValueError("Missing six body and 15 real garment pairs")
    if any(type(x)!=int or x<0 for x in base.values()):
        raise ValueError("Invalid real contact counts")
    spacing=data.get("originalSpacingMm")
    if type(spacing) not in (int,float) or not 540<=spacing<=620:
        raise ValueError("Invalid original cuff geometry")
    sample=data.get("trials")
    if not isinstance(sample,list) or len(sample)!=5:
        raise ValueError("Five real CC0 trial measurements required")
    for row,amount in zip(sample,TRIALS):
        if row.get("inwardShiftMmPerSleeve")!=amount:
            raise ValueError("Wrong actual cuff shift sequence")
        span=row.get("measuredCuffSpacingMm")
        if type(span) not in (int,float) or not math.isfinite(span):
            raise ValueError("Unmeasured physical sleeve centers")
        counts=row.get("contacts")
        if not isinstance(counts,dict) or set(counts)!=set(base):
            raise ValueError("Incomplete native BVH comparison")
        if any(type(v)!=int or v<0 for v in counts.values()):
            raise ValueError("Forged native intersections")
        regressions={key:v-base[key] for key,v in counts.items() if v>base[key]}
        if row.get("increasedContactPairs")!=regressions:
            raise ValueError("New true garment contact was hidden")
        passed=not regressions and abs(span-500)<abs(spacing-500)
        if row.get("researchGatePassed") is not passed:
            raise ValueError("Unverified cuff adjustment marked safe")
        if row.get("nonSleeveGeometryPreserved") is not True or row.get("productionApproved") is not False:
            raise ValueError("Research used to approve real tailoring")
        moved=row.get("cuffVerticesMoved")
        if not isinstance(moved,dict) or set(moved)!={"ShirtSleeveLFabric","ShirtSleeveRFabric"}:
            raise ValueError("Missing true per-sleeve geometry impact")
        if amount==0:
            if span!=spacing or counts!=base or any(moved.values()):
                raise ValueError("Unmodified original source trial changed")
        elif any(type(x)!=int or x<4 for x in moved.values()):
            raise ValueError("Missing real sleeve movement")
    return {"trials":len(sample),"nonRegressingResearchTrials":sum(bool(x["researchGatePassed"]) for x in sample),"productionApproved":False}

def fixtures():
    # Adversarial report: never allow missing or invented physical evidence.
    base={f"Body::{i}":0 for i in range(21)}
    trials=[{"inwardShiftMmPerSleeve":amount,
             "measuredCuffSpacingMm":575 if amount==0 else 575-2*amount,
             "contacts":dict(base),"increasedContactPairs":{},
             "cuffVerticesMoved":{"ShirtSleeveLFabric":0 if amount==0 else 12,
                                 "ShirtSleeveRFabric":0 if amount==0 else 12},
             "nonSleeveGeometryPreserved":True,"productionApproved":False,
             "researchGatePassed":amount>0} for amount in TRIALS]
    report={"version":"titan-native-cuff-guide-research-v1",
            "modelIdentityId":"linen-earth-studio-model-v1",
            "referenceImage":"/designer/studio-tucked.webp",
            "candidateOnly":True,"productionApproved":False,
            "physicalFitApproved":False,"tailorApproved":False,"fourAngleApproved":False,
            "originalSourcePreserved":True,"originalSpacingMm":575,"originalContacts":base,"trials":trials}
    assert verify(report)["trials"]==5
    from copy import deepcopy
    tampered=deepcopy(report)
    tampered["trials"][1]["contacts"]["Body::1"]=1
    try:verify(tampered)
    except ValueError:pass
    else:raise AssertionError("Increased real collisions were silently accepted")
    tampered=deepcopy(report)
    tampered["productionApproved"]=True
    try:verify(tampered)
    except ValueError:pass
    else:raise AssertionError("Fabricated physical fit accepted")

if __name__=="__main__":
    fixtures()
    if len(sys.argv)>1:
        doc=json.loads(Path(sys.argv[1]).read_text(encoding="utf8"))
        print("TITAN_CUFF_NATIVE_REPORT_VERIFIED",json.dumps(verify(doc)))
    else:
        print("TITAN_CUFF_REPORT_GUARD_FIXTURES_PASSED")
