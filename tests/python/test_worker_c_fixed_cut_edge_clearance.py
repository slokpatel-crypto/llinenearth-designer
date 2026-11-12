"""Worker C synthetic planar-body regression for a fixed crotch cut edge.

Pure-Python research fixture, not native Blender scan or physical fit evidence.
A centroid-only reroute cannot increase clearance along immutable source edges.
"""
from __future__ import annotations

import math
import unittest

RESEARCH_CLEARANCE_M = 0.007


def distance_to_test_body(point):
    """Unsigned distance to the synthetic infinite plane at z = 0."""
    return abs(point[2])


def segment_points(start, end, steps=128):
    return [tuple(start[k] + (end[k] - start[k]) * i / steps for k in range(3))
            for i in range(steps + 1)]


def distance_upper_bound_from_endpoints(start, end):
    """1-Lipschitz upper bound on unsigned distance over the whole segment."""
    return (distance_to_test_body(start) + distance_to_test_body(end)
            + math.dist(start, end)) / 2


def segment_clearance(start, end):
    return min(distance_to_test_body(p) for p in segment_points(start, end))


class FixedCutEdgeClearanceRegression(unittest.TestCase):
    def setUp(self):
        # Both endpoints are 1mm above synthetic test-body surface.
        self.source_edge = ((-0.002, 0.0, 0.001), (0.002, 0.0, 0.001))
        self.patch_centroid = (0.0, 0.004, 0.003)

    def test_source_edge_stays_too_close_after_centroid_only_reroute(self):
        edge = self.source_edge
        baseline = segment_clearance(*edge)
        shifted_centroid = (self.patch_centroid[0], self.patch_centroid[1],
                            self.patch_centroid[2] + RESEARCH_CLEARANCE_M)
        self.assertGreater(shifted_centroid[2], self.patch_centroid[2])
        # Moving the NEW centroid does not move source cut-edge endpoints.
        after_reroute = segment_clearance(*edge)
        self.assertAlmostEqual(baseline, 0.001)
        self.assertEqual(after_reroute, baseline)
        self.assertLess(after_reroute, RESEARCH_CLEARANCE_M)
        print("TEST_BODY_FIXED_EDGE: before=1.0mm after=1.0mm < 7.0mm")

    def test_endpoint_upper_bound_can_certify_fixed_edge_is_too_close(self):
        edge = self.source_edge
        bound = distance_upper_bound_from_endpoints(*edge)
        self.assertLess(bound, RESEARCH_CLEARANCE_M)
        self.assertTrue(all(distance_to_test_body(p) <= bound + 1e-12
                            for p in segment_points(*edge, steps=1000)))
        print(f"TEST_BODY_ENDPOINT_LIPSCHITZ_UPPER_BOUND={bound*1000:.3f}mm < 7.0mm")

    def test_zero_crossing_is_not_clearance_proof(self):
        # All points lie above the plane, so the edge has no body crossing,
        # yet 1mm separation fails the research 7mm threshold.
        sample = segment_points(*self.source_edge)
        crosses_body_plane = any(p[2] < 0 for p in sample) and any(p[2] > 0 for p in sample)
        self.assertFalse(crosses_body_plane)
        self.assertLess(min(distance_to_test_body(p) for p in sample), RESEARCH_CLEARANCE_M)
        print("TEST_BODY_NON_INTERSECTING_EDGE: no crossing; insufficient clearance")

    def test_moving_real_source_edge_is_a_different_geometry_operation(self):
        # This is illustrative only: do not modify the locked real scan or UVs.
        moved_source_edge = tuple((p[0], p[1], 0.008) for p in self.source_edge)
        self.assertGreaterEqual(segment_clearance(*moved_source_edge), RESEARCH_CLEARANCE_M)
        self.assertNotEqual(moved_source_edge, self.source_edge)
        print("TEST_BODY_EDGE_REDESIGN: 8mm synthetic clearance requires changing source edge")


if __name__ == "__main__":
    unittest.main()
