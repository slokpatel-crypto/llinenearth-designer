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

    def test_ambiguous_seam_evidence_preserves_source_metric_bounds(self):
        import math
        angles = [0, .25 * math.pi, .75 * math.pi, -.75 * math.pi]
        points = [(math.cos(a)*.1, math.sin(a)*.1, z)
                  for a, z in zip(angles, (.70, .74, .81, .84))]
        with self.assertRaisesRegex(ValueError, "ambiguous half-cylinder"):
            audit.cylindrical_metric_face_uv(
                points, center_xy=(0, 0), radius_m=.1, origin_z=0
            )
        evidence = audit.cylindrical_ambiguous_face_diagnostic(
            points, center_xy=(0, 0)
        )
        self.assertGreaterEqual(evidence["angularSpanDegrees"], 180)
        self.assertEqual(evidence["zRangeMetres"], [.7, .84])
        self.assertEqual(evidence["vertexCount"], 4)
        self.assertFalse(evidence["fabricGrainVerified"])
        self.assertFalse(evidence["productionApproved"])

    def test_ambiguous_face_spatial_evidence_rejects_bad_source_points(self):
        for points in ([(0, 0, 0)], [(0, 1, 2), (1, 2, 3), (1, 2, float("nan"))],
                       [(0, 1, 2), (1, 2, 3), (True, 0, 1)],
                       [(0, 1), (1, 2, 3), (1, 0, 2)]):
            with self.subTest(points=points), self.assertRaises(ValueError):
                audit.cylindrical_ambiguous_face_diagnostic(
                    points, center_xy=(0, 0)
                )

    def test_metric_tangent_face_chart_preserves_3d_surface_scale(self):
        # Vertical YZ fabric: XZ fallback would collapse U to zero, whereas
        # orthonormal local tangent UV keeps real dimensions in metres.
        quad = [(0.1, 0.0, 0.7), (0.1, .02, 0.7),
                (0.1, .02, .74), (0.1, 0, .74)]
        mapped = audit.metric_tangent_chart_uv(quad)
        result = audit.audit_uv_triangles([
            ((quad[0], quad[1], quad[2]), (mapped[0], mapped[1], mapped[2])),
            ((quad[0], quad[2], quad[3]), (mapped[0], mapped[2], mapped[3])),
        ])
        self.assertTrue(result["candidateUvTopologyPass"])
        self.assertAlmostEqual(result["medianUvAreaPerSquareMetre"], 1.0, places=5)
        self.assertFalse(result["physicalFabricRepeatVerified"])

    def test_metric_tangent_chart_survives_cylinder_axis_singularity(self):
        # The source's four rejected sleeve faces have 203-326 degree angle
        # spans. This geometry-only chart avoids a discontinuous polar angle.
        import math
        angles = [0, .25*math.pi, .75*math.pi, -.75*math.pi]
        points = [(math.cos(a)*.03, math.sin(a)*.03, z)
                  for a,z in zip(angles, (.5, .51, .54, .53))]
        mapped = audit.metric_tangent_chart_uv(points)
        self.assertEqual(len(mapped), 4)
        self.assertTrue(all(math.isfinite(n) for uv in mapped for n in uv))
        # Does NOT claim continuity across separate face charts or supplier grain.
        self.assertNotEqual(mapped[1], mapped[0])

    def test_metric_tangent_chart_rejects_degenerate_or_invalid_source(self):
        for points in ([(0, 0, 0), (1, 0, 0), (2, 0, 0)],
                       [(0, 0, 0), (0, 0, 0), (0, 0, 0)],
                       [(0, 0, 0), (1, 0, 0), (0, float("nan"), 1)],
                       [(0, 0, 0), (1, 0, 0), (0, True, 1)]):
            with self.subTest(points=points), self.assertRaises(ValueError):
                audit.metric_tangent_chart_uv(points)


    def test_adjacent_uv_faces_share_source_edge_without_seam(self):
        faces = [
            [(0, (0.0, 0.0)), (1, (.02, 0.0)), (2, (.02, .05))],
            [(2, (.02, .05)), (1, (.02, 0.0)), (3, (.04, .05))],
        ]
        r = audit.audit_shared_uv_edges(faces)
        self.assertEqual(r["sharedInteriorEdges"], 1)
        self.assertEqual(r["boundaryEdges"], 4)
        self.assertEqual(r["unapprovedInteriorUvSeams"], 0)
        self.assertTrue(r["topologicalUvContinuityPass"])
        self.assertFalse(r["supplierGrainVerified"])

    def test_face_local_origin_is_reported_as_real_uv_seam(self):
        faces = [
            [(0, (0.0, 0.0)), (1, (.02, 0.0)), (2, (.02, .05))],
            [(2, (0.0, 0.0)), (1, (0.0, -.05)), (3, (.02, -.05))],
        ]
        r = audit.audit_shared_uv_edges(faces)
        self.assertEqual(r["unapprovedInteriorUvSeams"], 1)
        self.assertAlmostEqual(r["maxInteriorUvJumpMm"], (0.02**2 + 0.05**2)**.5 * 1000, places=4)
        self.assertEqual(r["sampleUnapprovedSeams"][0]["sourceEdgeVertices"], [1, 2])
        self.assertFalse(r["topologicalUvContinuityPass"])
        self.assertFalse(r["productionApproved"])

    def test_nonmanifold_shared_uv_edge_is_never_an_approved_chart(self):
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (0, .02))],
            [(1, (.02, 0)), (0, (0, 0)), (3, (0, -.02))],
            [(0, (0, 0)), (1, (.02, 0)), (4, (.01, .02))],
        ]
        r = audit.audit_shared_uv_edges(faces)
        self.assertEqual(r["nonManifoldEdges"], 1)
        self.assertFalse(r["topologicalUvContinuityPass"])

    def test_uv_seam_audit_rejects_bad_topology_and_nonmetric_inputs(self):
        bad_faces = (
            [],
            [[(0, (0, 0)), (1, (1, 0))]],
            [[(0, (0, 0)), (0, (1, 0)), (2, (1, 1))]],
            [[(True, (0, 0)), (1, (1, 0)), (2, (1, 1))]],
            [[(0, (0, 0)), (1, (float("nan"), 0)), (2, (1, 1))]],
            [[(0, (0, 0)), (1, ("0.1", 0)), (2, (1, 1))]],
        )
        for faces in bad_faces:
            with self.subTest(faces=faces), self.assertRaises(ValueError):
                audit.audit_shared_uv_edges(faces)
        for kwargs in ({"tolerance_m": 0}, {"tolerance_m": float("inf")},
                       {"sample_limit": -1}, {"sample_limit": True}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                audit.audit_shared_uv_edges([[(0, (0, 0)), (1, (1, 0)), (2, (1, 1))]], **kwargs)

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
