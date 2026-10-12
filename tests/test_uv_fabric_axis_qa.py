"""Warp/weft UV differential diagnostics (no Blender, no fake textile repeat)."""
import math
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"blender"))
from uv_fabric_axis_qa import (uv_fabric_axes_mm,summarise_uv_fabric_axes,axis_drift_against_authored,
    summarise_vertical_uv_zones,vertical_uv_zone_drift,paired_spatial_uv_drift)


class WarpWeftUvTests(unittest.TestCase):
    def setUp(self):
        self.xy=((0.,0.,0.),(1.,0.,0.),(0.,1.,0.))
        self.uv=((0.,0.),(1.,0.),(0.,1.))

    def test_equal_axes_are_measured_from_real_3d_geometry(self):
        actual=uv_fabric_axes_mm(self.xy,self.uv)
        self.assertAlmostEqual(actual["uMm"],1000)
        self.assertAlmostEqual(actual["vMm"],1000)
        self.assertAlmostEqual(actual["shearCosine"],0)

    def test_area_only_density_would_miss_a_stretched_stripe_axis(self):
        # 2x U repeat and 0.5x V repeat preserve UV triangle area.
        # Both axes are WRONG for real-world stripe/check registration.
        uv=((0,0),(2,0),(0,.5))
        actual=uv_fabric_axes_mm(self.xy,uv)
        self.assertAlmostEqual(actual["uMm"],500)
        self.assertAlmostEqual(actual["vMm"],2000)
        self.assertAlmostEqual(actual["uMm"]*actual["vMm"],1_000_000)
        baseline=summarise_uv_fabric_axes([uv_fabric_axes_mm(self.xy,self.uv)]*5)
        candidate=summarise_uv_fabric_axes([actual]*5)
        result=axis_drift_against_authored(baseline,candidate)
        self.assertEqual(result["uAxisMedianDriftPct"],50)
        self.assertEqual(result["vAxisMedianDriftPct"],100)
        self.assertTrue(result["needsDetailedFabricRepeatInvestigation"])
        self.assertFalse(result["verifiedPhysicalRepeatWithinTolerance"])

    def test_uv_shear_is_exposed_even_if_world_area_is_unchanged(self):
        result=uv_fabric_axes_mm(self.xy,((0,0),(1,0),(.5,1)))
        self.assertNotAlmostEqual(result["shearCosine"],0)
        self.assertTrue(abs(result["shearCosine"])<1)

    def test_degenerate_source_or_uv_fails_closed(self):
        self.assertIsNone(uv_fabric_axes_mm(((0,0,0),(1,1,1),(2,2,2)),self.uv))
        collapsed=uv_fabric_axes_mm(self.xy,((0,0),(1,0),(2,0)))
        self.assertTrue(math.isinf(collapsed["uMm"]))
        summary=summarise_uv_fabric_axes([collapsed,None,uv_fabric_axes_mm(self.xy,self.uv)])
        self.assertEqual(summary["collapsedUvTriangles"],1)
        self.assertEqual(summary["degenerateWorldTriangles"],1)
        self.assertFalse(summary["verifiedPhysicalTextileRepeat"])

    def test_valid_pair_inside_diagnostic_limit_still_not_physically_verified(self):
        src=summarise_uv_fabric_axes([uv_fabric_axes_mm(self.xy,self.uv)]*10)
        dst=summarise_uv_fabric_axes([uv_fabric_axes_mm(
            self.xy,((0,0),(1.04,0),(0,1.04))
        )]*10)
        result=axis_drift_against_authored(src,dst)
        self.assertFalse(result["needsDetailedFabricRepeatInvestigation"])
        self.assertFalse(result["verifiedPhysicalRepeatWithinTolerance"])

    def test_uv_area_weighted_axes_catch_changed_tessellation_density(self):
        # Same physical region with many micro triangles must not overwhelm
        # the exact wider textile axis while downsampling to the mobile LOD.
        authored=[
            {"uMm":800,"vMm":1000,"shearCosine":0,"worldAreaMm2":10}
            for _ in range(99)
        ]+[{"uMm":1000,"vMm":1000,"shearCosine":0,"worldAreaMm2":10000}]
        mobile=[
            {"uMm":800,"vMm":1000,"shearCosine":0,"worldAreaMm2":990},
            {"uMm":1000,"vMm":1000,"shearCosine":0,"worldAreaMm2":10000},
        ]
        source=summarise_uv_fabric_axes(authored)
        candidate=summarise_uv_fabric_axes(mobile)
        self.assertEqual(source["medianUmmPerUvUnit"],800)
        self.assertEqual(candidate["medianUmmPerUvUnit"],800)
        self.assertEqual(source["areaWeightedMedianUmmPerUvUnit"],1000)
        self.assertEqual(candidate["areaWeightedMedianUmmPerUvUnit"],1000)
        drift=axis_drift_against_authored(source,candidate)
        self.assertEqual(drift["uAxisAreaWeightedDriftPct"],0)
        self.assertFalse(drift["verifiedPhysicalRepeatWithinTolerance"])

    def test_area_weighted_source_uv_distortion_still_blocks_diagnostic_pass(self):
        source=summarise_uv_fabric_axes([uv_fabric_axes_mm(self.xy,self.uv)])
        candidate=summarise_uv_fabric_axes([uv_fabric_axes_mm(
            self.xy,((0,0),(1.3,0),(0,1))
        )])
        drift=axis_drift_against_authored(source,candidate)
        self.assertGreater(drift["uAxisAreaWeightedDriftPct"],8)
        self.assertTrue(drift["needsDetailedFabricRepeatInvestigation"])

    def test_invalid_parameters_never_make_a_green_texture_proof(self):
        for uv in (((0,0),(1,0)),((0,0),(math.nan,0),(0,1))):
            with self.assertRaises(ValueError):
                uv_fabric_axes_mm(self.xy,uv)
        source=summarise_uv_fabric_axes([])
        candidate=summarise_uv_fabric_axes([])
        self.assertTrue(axis_drift_against_authored(source,candidate)["needsDetailedFabricRepeatInvestigation"])
        with self.assertRaises(ValueError):
            axis_drift_against_authored(source,candidate,float("nan"))

    def test_native_blender_probe_preserves_both_uv_axis_and_owner_gates(self):
        code=(ROOT/"scripts/blender/probe-mobile-lod.py").read_text()
        self.assertIn("uv_fabric_axes_mm(xyz,uvs)",code)
        self.assertIn('result["uvAxisGeometry"]=summarise_uv_fabric_axes(axis_samples)',code)
        self.assertIn('"warpWeftGeometryQA":axis_drift_against_authored(',code)
        self.assertIn('"verifiedPhysicalFabricRepeat":False',code)
        self.assertIn('"eligibleForProduction":False',code)


    def test_mid_sleeve_region_detects_drift_hidden_by_global_median(self):
        # A tiny out-of-scale panel may be concealed when pooled with two
        # healthy sections; local evidence must never promote that fabric.
        baseline=[
            {"uMm":100,"vMm":100,"shearCosine":0,
             "worldAreaMm2":1000,"centroidZ":z}
            for z in (1,4,7)
        ]
        changed=[dict(x) for x in baseline]
        changed[1]["vMm"]=150
        src=summarise_vertical_uv_zones(baseline,0,9)
        dst=summarise_vertical_uv_zones(changed,0,9)
        self.assertEqual(src["zones"]["lower"]["validTriangles"],1)
        self.assertEqual(src["zones"]["middle"]["validTriangles"],1)
        self.assertEqual(src["zones"]["upper"]["validTriangles"],1)
        self.assertEqual(dst["zones"]["middle"]["areaWeightedMedianVmmPerUvUnit"],150)
        local=vertical_uv_zone_drift(src,dst,tolerance_pct=8)
        self.assertFalse(local["zones"]["lower"]["needsDetailedFabricRepeatInvestigation"])
        self.assertTrue(local["zones"]["middle"]["needsDetailedFabricRepeatInvestigation"])
        self.assertEqual(local["zones"]["middle"]["vAxisAreaWeightedDriftPct"],50)
        self.assertTrue(local["anyZoneNeedsInvestigation"])
        self.assertFalse(local["supplierRepeatVerified"])
        self.assertFalse(src["supplierRepeatVerified"])

    def test_empty_or_nonfinite_uv_regions_cannot_be_called_verified(self):
        with self.assertRaises(ValueError):
            summarise_vertical_uv_zones([],1,1)
        with self.assertRaises(ValueError):
            summarise_vertical_uv_zones([{"centroidZ":float("nan")}],0,9)
        with self.assertRaises(ValueError):
            summarise_vertical_uv_zones([{"centroidZ":20}],0,9)
        empty=summarise_vertical_uv_zones([],0,9)
        self.assertTrue(vertical_uv_zone_drift(empty,empty)["anyZoneNeedsInvestigation"])
        self.assertFalse(empty["supplierRepeatVerified"])



    def test_paired_world_space_uv_metrics_separate_sampling_from_real_warp(self):
        a=[
            {"centroidXYZ":(i*.04,0,.5),"uMm":450,"vMm":460,
             "worldAreaMm2":100}
            for i in range(10)
        ]
        # Candidates are located close to the SAME physical points but
        # reverse observation order (remeshing changes rendered triangle IDs).
        same=[{**row,"centroidXYZ":(row["centroidXYZ"][0]+.001,0,.5)}
              for row in reversed(a)]
        clean=paired_spatial_uv_drift(a,same,max_distance_mm=20)
        self.assertEqual(clean["matchedSourceCount"],10)
        self.assertEqual(clean["medianUErrorPct"],0)
        self.assertEqual(clean["medianVErrorPct"],0)
        self.assertFalse(clean["needsDetailedFabricRepeatInvestigation"])
        self.assertFalse(clean["verifiedPhysicalRepeatWithinTolerance"])
        # The same geometry with altered warp on a corresponding patch is RED.
        distorted=[dict(row) for row in same]
        for row in distorted:
            row["vMm"]*=1.25
        bad=paired_spatial_uv_drift(a,distorted,max_distance_mm=20)
        self.assertEqual(bad["medianVErrorPct"],25)
        self.assertTrue(bad["needsDetailedFabricRepeatInvestigation"])

    def test_paired_uv_unmatched_source_is_not_false_positive_proof(self):
        src=[{"centroidXYZ":(0,0,0),"uMm":400,"vMm":440,"worldAreaMm2":1}]
        shifted=[{**src[0],"centroidXYZ":(.2,0,0)}]
        missing=paired_spatial_uv_drift(src,shifted,max_distance_mm=25)
        self.assertEqual(missing["matchedSourceCount"],0)
        self.assertEqual(missing["matchedSourcePct"],0)
        self.assertTrue(missing["needsDetailedFabricRepeatInvestigation"])
        self.assertIsNone(missing["medianUErrorPct"])
        with self.assertRaises(ValueError):
            paired_spatial_uv_drift(src,shifted,max_distance_mm=0)
        with self.assertRaises(ValueError):
            paired_spatial_uv_drift([{**src[0],"uMm":float("nan")}],shifted)



    def test_signed_warp_weft_drift_reports_direction_but_absolute_gate_stays(self):
        source=summarise_uv_fabric_axes([uv_fabric_axes_mm(self.xy,self.uv)])
        candidate=summarise_uv_fabric_axes([uv_fabric_axes_mm(
            self.xy,((0,0),(1.25,0),(0,.8))
        )])
        drift=axis_drift_against_authored(source,candidate)
        self.assertEqual(drift["uAxisMedianDriftPct"],20)
        self.assertEqual(drift["uAxisSignedMedianDriftPct"],-20)
        self.assertEqual(drift["vAxisMedianDriftPct"],25)
        self.assertEqual(drift["vAxisSignedMedianDriftPct"],25)
        self.assertEqual(drift["uAxisSignedAreaWeightedDriftPct"],-20)
        self.assertEqual(drift["vAxisSignedAreaWeightedDriftPct"],25)
        self.assertTrue(drift["needsDetailedFabricRepeatInvestigation"])
        self.assertFalse(drift["verifiedPhysicalRepeatWithinTolerance"])



if __name__=="__main__":
    unittest.main()
