"""Pure Python regressions for unapproved source-derived UV diagnostics."""
import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[2] / "scripts/blender/uv_candidate_audit.py"
spec = importlib.util.spec_from_file_location("uv_candidate_audit", path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

XYZ = ((0,0,0), (1,0,0), (0,0,1))
UV = ((0,0), (1,0), (0,1))


class CandidateUvAuditTests(unittest.TestCase):
    def test_metric_uv_keeps_same_pattern_units_for_different_panel_sizes(self):
        # The same 20-mm feature has the same U span in sleeve, torso and leg
        # even when those panels have different total widths.
        panel_origins = [(-0.35, 0.45), (-0.20, 0.75), (0.12, 0.10)]
        for start_x, start_z in panel_origins:
            a = audit.metric_planar_uv((start_x, 0.2, start_z),
                                      origin_x=start_x, origin_z=start_z)
            b = audit.metric_planar_uv((start_x + 0.02, 0.3, start_z + 0.05),
                                      origin_x=start_x, origin_z=start_z)
            self.assertAlmostEqual(b[0] - a[0], 0.02)
            self.assertAlmostEqual(b[1] - a[1], 0.05)

    def test_metric_uv_rejects_bad_source_coordinates(self):
        for point in [(0, 1), (0, float("inf"), 2), (0, True, 2),
                      ("0", 1, 2)]:
            with self.assertRaises(ValueError):
                audit.metric_planar_uv(point, origin_x=0, origin_z=0)
        with self.assertRaises(ValueError):
            audit.metric_planar_uv((0, 1, 2), origin_x=float("nan"), origin_z=0)

    def test_triangle_area_in_metres_is_not_artificially_normalized(self):
        # 20mm x 50mm triangle in metre UV stays 0.0005 square metres.
        real_m = ((0, 0), (0.02, 0), (0, 0.05))
        result = audit.audit_uv_triangles([(XYZ, real_m)])
        self.assertTrue(result["candidateUvTopologyPass"])
        self.assertAlmostEqual(result["medianUvAreaPerSquareMetre"], 0.001)
        self.assertFalse(result["physicalFabricRepeatVerified"])

    def test_cylinder_arc_maps_quarter_turn_to_metres(self):
        import math
        points = [(0.1, 0.0, 0.0), (0.0, 0.1, 0.0),
                  (0.0, 0.1, 0.05)]
        uv = audit.cylindrical_metric_face_uv(
            points, center_xy=(0.0, 0.0), radius_m=0.1, origin_z=0
        )
        self.assertAlmostEqual(uv[1][0] - uv[0][0], math.pi * 0.05)
        self.assertAlmostEqual(uv[2][1] - uv[1][1], 0.05)

    def test_cylinder_face_crosses_angle_seam_without_long_texture_jump(self):
        import math
        radius = 0.1
        angles = [math.pi - 0.10, -math.pi + 0.10, -math.pi + 0.15]
        points = [(radius * math.cos(a), radius * math.sin(a), i * 0.01)
                  for i, a in enumerate(angles)]
        uv = audit.cylindrical_metric_face_uv(
            points, center_xy=(0.0, 0.0), radius_m=radius, origin_z=0
        )
        self.assertAlmostEqual(uv[1][0] - uv[0][0], 0.02, places=6)
        self.assertLess(max(p[0] for p in uv)-min(p[0] for p in uv), 0.04)

    def test_cylinder_seam_phase_stays_stable_across_face_vertex_winding(self):
        import math
        radius = 0.1
        angles = [math.pi - 0.11, -math.pi + 0.10, math.pi - 0.05]
        points = [(radius * math.cos(angle), radius * math.sin(angle), 0.01 * index)
                  for index, angle in enumerate(angles)]
        reference = audit.cylindrical_metric_face_uv(
            points, center_xy=(0, 0), radius_m=radius, origin_z=0
        )
        # Adjacent triangles can list identical vertices in a different
        # cyclic order or opposite winding. Neither may shift a stripe by 2*pi*r.
        for order in ((1, 2, 0), (2, 0, 1), (1, 0, 2), (2, 1, 0)):
            with self.subTest(order=order):
                remapped = audit.cylindrical_metric_face_uv(
                    [points[index] for index in order],
                    center_xy=(0, 0), radius_m=radius, origin_z=0
                )
                for actual, original_index in zip(remapped, order):
                    self.assertAlmostEqual(actual[0], reference[original_index][0], places=8)
                    self.assertAlmostEqual(actual[1], reference[original_index][1], places=8)

    def test_cylinder_rejects_ambiguous_polygon_and_invalid_radius(self):
        import math
        angles = [0, 0.25 * math.pi, 0.75 * math.pi, -0.75 * math.pi]
        points = [(math.cos(a), math.sin(a), 0.1) for a in angles]
        with self.assertRaises(ValueError):
            audit.cylindrical_metric_face_uv(
                points, center_xy=(0, 0), radius_m=0.1, origin_z=0
            )
        with self.assertRaises(ValueError):
            audit.cylindrical_metric_face_uv(
                points[:3], center_xy=(0, 0), radius_m=0, origin_z=0
            )

    def test_valid_uv_is_not_a_physical_fabric_certificate(self):
        result = audit.audit_uv_triangles([(XYZ, UV)])
        self.assertTrue(result["candidateUvTopologyPass"])
        self.assertEqual(result["noncollapsedTriangleCount"], 1)
        self.assertFalse(result["physicalFabricRepeatVerified"])
        self.assertFalse(result["supplierGrainVerified"])
        self.assertFalse(result["productionApproved"])

    def test_collapsed_uv_is_recorded_and_rejected(self):
        result = audit.audit_uv_triangles([(XYZ, ((0,0),(0,0),(0,0)))])
        self.assertFalse(result["candidateUvTopologyPass"])
        self.assertEqual(result["collapsedUvTriangles"], 1)

    def test_zero_area_geometry_is_not_misdiagnosed_as_uv(self):
        xyz = ((0,0,0),(1,0,0),(2,0,0))
        result = audit.audit_uv_triangles([(xyz, UV)])
        self.assertFalse(result["candidateUvTopologyPass"])
        self.assertEqual(result["degenerateSurfaceTriangles"], 1)

    def test_nonfinite_and_empty_candidates_fail_closed(self):
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([])
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([(XYZ, ((0,0),(float("nan"),0),(0,1)))])
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([(XYZ, UV)], min_uv_area=0)

    def test_density_tracks_surface_units(self):
        result = audit.audit_uv_triangles([(XYZ, UV)])
        self.assertAlmostEqual(result["medianUvAreaPerSquareMetre"], 1)
        self.assertAlmostEqual(result["p95RelativeUvDensityDeviation"], 0)

    def test_uv_density_variance_is_reported_without_false_approval(self):
        # Same UV area on a physically larger triangle means inconsistent
        # projection density; it must be observable but NEVER supplier-approved.
        wide_xyz = ((0,0,0), (2,0,0), (0,0,1))
        result = audit.audit_uv_triangles([(XYZ, UV), (wide_xyz, UV)])
        self.assertGreater(result["p95RelativeUvDensityDeviation"], 0)
        self.assertFalse(result["physicalFabricRepeatVerified"])
        self.assertFalse(result["productionApproved"])


if __name__ == "__main__":
    unittest.main()
