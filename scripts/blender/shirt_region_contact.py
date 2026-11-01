"""Validate real native-body BVH contact counts split by sewn garment regions.

An aggregate pair count is not a penetration distance and cannot identify
the offending shirt panel. Partitions must cover each real source mesh face
exactly once; missing counts and material-region omissions are reported
as unverified, not silently zeroed or approved.
"""
from __future__ import annotations


def summarize_native_region_contacts(regions, whole_pairs, face_counts):
    if not isinstance(regions, dict) or not isinstance(face_counts, dict) or not regions:
        raise ValueError("Real garment region receipts are mandatory")
    if type(whole_pairs) is not int or whole_pairs < 0:
        raise ValueError("Missing real full-garment body contact count")
    if set(regions) != set(face_counts):
        raise ValueError("The native body contact partitions omit a garment region")
    for name, count in regions.items():
        if (not isinstance(name,str) or not name or
            type(count) is not int or count < 0 or
            type(face_counts[name]) is not int or face_counts[name] <= 0):
            raise ValueError("Missing, invalid, or empty native garment region evidence")
    partitioned_sum=sum(regions.values())
    consistent=partitioned_sum==whole_pairs
    ordered=sorted(regions.items(),key=lambda item:(-item[1],item[0]))
    return {
        "bodyContactPairsByGarmentRegion":dict(sorted(regions.items())),
        "originalGarmentFaceCounts":dict(sorted(face_counts.items())),
        "sourceWholeBodyClothPairs":whole_pairs,
        "regionContactPairsSummed":partitioned_sum,
        "regionFaceCoverageCount":sum(face_counts.values()),
        "regionMeasureAgreement":consistent,
        "contactRegionsRanked":[{"region":name,"contactPairs":count}
                                for name,count in ordered],
        "canClaimCompleteBodyClearance":consistent and whole_pairs==0,
        "realSourceMeasured":True,
        "photographicIdentityApproved":False,
        "tailorApproved":False,
        "productionApproved":False,
    }
