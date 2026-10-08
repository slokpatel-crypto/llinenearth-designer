"""Blender-independent collision-envelope tests for realistic tailoring rings."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "blender"))
from surface_coverage import (
    adaptive_surface_cut_rounds,
    anatomically_enclose_intermediate_rings,
    outward_ring_quad,
    nested_tucked_hem_ring,
    sampled_mesh_face_indices,
    penetrating_surface_samples,
    subdivide_ring_profiles,
    vertical_subdivision_cuts,
)


class PhysicalPanelWindingTests(unittest.TestCase):
    def test_shell_normals_point_outwards_for_both_ring_directions(self):
        # Circle around positive X at segment 0. XY rings authored top->bottom
        # must have the SAME positive outward X normal as bottom->top.
        for ascending in (True, False):
            with self.subTest(ascending=ascending):
                lower, upper = 0.0, 1.0
                z_first, z_next = (lower, upper) if ascending else (upper, lower)
                vertices = [(1,0,z_first),(0,1,z_first),(-1,0,z_first),(0,-1,z_first),
                            (1,0,z_next),(0,1,z_next),(-1,0,z_next),(0,-1,z_next)]
                face = outward_ring_quad(0,4,0,1,ascending=ascending)
                p,q,r = (vertices[i] for i in face[:3])
                a=[q[k]-p[k] for k in range(3)]
                b=[r[k]-p[k] for k in range(3)]
                normal_x=a[1]*b[2]-a[2]*b[1]
                self.assertGreater(normal_x,0,"Outward cloth thickness must avoid bare-body penetrations")

    def test_ring_winding_rejects_ambiguous_geometry(self):
        for kwargs in (
            dict(previous=0,current=4,segment=-1,next_segment=1,ascending=True),
            dict(previous=0,current=4,segment=True,next_segment=1,ascending=True),
            dict(previous=0,current=4,segment=0,next_segment=1,ascending="down"),
        ):
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    outward_ring_quad(**kwargs)


class PhysicalTuckEnvelopeTests(unittest.TestCase):
    def test_tucked_hem_follows_real_trouser_waist_with_seven_mm_layering(self):
        ring=nested_tucked_hem_ring(0.88,0.0,-0.02,0.172,0.137)
        self.assertAlmostEqual(ring[0],0.88)
        self.assertAlmostEqual(ring[2],-0.02)
        self.assertAlmostEqual((0.172-ring[3])*1000,7)
        self.assertAlmostEqual((0.137-ring[4])*1000,7)
        self.assertGreater(ring[3],0)
        self.assertGreater(ring[4],0)

    def test_tucked_hem_does_not_hide_invalid_physical_fit(self):
        for radius_x,radius_y,inset in (
            (0.003,0.12,0.007), (0.172,0.01,0.012),
            (0.172,0.12,0), (0.172,0.12,0.030),
        ):
            with self.subTest(params=(radius_x,radius_y,inset)):
                with self.assertRaises(ValueError):
                    nested_tucked_hem_ring(0.88,0,0,radius_x,radius_y,inset_m=inset)


class BlenderMeshSamplingTests(unittest.TestCase):
    def test_sampled_indices_are_integer_only_and_bounded(self):
        for face_count, limit in ((0,600),(10,600),(2000,600),(50317,600)):
            with self.subTest(face_count=face_count):
                indices=sampled_mesh_face_indices(face_count,limit)
                self.assertLessEqual(len(indices),limit)
                self.assertEqual(len(indices),len(set(indices)))
                self.assertTrue(all(isinstance(i,int) and 0<=i<face_count for i in indices))
                if face_count:
                    self.assertEqual(indices[0],0)

    def test_invalid_face_count_or_sample_limit_is_not_silently_used(self):
        for count,limit in ((-1,600),(20,0),(20,2001),(3.2,600),(True,600)):
            with self.subTest(count=count,limit=limit):
                with self.assertRaises(ValueError):
                    sampled_mesh_face_indices(count,limit)


class AdaptiveCollisionResolutionTests(unittest.TestCase):
    def test_short_edges_stay_unchanged_and_original_guides_preserved(self):
        self.assertEqual(adaptive_surface_cut_rounds(0.024,0.025),0)
        self.assertEqual(adaptive_surface_cut_rounds(0.025,0.025),0)

    def test_long_diagonals_gain_real_surface_vertices(self):
        self.assertEqual(adaptive_surface_cut_rounds(0.041,0.025),1)
        self.assertEqual(adaptive_surface_cut_rounds(0.080,0.025),2)
        self.assertEqual(adaptive_surface_cut_rounds(0.190,0.025),3)
        for length in (0.041,0.08,0.19):
            with self.subTest(length=length):
                rounds=adaptive_surface_cut_rounds(length,0.025)
                self.assertLessEqual(length / 2**rounds,0.025+1e-12)

    def test_impossible_surface_spans_fail_instead_of_loosening_collision_gate(self):
        with self.assertRaisesRegex(ValueError,"safe collision"):
            adaptive_surface_cut_rounds(0.300,0.025)

    def test_nonfinite_and_unphysical_limits_fail_closed(self):
        for length,target,passes in (
            (math.nan,0.025,3),(-0.01,0.025,3),
            (0.030,0.001,3),(0.030,0.060,3),
            (0.030,0.025,0),(0.030,0.025,8),
            (True,0.025,3),
        ):
            with self.subTest(length=length,target=target,passes=passes):
                with self.assertRaises(ValueError):
                    adaptive_surface_cut_rounds(length,target,passes)


class VerticalRefinementTests(unittest.TestCase):
    def test_short_edges_preserve_original_profile(self):
        a = (1.0, 0.0, 0.0, 0.06, 0.05)
        b = (1.045, 0.02, -0.01, 0.07, 0.06)
        self.assertEqual(subdivide_ring_profiles([a, b]), [a, b])
        self.assertEqual(vertical_subdivision_cuts(0.055), 0)

    def test_120mm_chest_gap_has_real_intermediate_collision_vertices(self):
        a = (0.7, 0.0, 0.0, 0.09, 0.10)
        b = (0.82, 0.03, -0.01, 0.11, 0.12)
        rows = subdivide_ring_profiles([a, b])
        self.assertEqual(len(rows), 4)
        self.assertEqual((rows[0], rows[-1]), (a, b))
        for previous, following in zip(rows, rows[1:]):
            self.assertLessEqual(abs(following[0] - previous[0]), 0.055 + 1e-10)
        self.assertAlmostEqual(rows[1][1], 0.01)
        self.assertAlmostEqual(rows[2][3], 0.09 + (0.11 - 0.09) * 2 / 3)

    def test_descending_sleeve_profile_retains_tailoring_control_rings(self):
        top = (1.42, -0.2, 0.0, 0.068, 0.052)
        elbow = (1.11, -0.22, 0.0, 0.052, 0.043)
        cuff = (0.85, -0.23, 0.0, 0.038, 0.032)
        rows = subdivide_ring_profiles([top, elbow, cuff])
        self.assertEqual(rows[0], top)
        self.assertEqual(rows[-1], cuff)
        self.assertIn(elbow, rows)
        self.assertTrue(all(a[0] > b[0] for a, b in zip(rows, rows[1:])))
        self.assertTrue(all(a[3] > 0 and a[4] > 0 for a in rows))
        self.assertTrue(all((a[0] - b[0]) <= 0.055 + 1e-10 for a, b in zip(rows, rows[1:])))

    def test_nonmonotonic_or_duplicate_rings_fail_closed(self):
        base = (1.1, 0.0, 0.0, 0.04, 0.04)
        for rings in ([base], [base, base], [(1.0, 0, 0, 0.1, 0.1), base, (1.05, 0, 0, 0.1, 0.1)]):
            with self.subTest(rings=rings):
                with self.assertRaises(ValueError):
                    subdivide_ring_profiles(rings)

    def test_nan_negative_radius_or_impossible_span_fail_closed(self):
        safe = (0.5, 0.0, 0.0, 0.1, 0.1)
        for bad in [(math.nan, 0, 0, 0.1, 0.1), (1.0, 0, 0, -0.1, 0.1), (True, 0, 0, 0.1, 0.1)]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    subdivide_ring_profiles([safe, bad])
        with self.assertRaisesRegex(ValueError, "too long"):
            subdivide_ring_profiles([safe, (1.2, 0, 0, 0.1, 0.1)])

    def test_subdivision_limits_are_physical_and_not_silent(self):
        self.assertEqual(vertical_subdivision_cuts(0.11), 1)
        self.assertEqual(vertical_subdivision_cuts(0.12), 2)
        with self.assertRaises(ValueError):
            vertical_subdivision_cuts(0.55)


class LockedTorsoEnvelopeTests(unittest.TestCase):
    def test_real_body_bulge_at_intermediate_ring_is_enclosed_without_changing_guides(self):
        a = (0.4, 0.0, 0.0, 0.10, 0.08)
        b = (0.5, 0.0, 0.0, 0.10, 0.08)
        middle = (0.45, 0.0, 0.0, 0.10, 0.08)
        # Original rings are legitimate but the body expands between them.
        points = [(0.118 * math.cos(i * math.tau / 40),
                   0.090 * math.sin(i * math.tau / 40), 0.45) for i in range(40)]
        result = anatomically_enclose_intermediate_rings([a,b], [a,middle,b], points)
        self.assertEqual(result[0], a)
        self.assertEqual(result[-1], b)
        self.assertGreater(result[1][3], middle[3])
        self.assertGreater(result[1][4], middle[4])
        self.assertTrue(all(
            ((p[0]/result[1][3])**2+(p[1]/result[1][4])**2) <= 1
            for p in points
        ))

    def test_large_anatomical_expansion_fails_without_hiding_identity_mismatch(self):
        a = (0.4, 0.0, 0.0, 0.10, 0.08)
        b = (0.5, 0.0, 0.0, 0.10, 0.08)
        midpoint = (0.45, 0.0, 0.0, 0.10, 0.08)
        # Section samples must remain inside the actual torso corridor.
        # An outer ellipse outside that corridor only exercises insufficient
        # evidence, not the intended impossible-garment-envelope failure.
        body = [
            (0.14 + 0.005 * math.cos(i * math.tau / 30),
             0.12 + 0.005 * math.sin(i * math.tau / 30), 0.45)
            for i in range(30)
        ]
        with self.assertRaisesRegex(ValueError, "remodel the original panel"):
            anatomically_enclose_intermediate_rings([a,b], [a,midpoint,b], body)

    def test_arm_at_waist_height_does_not_become_fake_torso_width(self):
        a = (0.40, 0.0, 0.0, 0.12, 0.09)
        b = (0.50, 0.0, 0.0, 0.12, 0.09)
        mid = (0.45, 0.0, 0.0, 0.12, 0.09)
        torso = [(0.125 * math.cos(i*math.tau/50),
                  0.095 * math.sin(i*math.tau/50), 0.45) for i in range(50)]
        hanging_arms = [(0.205, 0.12, 0.45), (-0.205, -0.12, 0.45)]
        result = anatomically_enclose_intermediate_rings(
            [a,b], [a,mid,b], torso + hanging_arms)
        self.assertEqual(result[0], a)
        self.assertEqual(result[-1], b)
        self.assertLess(result[1][3] - mid[3], 0.04)

    def test_missing_section_fails_closed(self):
        a, b = (0.4, 0, 0, 0.10, 0.08), (0.5, 0, 0, 0.10, 0.08)
        body = [(0.0, 0.0, 0.9) for _ in range(25)]
        with self.assertRaisesRegex(ValueError, "torso samples"):
            anatomically_enclose_intermediate_rings([a,b], [a,(0.45, 0, 0, 0.10, 0.08),b], body)


class SurfaceSamplingTests(unittest.TestCase):
    def test_face_centroid_catches_skin_when_all_vertices_outside(self):
        points = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)]
        hits = penetrating_surface_samples(points, [(0, 1, 2, 3)], lambda p: abs(p[0]) < 0.01 and abs(p[1]) < 0.01)
        self.assertEqual([h["location"] for h in hits], ["centroid"])

    def test_shared_edge_is_probed_once(self):
        points = [(0, 0, 0), (2, 0, 0), (0, 2, 0), (2, 2, 0)]
        hits = penetrating_surface_samples(points, [(0, 1, 2), (1, 3, 2)], lambda p: p == (1.0, 1.0, 0.0))
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["location"], "edge-midpoint")

    def test_invalid_faces_fail_before_claiming_clearance(self):
        with self.assertRaises(ValueError):
            penetrating_surface_samples([(0, 0, 0)], [(0, 1, 2)], lambda p: False)

    def test_diagnostic_limit_is_respected(self):
        points = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)]
        hits = penetrating_surface_samples(points, [(0, 1, 2, 3)], lambda p: True, max_hits=2)
        self.assertEqual(len(hits), 2)


if __name__ == "__main__":
    unittest.main()
