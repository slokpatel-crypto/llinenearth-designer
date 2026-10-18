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

    def test_phase_cycle_conflict_rolls_back_every_uv_face(self):
        import math
        period = 2 * math.pi * .1
        # A closed ring of source quads gives inconsistent integer U phase
        # constraints. A spanning-tree shift must not manufacture a new tear.
        faces = [
            [(0, (0, 0)), (1, (0, 0)), (4, (0, .1)), (3, (0, .1))],
            [(1, (-period, 0)), (2, (0, 0)),
             (5, (0, .1)), (4, (-period, .1))],
            [(2, (-period, 0)), (0, (period, 0)),
             (3, (period, .1)), (5, (-period, .1))],
        ]
        original = audit.audit_shared_uv_edges(faces)
        candidate, report = audit.phase_align_cylindrical_charts(
            faces, radius_m=.1
        )
        self.assertEqual(candidate, faces)
        self.assertGreater(report["phaseCycleConflicts"], 0)
        self.assertTrue(report["phaseCandidateRolledBack"])
        self.assertEqual(report["phaseRollbackReason"], "inconsistent_phase_cycle")
        self.assertEqual(report["phaseShiftedFaces"], 0)
        self.assertEqual(report["unapprovedInteriorUvSeamsAfter"],
                         original["unapprovedInteriorUvSeams"])
        self.assertFalse(report["productionApproved"])

    def test_phase_alignment_never_breaks_continuous_excluded_chart_edge(self):
        import math
        period = 2 * math.pi * .1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-period, .05)), (1, (.02-period, 0)),
             (3, (.04-period, .05))],
            [(3, (.04-period, .05)), (2, (.02-period, .05)),
             (4, (.06-period, .08))],
        ]
        baseline = audit.audit_shared_uv_edges(faces)
        self.assertEqual(baseline["unapprovedInteriorUvSeams"], 1)
        candidate, report = audit.phase_align_cylindrical_charts(
            faces, radius_m=.1, excluded_face_indices=[2]
        )
        self.assertEqual(candidate, faces)
        self.assertTrue(report["phaseCandidateRolledBack"])
        self.assertEqual(report["phaseRollbackReason"],
                         "previously_continuous_edge_broken")
        self.assertGreater(report["wouldBreakPreviouslyContinuousSourceEdges"], 0)
        self.assertEqual(report["unapprovedInteriorUvSeamsAfter"], 1)

    def test_genuine_source_seam_edges_group_into_open_chain(self):
        import math
        period = 2 * math.pi * .1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-period, .05)), (1, (.02-period, 0)),
             (3, (.04-period, .05))],
            [(3, (.04-2*period, .05)), (2, (.02-2*period, .05)),
             (4, (.06-2*period, .08))],
        ]
        result = audit.classify_unapproved_uv_seams(faces, radius_m=.1)
        self.assertEqual(result["unapprovedInteriorUvSeams"], 2)
        self.assertEqual(result["exactFullTurnCutCandidates"], 2)
        self.assertEqual(result["sourceSeamGroupCountByClass"]
                         ["exactFullTurnCutCandidate"], 1)
        self.assertEqual(result["sourceSeamChainShapes"]["openPath"], 1)
        chain = result["sourceSeamChainSamples"][0]
        self.assertEqual(chain["sourceEdgeSamples"], [[1, 2], [2, 3]])
        self.assertEqual(chain["openEndSourceVertices"], [1, 3])
        self.assertFalse(chain["seamPlacementApproved"])
        self.assertFalse(result["cutPlacementApproved"])

        # Reclassifying one edge as irregular must NOT merge it into an
        # apparent continuous periodic garment seam at the shared vertex.
        irregular = [[(v, ((u+.015, w) if v == 2 else (u, w)))
                      for v, (u, w) in faces[2]]]
        mixed = audit.classify_unapproved_uv_seams(
            faces[:2]+irregular, radius_m=.1, sample_limit=0
        )
        self.assertEqual(mixed["exactFullTurnCutCandidates"], 1)
        self.assertEqual(mixed["nonPeriodicUvTears"], 1)
        self.assertEqual(mixed["sourceSeamChainShapes"]["openPath"], 2)
        self.assertEqual(mixed["sourceSeamChainSamples"], [])
        self.assertEqual(sum(mixed["sourceSeamGroupCountByClass"].values()), 2)

    def test_valid_uv_phase_component_survives_unrelated_unsafe_cycle(self):
        import math
        period = 2 * math.pi * .1
        unsafe_ring = [
            [(0, (0, 0)), (1, (0, 0)), (4, (0, .1)), (3, (0, .1))],
            [(1, (-period, 0)), (2, (0, 0)),
             (5, (0, .1)), (4, (-period, .1))],
            [(2, (-period, 0)), (0, (period, 0)),
             (3, (period, .1)), (5, (-period, .1))],
        ]
        safe_pair = [
            [(10, (0, 0)), (11, (.02, 0)), (12, (.02, .05))],
            [(12, (.02-period, .05)), (11, (.02-period, 0)),
             (13, (.04-period, .05))],
        ]
        faces = unsafe_ring + safe_pair
        before = audit.audit_shared_uv_edges(faces)
        accepted, report = audit.phase_align_cylindrical_charts(
            faces, radius_m=.1
        )
        self.assertEqual(accepted[:3], unsafe_ring)
        self.assertEqual(accepted[3], safe_pair[0])
        self.assertAlmostEqual(accepted[4][0][1][0], .02, places=7)
        self.assertEqual(report["phaseRejectedComponents"], 1)
        self.assertEqual(report["phaseAcceptedComponents"], 1)
        self.assertEqual(report["phaseShiftedFaces"], 1)
        self.assertTrue(report["phaseCandidateRolledBack"])
        self.assertEqual(report["phaseRollbackReason"], "inconsistent_phase_cycle")
        self.assertEqual(report["unapprovedInteriorUvSeamsAfter"],
                         before["unapprovedInteriorUvSeams"]-1)
        self.assertFalse(report["productionApproved"])

    def test_uv_seam_graph_identifies_branch_without_certifying_sewing(self):
        # Three actual shared source edges meet at vertex 0; their different
        # nonperiodic UV origins do not become three approved stitch lines.
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (0, .02))],
            [(0, (.01, 0)), (2, (0, .03)), (3, (.02, .02))],
            [(0, (.02, 0)), (3, (.03, .02)), (1, (.02, .01))],
        ]
        graph = audit.classify_unapproved_uv_seams(faces, radius_m=.1)
        self.assertEqual(graph["nonPeriodicUvTears"], 3)
        self.assertEqual(graph["sourceSeamChainShapes"]["branched"], 1)
        self.assertEqual(graph["sourceSeamChainSamples"][0]["forkSourceVertices"], [0])
        self.assertFalse(graph["cutPlacementApproved"])

    def test_uv_seam_closed_loop_stays_an_unapproved_candidate(self):
        faces = [
            [(1, (0, 0)), (2, (.02, 0)), (3, (.01, .02))],
            [(2, (.03, 0)), (1, (.01, 0)), (4, (.01, -.02))],
            [(3, (.02, .02)), (2, (.03, 0)), (5, (.03, .03))],
            [(1, (.01, 0)), (3, (.02, .02)), (6, (-.01, .02))],
        ]
        graph = audit.classify_unapproved_uv_seams(faces, radius_m=.1)
        self.assertEqual(graph["nonPeriodicUvTears"], 3)
        self.assertEqual(graph["sourceSeamChainShapes"]["closedLoopCandidate"], 1)
        self.assertEqual(graph["sourceSeamChainSamples"][0]["edgeCount"], 3)
        self.assertEqual(graph["sourceSeamChainSamples"][0]["openEndSourceVertices"], [])
        self.assertFalse(graph["sourceSeamChainSamples"][0]["seamPlacementApproved"])

    def test_uv_cut_path_receipts_use_original_3d_edge_metres(self):
        import math
        wrap = 2*math.pi*.1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)),
             (3, (.04-wrap, .05))],
            [(3, (.04-2*wrap, .05)), (2, (.02-2*wrap, .05)),
             (4, (.06-2*wrap, .08))],
        ]
        xyz = [
            (0, 0, 0), (.02, 0, 0), (.02, 0, .05),
            (.04, 0, .05), (.06, 0, .08)
        ]
        result = audit.classify_unapproved_uv_seams(
            faces, radius_m=.1, source_vertex_positions=xyz
        )
        self.assertTrue(result["sourceMetricGeometryAvailable"])
        self.assertEqual(result["sourceGeometryCoordinateUnits"], "mesh_metres")
        self.assertEqual(result["sourceMetricEdgeLengthByClassMm"]
                         ["exactFullTurnCutCandidate"], 70)
        self.assertEqual(result["sourceMetricVerticalRiseByClassMm"]
                         ["exactFullTurnCutCandidate"], 50)
        self.assertEqual(result["zeroLengthSourceUvTearEdges"], 0)
        self.assertEqual(result["sourceSeamChainSamples"][0]["geometryPathLengthMm"], 70)
        self.assertEqual(result["sourceSeamChainSamples"][0]["geometryZSpanMm"], 50)
        self.assertAlmostEqual(
            result["sourceSeamChainSamples"][0]["geometryVerticalEdgeFraction"],
            50/70, places=5
        )
        self.assertEqual(result["unapprovedSourceEdgeSamples"][0]["geometryEdgeLengthMm"], 50)
        self.assertFalse(result["cutPlacementApproved"])
        self.assertFalse(result["supplierGrainVerified"])

        # The sample limit must never make the complete real-mesh length look
        # artificially small, even when no individual seam receipt is emitted.
        unsampled = audit.classify_unapproved_uv_seams(
            faces, radius_m=.1, source_vertex_positions=xyz, sample_limit=0
        )
        self.assertEqual(unsampled["sourceSeamChainSamples"], [])
        self.assertEqual(unsampled["unapprovedSourceEdgeSamples"], [])
        self.assertEqual(unsampled["sourceMetricEdgeLengthByClassMm"],
                         result["sourceMetricEdgeLengthByClassMm"])
        absent = audit.classify_unapproved_uv_seams(faces, radius_m=.1)
        self.assertFalse(absent["sourceMetricGeometryAvailable"])
        self.assertIsNone(absent["sourceMetricEdgeLengthByClassMm"])

    def test_uv_cut_length_never_accepts_missing_or_fake_mesh_geometry(self):
        import math
        wrap = 2*math.pi*.1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)),
             (3, (.04-wrap, .05))],
        ]
        invalid = [
            [], [(0, 0, 0)], [(0, 0)]*4,
            [(0, 0, 0), (.02, 0, 0), (.02, 0, .05), ("0", 0, .05)],
            [(0, 0, 0), (.02, 0, 0), (.02, 0, .05), (0, True, .05)],
            [(0, 0, 0), (.02, 0, 0), (.02, 0, .05), (0, math.inf, .05)],
        ]
        for positions in invalid:
            with self.subTest(positions=positions), self.assertRaises(ValueError):
                audit.classify_unapproved_uv_seams(
                    faces, radius_m=.1, source_vertex_positions=positions
                )

    def test_source_tube_uv_radius_uses_genuine_mesh_millimetres(self):
        import math
        points = [(0.1, 0, .2), (0, .1, .4), (-.1, 0, .6),
                  (0, -.1, .8), (.1, .0, 1)]
        radius = audit.estimate_source_tube_radius_m(points)
        self.assertAlmostEqual(radius, .1, places=9)
        displaced = [(x+.8, y-.9, z+3) for x, y, z in points]
        self.assertAlmostEqual(
            audit.estimate_source_tube_radius_m(displaced), radius, places=9
        )
        evidence = audit.verify_evaluated_tube_radius_m(
            displaced, round(radius*1000, 3)
        )
        self.assertTrue(evidence["geometryRadiusIndependentlyVerified"])
        self.assertAlmostEqual(evidence["evaluatedGeometryRadiusMm"], 100)
        self.assertFalse(evidence["physicalTextileCircumferenceVerified"])
        self.assertFalse(evidence["productionApproved"])

    def test_source_tube_radius_metadata_never_overrides_actual_mesh(self):
        points = [(.1, 0, 0), (0, .1, .1), (-.1, 0, .2),
                  (0, -.1, .3), (.1, 0, .4)]
        for fake_mm in (90, 101, float("nan"), float("inf"),
                        "100", True, None):
            with self.subTest(fake_mm=fake_mm), self.assertRaises(ValueError):
                audit.verify_evaluated_tube_radius_m(points, fake_mm)
        with self.assertRaisesRegex(ValueError, "contradicts evaluated"):
            audit.verify_evaluated_tube_radius_m(points, 100.1)
        # Float32 scene receipts differ by a tiny numerical fraction of a mm,
        # not an invented supplier measurement.
        good = audit.verify_evaluated_tube_radius_m(points, 100.02)
        self.assertAlmostEqual(good["metadataDeltaMm"], .02)
        for bad_tolerance in (-.001, .051, True, "0.05", float("nan")):
            with self.subTest(bad_tolerance=bad_tolerance), self.assertRaises(ValueError):
                audit.verify_evaluated_tube_radius_m(
                    points, 100, max_delta_mm=bad_tolerance
                )

    def test_source_tube_radius_refuses_missing_fake_or_degenerate_geometry(self):
        valid = [(.1, 0, 0), (0, .1, 0), (-.1, 0, 0)]
        invalid = ([], [(.1, 0, 0)]*2, [(.1, 0, 0)]*3,
                   [(0, 0, 0)]*3,
                   [(0, 0, 0), (0, 0, 0), (.0001, 0, 0)],
                   [(0, 0), (0, .1, 0), (.1, 0, 0)],
                   [(0, False, 0), (0, .1, 0), (.1, 0, 0)],
                   [(0, 0, 0), (0, .1, 0), (float("inf"), 0, 0)],
                   [(0, 0, 0), (0, .1, 0), ("0.1", 0, 0)])
        for xyz in invalid:
            with self.subTest(xyz=xyz), self.assertRaises(ValueError):
                audit.estimate_source_tube_radius_m(xyz)
        self.assertGreater(audit.estimate_source_tube_radius_m(valid), .015)

    def test_complete_source_cut_inventory_is_not_sample_limited(self):
        import math
        wrap = 2*math.pi*.1
        # Two disconnected real source-edge cuts. Nothing from the second
        # component may disappear when the human-facing sample budget is zero.
        base = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)),
             (3, (.04-wrap, .05))],
        ]
        other = [[(vid+10, uv) for vid, uv in face] for face in base]
        xyz = [(0., 0., 0.)]*14
        for offset, edge_height in ((0, .05), (10, .03)):
            xyz[offset] = (0., 0., 0.)
            xyz[offset+1] = (.02, 0., 0.)
            xyz[offset+2] = (.02, 0., edge_height)
            xyz[offset+3] = (.04, 0., edge_height)
        result = audit.classify_unapproved_uv_seams(
            base + other, radius_m=.1, source_vertex_positions=xyz,
            sample_limit=0,
        )
        metrics = result["sourceSeamGroupMetricsByClass"]["exactFullTurnCutCandidate"]
        self.assertEqual(result["sourceSeamChainSamples"], [])
        self.assertEqual(result["unapprovedSourceEdgeSamples"], [])
        self.assertEqual(result["sourceSeamGroupsOmittedFromSamples"], 2)
        self.assertEqual(metrics["groupCount"], 2)
        self.assertEqual(metrics["edgeCount"], 2)
        self.assertEqual(metrics["branchedGroupCount"], 0)
        self.assertEqual(metrics["maxJunctionDegree"], 1)
        self.assertEqual(metrics["totalPathLengthMm"], 80)
        self.assertEqual(metrics["longestPathLengthMm"], 50)
        self.assertEqual(metrics["maxZSpanMm"], 50)
        self.assertFalse(result["cutPlacementApproved"])
        # UV-only evidence must NEVER invent metre-based seam extents.
        no_xyz = audit.classify_unapproved_uv_seams(base + other, radius_m=.1)
        self.assertIsNone(no_xyz["sourceSeamGroupMetricsByClass"]
                          ["exactFullTurnCutCandidate"]["totalPathLengthMm"])

    def test_independent_source_cut_receipt_catches_hidden_group_tampering(self):
        import math
        from copy import deepcopy
        wrap = 2*math.pi*.1
        faces = [
            [(0, (0, 0)), (1, (.02, 0)), (2, (.02, .05))],
            [(2, (.02-wrap, .05)), (1, (.02-wrap, 0)),
             (3, (.04-wrap, .05))],
        ]
        xyz = [(0, 0, 0), (.02, 0, 0), (.02, 0, .05), (.04, 0, .05)]
        authored = audit.classify_unapproved_uv_seams(
            faces, radius_m=.1, source_vertex_positions=xyz, sample_limit=0
        )
        evaluated = deepcopy(authored)
        # Tiny differences from Blender float32 vertices are explicitly
        # bounded, not mistaken for manufacturer scale measurements.
        evaluated["sourceMetricEdgeLengthByClassMm"]["exactFullTurnCutCandidate"] += .05
        evidence = audit.validate_recomputed_source_cut_evidence(authored, evaluated)
        self.assertTrue(evidence["sourceCutProvenanceConsistent"])
        self.assertAlmostEqual(evidence["maxSourceCutMetricDeltaMm"], .05)
        self.assertFalse(evidence["supplierGrainVerified"])
        self.assertFalse(evidence["productionApproved"])
        altered = deepcopy(authored)
        altered["sourceSeamGroupMetricsByClass"]["exactFullTurnCutCandidate"]["edgeCount"] += 1
        with self.assertRaisesRegex(ValueError, "edgeCount"):
            audit.validate_recomputed_source_cut_evidence(altered, authored)
        altered = deepcopy(authored)
        altered["sourceSeamGroupMetricsByClass"]["exactFullTurnCutCandidate"]["totalPathLengthMm"] += 1
        with self.assertRaisesRegex(ValueError, "totalPathLengthMm"):
            audit.validate_recomputed_source_cut_evidence(altered, authored)
        altered = deepcopy(authored)
        altered["sourceSeamChainShapes"]["openPath"] += 1
        with self.assertRaisesRegex(ValueError, "sourceSeamChainShapes"):
            audit.validate_recomputed_source_cut_evidence(altered, authored)
        altered = deepcopy(authored)
        altered["supplierGrainVerified"] = True
        with self.assertRaises(ValueError):
            audit.validate_recomputed_source_cut_evidence(altered, authored)
        for tolerance in (-1, .251, float("nan"), True):
            with self.subTest(tolerance=tolerance), self.assertRaises(ValueError):
                audit.validate_recomputed_source_cut_evidence(
                    authored, authored, metric_tolerance_mm=tolerance
                )
        with self.assertRaises(ValueError):
            audit.validate_recomputed_source_cut_evidence({}, authored)

    def test_metric_jacobian_detects_area_preserving_stripe_distortion(self):
        # Double U / halve V has unchanged UV area, but fabric features
        # change shape fourfold. An area-only test misses this failure.
        mapped = ((0, 0), (2, 0), (0, 0.5))
        result = audit.audit_uv_triangles([(XYZ, mapped)])
        self.assertTrue(result["candidateUvTopologyPass"])
        self.assertAlmostEqual(result["medianUvAreaPerSquareMetre"], 1.0)
        self.assertAlmostEqual(result["p95UvMetricAnisotropy"], 4.0)
        self.assertAlmostEqual(result["p95UvMetricStretchDeviation"], 1.0)
        self.assertEqual(result["uvTrianglesAnisotropyOver2"], 1)
        self.assertTrue(result["candidateUvMetricDistortionReviewRequired"])
        self.assertFalse(result["physicalFabricRepeatVerified"])

    def test_metric_jacobian_on_world_tilted_triangle_and_shear(self):
        # Frame must come from XYZ geometry and remain rotation invariant.
        tilted = ((0, 0, 0), (0, 1, 0), (0, 0, 1))
        undistorted = audit.audit_uv_triangles([(tilted, UV)])
        self.assertAlmostEqual(undistorted["p95UvMetricAnisotropy"], 1.0)
        self.assertAlmostEqual(undistorted["p95UvMetricStretchDeviation"], 0.0)
        self.assertFalse(undistorted["candidateUvMetricDistortionReviewRequired"])
        shear = audit.audit_uv_triangles([(tilted, ((0, 0), (1, 0), (1, 1)))])
        self.assertAlmostEqual(shear["medianUvAreaPerSquareMetre"], 1.0)
        self.assertGreater(shear["p95UvMetricAnisotropy"], 2.5)
        self.assertTrue(shear["candidateUvMetricDistortionReviewRequired"])

    def test_metric_scan_tracks_absolute_length_rescaling(self):
        mapped = ((0, 0), (0.2, 0), (0, 0.2))
        result = audit.audit_uv_triangles([(XYZ, mapped)])
        self.assertAlmostEqual(result["p95UvMetricAnisotropy"], 1.0)
        self.assertAlmostEqual(result["p95UvMetricStretchDeviation"], 0.8)
        self.assertEqual(result["uvTrianglesAnisotropyOver2"], 0)
        self.assertEqual(result["uvTrianglesMetricScaleDeviationOver50Pct"], 1)
        self.assertTrue(result["candidateUvMetricDistortionReviewRequired"])

    def test_metric_scan_rejects_numeric_strings_booleans_and_overflow(self):
        for invalid in (((0, 0), ("1", 0), (0, 1)),
                        ((0, 0), (True, 0), (0, 1))):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                audit.audit_uv_triangles([(XYZ, invalid)])
        for bad in (True, "1e-10", float("nan"), float("inf")):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                audit.audit_uv_triangles([(XYZ, UV)], min_uv_area=bad)
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([
                (((0, 0, 0), (1e308, 0, 0), (0, 1e308, 0)), UV)
            ])

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

    def test_distortion_surface_coverage_is_not_biased_by_triangle_count(self):
        # Identical cloth surfaces can be triangulated differently. A raw
        # percentage of *triangles* is not a physical distortion coverage.
        good = (XYZ, UV)
        bad_xyz = ((0, 0, 4), (2, 0, 4), (0, 0, 5))
        bad_uv = ((0, 0), (4, 0), (0, .5))
        whole = audit.audit_uv_triangles([good, (bad_xyz, bad_uv)])
        mid_xyz, mid_uv = (1, 0, 4), (2, 0)
        split = audit.audit_uv_triangles([
            good,
            ((bad_xyz[0], mid_xyz, bad_xyz[2]),
             (bad_uv[0], mid_uv, bad_uv[2])),
            ((mid_xyz, bad_xyz[1], bad_xyz[2]),
             (mid_uv, bad_uv[1], bad_uv[2])),
        ])
        self.assertEqual(whole["uvTrianglesAnisotropyOver2"], 1)
        self.assertEqual(split["uvTrianglesAnisotropyOver2"], 2)
        self.assertAlmostEqual(whole["uvMeasuredSurfaceAreaM2"], 1.5)
        self.assertAlmostEqual(whole["uvDistortedSurfaceAreaM2"], 1)
        self.assertEqual(whole["uvDistortedSurfacePct"], 66.67)
        self.assertEqual(whole["uvDistortedSurfacePct"], split["uvDistortedSurfacePct"])
        self.assertEqual(whole["uvDistortionHeightBands"][0]["distortedTriangleCount"], 0)
        self.assertEqual(whole["uvDistortionHeightBands"][4]["distortedSurfacePct"], 100)
        self.assertEqual(whole["uvSourceZExtentMetres"], [0, 5])
        self.assertFalse(whole["physicalFabricRepeatVerified"])
        self.assertFalse(split["productionApproved"])

    def test_uv_distortion_height_bands_handle_flat_and_unusable_meshes(self):
        # Zero vertical span is valid for a horizontal swatch face.
        flat_xyz = ((0, 0, 0), (1, 0, 0), (0, 1, 0))
        flat = audit.audit_uv_triangles([(flat_xyz, ((0, 0), (1, 0), (0, 1)))])
        self.assertEqual(flat["uvDistortedSurfacePct"], 0)
        self.assertEqual(flat["uvDistortionHeightBands"][0]["validTriangleCount"], 1)
        self.assertEqual(flat["uvDistortionHeightBands"][4]["validTriangleCount"], 0)
        self.assertIsNone(flat["uvDistortionHeightBands"][4]["distortedSurfacePct"])
        # A fully collapsed mapping yields zero independently measured
        # *usable* UV area; it cannot be called 0%-distorted or approved.
        collapsed = audit.audit_uv_triangles([(XYZ, ((0, 0),) * 3)])
        self.assertIsNone(collapsed["uvDistortedSurfacePct"])
        self.assertEqual(collapsed["uvMeasuredSurfaceAreaM2"], 0)
        self.assertTrue(collapsed["candidateUvMetricDistortionReviewRequired"])
        self.assertFalse(collapsed["candidateUvTopologyPass"])

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
