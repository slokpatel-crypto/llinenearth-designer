"""Regression gates for native source contour candidate, no improvement fiction."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from compare_native_back_waist import evaluate_back_waist_report


def receipt(body=1954,waist=72,side="inside"):
    byregion={"left_sleeve":479,"right_sleeve":471,"back":515}
    return {
        "sourceModelIdentity":"linen-earth-studio-model-v1",
        "bodyAndBaselineGarmentsUnchanged":True,
        "backWaistSourceContourTrial":side,
        "topology":{
            "connectedComponents":1,"nonmanifoldEdges":0,
            "windingErrors":0,"boundaryLoopsAfterSleeves":4,
            "bodySectionTangentRadiusCalibrated":True,
            "backWaistSourceMeshReferenced":True
        },
        "bodyClothIntersectingTrianglePairs":body,
        "clothTrouserIntersectingTrianglePairs":{
            "TrouserWaistFabric":waist,"TrouserLegLFabric":0,"TrouserLegRFabric":0
        },
        "independentNativeBodyWaistContactPartitions":{
            "body":{"regionMeasureAgreement":True,
                    "bodyContactPairsByGarmentRegion":byregion},
            "trouserWaist":{"regionMeasureAgreement":True}
        },
        "nativeSourceHeightBodyWaistContactPartitions":{
            "body":{"regionMeasureAgreement":True},
            "trouserWaist":{"regionMeasureAgreement":True,
                           "bodyContactPairsByGarmentRegion":{
                               "back@waist":max(waist-8,0),
                               "back@hem":min(waist,8)
                           }}
        },
        "backWaistSourceObservations":[{"sourceWaistVertexSamples":8}]*25
    }


class CompareNativeBackWaistTests(unittest.TestCase):
    def test_reduced_waist_but_remaining_body_not_approved(self):
        value=evaluate_back_waist_report(receipt(1950,40),"inside")
        self.assertTrue(value["actualWaistReducedWithoutWorseningBody"])
        self.assertFalse(value["fullGeometryContactGate"])
        self.assertFalse(value["productionReady"])

    def test_body_regression_rejects_waist_decrease(self):
        value=evaluate_back_waist_report(receipt(1960,20),"inside")
        self.assertFalse(value["actualWaistReducedWithoutWorseningBody"])

    def test_unimproved_waist_rejected(self):
        value=evaluate_back_waist_report(receipt(),"inside")
        self.assertFalse(value["actualWaistReducedWithoutWorseningBody"])

    def test_source_identity_and_sleeve_regression_fail_closed(self):
        fixture=receipt()
        fixture["bodyAndBaselineGarmentsUnchanged"]=False
        with self.assertRaises(ValueError):
            evaluate_back_waist_report(fixture,"inside")
        fixture=receipt()
        fixture["independentNativeBodyWaistContactPartitions"]["body"]["bodyContactPairsByGarmentRegion"]["right_sleeve"]=472
        with self.assertRaises(ValueError):
            evaluate_back_waist_report(fixture,"inside")

    def test_negative_missing_or_unmeasured_sections_fail(self):
        for bad in (None,-1,True,"0"):
            fixture=receipt()
            fixture["clothTrouserIntersectingTrianglePairs"]["TrouserWaistFabric"]=bad
            with self.assertRaises(ValueError):
                evaluate_back_waist_report(fixture,"inside")
        fixture=receipt()
        fixture["backWaistSourceObservations"]=[]
        with self.assertRaises(ValueError):
            evaluate_back_waist_report(fixture,"inside")

    def test_no_false_claim_when_zero_waist_and_body_still_collide(self):
        result=evaluate_back_waist_report(receipt(1950,0,"outside"),"outside")
        self.assertTrue(result["noWaistContact"])
        self.assertFalse(result["fullGeometryContactGate"])
        self.assertFalse(result["productionReady"])


if __name__=="__main__":
    unittest.main()
