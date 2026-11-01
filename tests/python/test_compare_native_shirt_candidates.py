"""Reject malformed, colliding or regressively unfit native garment receipts."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from compare_native_shirt_candidates import evaluate_native_variant


def sample(body=0,waist=0,left=0,right=0):
    return {
        "sourceModelIdentity":"linen-earth-studio-model-v1",
        "bodyAndBaselineGarmentsUnchanged":True,
        "bodyClothIntersectingTrianglePairs":body,
        "clothTrouserIntersectingTrianglePairs":{
            "TrouserWaistFabric":waist,
            "TrouserLegLFabric":left,
            "TrouserLegRFabric":right,
        },
        "topology":{
            "connectedComponents":1,"nonmanifoldEdges":0,
            "windingErrors":0,"boundaryLoopsAfterSleeves":4,
            "panelSeamsAuthored":True,
            "panelFaceCounts":{
                "front":196,"back":196,"yoke":192,
                "left_sleeve":170,"right_sleeve":170,
            }
        },
    }


class CandidateComparisonTest(unittest.TestCase):
    def test_zero_contact_and_sewn_topology_is_geometry_only(self):
        result=evaluate_native_variant(sample())
        self.assertTrue(result["nativeGeometryContactGatePass"])
        self.assertFalse(result["productionApproved"])
        self.assertFalse(result["photoParityApproved"])

    def test_body_improvement_does_not_waive_worse_leg_contact(self):
        result=evaluate_native_variant(sample(body=16,left=1))
        self.assertFalse(result["nativeGeometryContactGatePass"])
        self.assertFalse(result["provisionalImprovementWithoutContactRegression"])
        self.assertIn("leftLeg",result["contactRegressions"])

    def test_worse_waist_does_not_count_as_provisional(self):
        result=evaluate_native_variant(sample(body=200,waist=73))
        self.assertFalse(result["provisionalImprovementWithoutContactRegression"])
        self.assertIn("waist",result["contactRegressions"])

    def test_partial_reduction_never_claims_complete_geometry(self):
        result=evaluate_native_variant(sample(body=4,waist=10))
        self.assertTrue(result["provisionalImprovementWithoutContactRegression"])
        self.assertFalse(result["nativeGeometryContactGatePass"])

    def test_source_mutation_fails_closed(self):
        fixture=sample()
        fixture["bodyAndBaselineGarmentsUnchanged"]=False
        with self.assertRaises(ValueError):
            evaluate_native_variant(fixture)

    def test_missing_native_measures_do_not_become_zero(self):
        for value in (None,-1,True,"0",float("nan")):
            with self.subTest(value=value):
                fixture=sample()
                fixture["bodyClothIntersectingTrianglePairs"]=value
                with self.assertRaises(ValueError):
                    evaluate_native_variant(fixture)

    def test_missing_or_unsafe_topology_cannot_be_signed_off(self):
        fixture=sample()
        fixture["topology"]["connectedComponents"]=3
        self.assertFalse(evaluate_native_variant(fixture)["nativeGeometryContactGatePass"])
        fixture=sample()
        fixture["topology"]["panelFaceCounts"]["right_sleeve"]=0
        self.assertFalse(evaluate_native_variant(fixture)["nativeGeometryContactGatePass"])


if __name__=="__main__":
    unittest.main()
