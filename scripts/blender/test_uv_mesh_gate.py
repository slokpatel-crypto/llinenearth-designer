import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from uv_mesh_gate import inspect_uv_polygons


class UVPreflightTests(unittest.TestCase):
    def test_continuous_shared_edge(self):
        result = inspect_uv_polygons([
            [(0, (0, 0)), (1, (1, 0)), (2, (1, 1))],
            [(2, (1, 1)), (1, (1, 0)), (3, (2, 1))],
        ])
        self.assertEqual(result["sharedUvEdges"], 1)
        self.assertEqual(result["discontinuousSharedUvEdges"], 0)
        self.assertEqual(result["collapsedUvFaces"], 0)

    def test_shared_edge_seam_cannot_pass_unreviewed(self):
        result = inspect_uv_polygons([
            [(0, (0, 0)), (1, (1, 0)), (2, (1, 1))],
            [(2, (0, 1)), (1, (0, 0)), (3, (1, 1))],
        ])
        self.assertEqual(result["discontinuousSharedUvEdges"], 1)
        self.assertEqual(result["maxSharedUvDelta"], 1)

    def test_tiny_float_noise_tolerated(self):
        result = inspect_uv_polygons([
            [(0, (0, 0)), (1, (1, 0)), (2, (1, 1))],
            [(2, (1 + 1e-6, 1)), (1, (1, 1e-6)), (3, (2, 1))],
        ])
        self.assertEqual(result["discontinuousSharedUvEdges"], 0)

    def test_nonfinite_and_malformed_faces_fail(self):
        result = inspect_uv_polygons([
            [(0, (0, 0)), (1, (math.nan, 0)), (2, (1, 1))],
            [(0, (0, 0)), (1, (math.inf, 0)), (2, (1, 1))],
            [(0, (0, 0)), (1, (1, 0)), (1, (1, 1))],
            [(0, (0, 0)), (1, ("1", 0)), (2, (1, 1))],
        ])
        self.assertEqual(result["nonfiniteUvFaces"], 2)
        self.assertEqual(result["invalidUvFaces"], 2)

    def test_collapsed_planar_projection_is_detected(self):
        result = inspect_uv_polygons([[(0, (0, 0)), (1, (0, .5)), (2, (0, 1))]])
        self.assertEqual(result["collapsedUvFaces"], 1)

    def test_nonmanifold_shared_edge_is_reported(self):
        result = inspect_uv_polygons([
            [(0, (0, 0)), (1, (1, 0)), (2, (0, 1))],
            [(1, (1, 0)), (0, (0, 0)), (3, (1, 1))],
            [(0, (0, 0)), (1, (1, 0)), (4, (1, -1))],
        ])
        self.assertEqual(result["sharedUvEdges"], 1)
        self.assertEqual(result["nonmanifoldUvEdges"], 1)

    def test_invalid_tolerance_is_rejected(self):
        with self.assertRaises(ValueError):
            inspect_uv_polygons([], tolerance=math.nan)

    def test_no_shared_edges_is_not_false_evidence(self):
        result = inspect_uv_polygons([[(0, (0, 0)), (1, (1, 0)), (2, (1, 1)), (3, (0, 1))]])
        self.assertEqual(result["sharedUvEdges"], 0)

    def test_uv_overflow_is_not_certified(self):
        result = inspect_uv_polygons([[(0, (0, 0)), (1, (1e308, 0)), (2, (0, 1e308))]])
        self.assertEqual(result["nonfiniteUvFaces"], 1)


if __name__ == "__main__":
    unittest.main()
