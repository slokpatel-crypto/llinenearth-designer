"""Separate source sewn shoulder hypotheses need actual full native contacts."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from compare_native_shoulder_insets import assess_native_shoulder


def fixture(rows=2,body=1950,waist=72,left=479,right=471):
    return {
        "sourceModelIdentity":"linen-earth-studio-model-v1",
        "bodyAndBaselineGarmentsUnchanged":True,
        "backShoulderInsetExperimentalRows":rows,
        "topology":{"connectedComponents":1,"windingErrors":0,
            "nonmanifoldEdges":0,"boundaryLoopsAfterSleeves":4,
            "bodySectionTangentRadiusCalibrated":True,
            "actualBackShoulderInsetRows":rows,
            "backShoulderInsetFaceCount":12*rows,
            "backShoulderInsetMeasuredTailoringApproved":False},
        "bodyClothIntersectingTrianglePairs":body,
        "clothTrouserIntersectingTrianglePairs":{
            "TrouserWaistFabric":waist,
            "TrouserLegLFabric":0,"TrouserLegRFabric":0},
        "independentNativeBodyWaistContactPartitions":{
            "body":{"regionMeasureAgreement":True,
                    "bodyContactPairsByGarmentRegion":{
                        "back_shoulder_inset":24,"left_sleeve":left,"right_sleeve":right}},
            "trouserWaist":{"regionMeasureAgreement":True}
        },
        "nativeSourceHeightBodyWaistContactPartitions":{
            "body":{"regionMeasureAgreement":True},
            "trouserWaist":{"regionMeasureAgreement":True}
        }
    }


class NativeShoulderComparison(unittest.TestCase):
    def test_real_reduction_only_provisional(self):
        r=assess_native_shoulder(fixture())
        self.assertTrue(r["provisionalEngineeringImprovementWithoutRegression"])
        self.assertFalse(r["productionReady"])
        self.assertFalse(r["sourceFacelessPhotoIdentityApproved"])
        self.assertFalse(r["fourAngleBodyCoverageReviewed"])

    def test_bad_sleeve_contact_blocks_provisional_success(self):
        r=assess_native_shoulder(fixture(body=1900,left=500))
        self.assertFalse(r["provisionalEngineeringImprovementWithoutRegression"])
        self.assertIn("left_sleeve",r["contactRegressions"])

    def test_bad_waist_blocks_provisional(self):
        r=assess_native_shoulder(fixture(body=1900,waist=73))
        self.assertFalse(r["provisionalEngineeringImprovementWithoutRegression"])

    def test_source_hash_and_panel_topology_fail_closed(self):
        broken=fixture()
        broken["bodyAndBaselineGarmentsUnchanged"]=False
        with self.assertRaises(ValueError):
            assess_native_shoulder(broken)
        broken=fixture()
        broken["topology"]["backShoulderInsetFaceCount"]=0
        with self.assertRaises(ValueError):
            assess_native_shoulder(broken)

    def test_missing_real_bvh_not_imputed(self):
        for value in (None,-1,True,0.0,"0"):
            x=fixture()
            x["bodyClothIntersectingTrianglePairs"]=value
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    assess_native_shoulder(x)

    def test_wrong_rows_or_missing_sewn_inset_fails(self):
        for n in (0,1,4):
            with self.assertRaises(ValueError):
                assess_native_shoulder(fixture(rows=n))
        broken=fixture()
        broken["independentNativeBodyWaistContactPartitions"]["body"]["bodyContactPairsByGarmentRegion"].pop("back_shoulder_inset")
        with self.assertRaises(ValueError):
            assess_native_shoulder(broken)


if __name__=="__main__":
    unittest.main()
