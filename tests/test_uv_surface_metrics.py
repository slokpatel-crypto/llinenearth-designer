"""UV area-scale regression for diagnostic 3D decimation, independent of Blender."""
import math
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"blender"))
from uv_surface_metrics import triangle_world_mm_per_uv_unit, uv_density_summary


class UvSurfaceDensityTests(unittest.TestCase):
    def setUp(self):
        self.triangle=((0,0,0),(1,0,0),(0,1,0))
        self.uv=((0,0),(1,0),(0,1))

    def test_unit_fabric_scale_is_measured_from_real_triangle_area(self):
        self.assertAlmostEqual(triangle_world_mm_per_uv_unit(self.triangle,self.uv),1000)
        scaled_uv=((0,0),(2,0),(0,2))
        self.assertAlmostEqual(triangle_world_mm_per_uv_unit(self.triangle,scaled_uv),500)

    def test_reversed_uv_winding_is_not_falsely_labeled_invalid(self):
        swapped=((0,0),(0,1),(1,0))
        self.assertAlmostEqual(triangle_world_mm_per_uv_unit(self.triangle,swapped),1000)

    def test_collapsed_uv_on_real_world_face_never_claims_fabric_repeat(self):
        self.assertEqual(triangle_world_mm_per_uv_unit(self.triangle,((0,0),(1,0),(2,0))),math.inf)
        summary=uv_density_summary((math.inf,1000,500,None))
        self.assertEqual(summary["collapsedUvTriangles"],1)
        self.assertEqual(summary["degenerateWorldTriangles"],1)
        self.assertEqual(summary["validUvTriangles"],2)
        self.assertFalse(summary["supplierPhysicalRepeatVerified"])

    def test_zero_area_world_face_has_no_surface_density(self):
        self.assertIsNone(triangle_world_mm_per_uv_unit(
            ((0,0,0),(1,1,1),(2,2,2)),self.uv))

    def test_nonfinite_coordinate_and_bad_shapes_fail_closed(self):
        with self.assertRaises(ValueError):
            triangle_world_mm_per_uv_unit(((0,0,math.nan),(1,0,0),(0,1,0)),self.uv)
        with self.assertRaises(ValueError):
            triangle_world_mm_per_uv_unit(self.triangle,((0,0),(1,0)))
        with self.assertRaises(ValueError):
            uv_density_summary((1,math.nan,3))

    def test_source_and_mobile_uv_metrics_are_evidence_not_production_approval(self):
        probe=(ROOT/"scripts"/"blender"/"probe-mobile-lod.py").read_text()
        for marker in (
            'def measured_geometry_uv_density(obj, max_samples=600):',
            'mesh.loop_triangles[index]',
            'mesh.uv_layers.active.data',
            'triangle_world_mm_per_uv_unit(xyz,uvs)',
            '"geometryOnlyUvDensity":{',
            '"verifiedPhysicalFabricRepeat":False',
            '"eligibleForProduction":False',
        ):
            self.assertIn(marker,probe)


if __name__=="__main__":
    unittest.main()
