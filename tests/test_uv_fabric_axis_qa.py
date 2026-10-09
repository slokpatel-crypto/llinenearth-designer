"""Warp/weft UV differential diagnostics (no Blender, no fake textile repeat)."""
import math
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"blender"))
from uv_fabric_axis_qa import uv_fabric_axes_mm,summarise_uv_fabric_axes,axis_drift_against_authored


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


if __name__=="__main__":
    unittest.main()
