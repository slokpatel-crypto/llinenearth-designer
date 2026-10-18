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


    def test_cylindrical_phase_alignment_only_removes_exact_full_turn_jump(self):
        import math
        radius = .1
        wrap = 2*math.pi*radius
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)), (3, (.04-wrap, .05))],
        ]
        before = audit.audit_shared_uv_edges(faces)
        corrected, evidence = audit.phase_align_cylindrical_charts(faces, radius_m=radius)
        after = audit.audit_shared_uv_edges(corrected)
        self.assertEqual(before["unapprovedInteriorUvSeams"], 1)
        self.assertEqual(after["unapprovedInteriorUvSeams"], 0)
        self.assertEqual(evidence["phaseShiftedFaces"], 1)
        self.assertAlmostEqual(corrected[1][0][1][0], .02, places=7)
        self.assertFalse(evidence["supplierRepeatVerified"])
        self.assertFalse(evidence["productionApproved"])

    def test_phase_stitching_never_fakes_tangent_chart_or_twisted_seam(self):
        import math
        wrap = 2*math.pi*.1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, .01)), (3, (.04-wrap, .05))],
        ]
        # Conflicting grain (V) cannot be corrected by moving U.
        corrected, evidence = audit.phase_align_cylindrical_charts(faces, radius_m=.1)
        self.assertEqual(corrected, faces)
        self.assertEqual(evidence["unapprovedInteriorUvSeamsAfter"], 1)
        # Even exactly alignable U phase must not silently stitch an unapproved
        # geometry-estimated local tangent chart.
        faces[1][1] = (1, (.02-wrap, 0))
        corrected, evidence = audit.phase_align_cylindrical_charts(
            faces, radius_m=.1, excluded_face_indices=[1]
        )
        self.assertEqual(corrected, faces)
        self.assertEqual(evidence["excludedUnapprovedFaceCharts"], 1)
        self.assertEqual(evidence["unapprovedInteriorUvSeamsAfter"], 1)
        for radius in (float("nan"), 0, True, -.1):
            with self.subTest(radius=radius), self.assertRaises(ValueError):
                audit.phase_align_cylindrical_charts(faces, radius_m=radius)
        with self.assertRaises(ValueError):
            audit.phase_align_cylindrical_charts(faces, radius_m=.1, excluded_face_indices=[2])


    def test_metric_tangent_chart_safe_translation_closes_shared_edge(self):
        faces = [
            [(0, (0.0, 0.0)), (1, (.02, 0.0)), (2, (.02, .05))],
            [(2, (0.0, 0.0)), (1, (0.0, -.05)), (3, (.02, 0.0))],
        ]
        corrected, evidence = audit.align_metric_tangent_charts(
            faces, tangent_face_indices=[1]
        )
        self.assertEqual(evidence["originalUnapprovedInteriorUvSeams"], 1)
        self.assertEqual(evidence["remainingUnapprovedInteriorUvSeams"], 0)
        self.assertEqual(evidence["rigidlyAlignedTangentChartFaces"], 1)
        self.assertTrue(audit.audit_shared_uv_edges(corrected)["topologicalUvContinuityPass"])
        self.assertAlmostEqual(
            ((corrected[1][1][1][0]-corrected[1][0][1][0])**2
             +(corrected[1][1][1][1]-corrected[1][0][1][1])**2)**.5, .05
        )
        self.assertFalse(evidence["supplierGrainVerified"])
        self.assertFalse(evidence["seamLayoutApproved"])
        self.assertFalse(evidence["productionApproved"])

    def test_metric_chart_rigid_alignment_preserves_area_and_bounded_rotation(self):
        import math
        angle = math.radians(5)
        def shifted(uv):
            return (math.cos(angle)*uv[0]-math.sin(angle)*uv[1]+.3,
                    math.sin(angle)*uv[0]+math.cos(angle)*uv[1]-.4)
        original = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, shifted((.02, .05))), (1, shifted((.02, 0))),
             (3, shifted((.04, .05)))],
        ]
        corrected, evidence = audit.align_metric_tangent_charts(
            original, tangent_face_indices=[1]
        )
        self.assertEqual(evidence["rigidlyAlignedTangentChartFaces"], 1)
        self.assertEqual(evidence["remainingUnapprovedInteriorUvSeams"], 0)
        self.assertAlmostEqual(math.dist(corrected[1][0][1], corrected[1][2][1]),
                               math.dist(original[1][0][1], original[1][2][1]), places=10)
        unchanged, rejected = audit.align_metric_tangent_charts(
            original, tangent_face_indices=[1], max_rotation_degrees=4
        )
        self.assertEqual(unchanged, original)
        self.assertEqual(rejected["unresolvedTangentChartFaces"], 1)

    def test_metric_chart_stitch_never_stretches_edge_or_approves_grain(self):
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (0, 0)), (1, (0, -.07)), (3, (.02, 0))],
        ]
        unchanged, evidence = audit.align_metric_tangent_charts(
            faces, tangent_face_indices=[1]
        )
        self.assertEqual(unchanged, faces)
        self.assertEqual(evidence["remainingUnapprovedInteriorUvSeams"], 1)
        self.assertFalse(evidence["supplierRepeatVerified"])
        for kwargs in (
            {"max_rotation_degrees": float("inf")},
            {"max_rotation_degrees": 16},
            {"max_rotation_degrees": True},
            {"tangent_face_indices": [-1]},
            {"tangent_face_indices": [2]},
            {"tangent_face_indices": [True]},
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                audit.align_metric_tangent_charts(faces, **dict({"tangent_face_indices": [1]}, **kwargs))

    def test_nonmanifold_geometry_never_receives_tangent_chart_stitch(self):
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.01, .03))],
            [(1, (0, 0)), (0, (-.02, 0)), (3, (0, .03))],
            [(0, (0, 0)), (1, (.02, 0)), (4, (.01, -.03))],
        ]
        unchanged, evidence = audit.align_metric_tangent_charts(
            faces, tangent_face_indices=[1]
        )
        self.assertEqual(unchanged, faces)
        self.assertTrue(evidence["nonManifoldTopologyRejected"])
        self.assertEqual(evidence["rigidlyAlignedTangentChartFaces"], 0)


    def test_source_seam_classifier_separates_exact_periodic_cut_from_other_tears(self):
        import math
        wrap = 2*math.pi*.1
        base = [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))]
        periodic = [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)), (3, (.04-wrap, .05))]
        faces = [base, periodic]
        result = audit.classify_unapproved_uv_seams(faces, radius_m=.1)
        self.assertEqual(result["unapprovedInteriorUvSeams"], 1)
        self.assertEqual(result["exactFullTurnCutCandidates"], 1)
        self.assertEqual(result["nonPeriodicUvTears"], 0)
        self.assertFalse(result["cutPlacementApproved"])
        self.assertFalse(result["supplierGrainVerified"])
        irregular = [periodic[0], (1, (.02-wrap, .01)), periodic[2]]
        result = audit.classify_unapproved_uv_seams([base, irregular], radius_m=.1)
        self.assertEqual(result["nonPeriodicUvTears"], 1)
        self.assertEqual(result["exactFullTurnCutCandidates"], 0)

    def test_unapproved_tangent_face_cannot_claim_automatic_periodic_seam(self):
        import math
        wrap = 2*math.pi*.1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)), (3, (.04-wrap, .05))],
        ]
        result = audit.classify_unapproved_uv_seams(
            faces, radius_m=.1, tangent_face_indices=[1]
        )
        self.assertEqual(result["nearUnapprovedTangentChart"], 1)
        self.assertEqual(result["exactFullTurnCutCandidates"], 0)
        self.assertFalse(result["productionApproved"])

    def test_cut_classification_refuses_unknown_radius_or_bad_tangent_index(self):
        faces = [[(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))]]
        for kwargs in (
            {"radius_m": 0},
            {"radius_m": float("nan")},
            {"radius_m": True},
            {"radius_m": .1, "tangent_face_indices": [1]},
            {"radius_m": .1, "tangent_face_indices": [True]},
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                audit.classify_unapproved_uv_seams(faces, **kwargs)

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
