"""Geometry regression tests; these run without Blender installed."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "blender"))
from section_geometry import triangle_section_x_span


class TriangleSectionTests(unittest.TestCase):
    def test_sparse_ring_between_vertex_heights_is_measurable(self):
        triangles = [
            ((-0.20, 0, 0.2), (0.20, 0, 0.2), (0.16, 0, 0.8)),
            ((-0.20, 0, 0.2), (0.16, 0, 0.8), (-0.16, 0, 0.8)),
        ]
        span = triangle_section_x_span(triangles, 0.5)
        self.assertAlmostEqual(span[0], -0.18)
        self.assertAlmostEqual(span[1], 0.18)

    def test_coplanar_triangle_includes_full_width(self):
        triangles = [((-0.05, 0, 0.6), (0.05, 0, 0.6), (0, 0.1, 0.6))]
        self.assertEqual(triangle_section_x_span(triangles, 0.6), (-0.05, 0.05))

    def test_outside_geometry_returns_missing_not_fake_zero(self):
        triangles = [((-0.2, 0, 0.3), (0.2, 0, 0.3), (0, 0, 0.6))]
        self.assertIsNone(triangle_section_x_span(triangles, 0.8))
        self.assertIsNone(triangle_section_x_span(triangles, math.nan))

    def test_degenerate_and_nonfinite_triangles_do_not_supply_evidence(self):
        triangles = [
            ((0, 0, 0.2), (0, 0, 0.8), (0, 0, 0.6)),
            ((math.inf, 0, 0.2), (0.2, 0, 0.8), (0, 0, 0.6)),
        ]
        self.assertIsNone(triangle_section_x_span(triangles, 0.5))

    def test_left_and_right_leg_sections_are_independent(self):
        left = [
            ((-0.14, 0, 0.2), (-0.06, 0, 0.2), (-0.08, 0, 0.8)),
            ((-0.14, 0, 0.2), (-0.08, 0, 0.8), (-0.12, 0, 0.8)),
        ]
        right = [
            ((0.06, 0, 0.2), (0.14, 0, 0.2), (0.12, 0, 0.8)),
            ((0.06, 0, 0.2), (0.12, 0, 0.8), (0.08, 0, 0.8)),
        ]
        a = triangle_section_x_span(left, 0.5)
        b = triangle_section_x_span(right, 0.5)
        self.assertAlmostEqual((a[0] + a[1]) / 2, -0.10)
        self.assertAlmostEqual((b[0] + b[1]) / 2, 0.10)
        self.assertAlmostEqual(b[0] - a[1], 0.14)


if __name__ == "__main__":
    unittest.main()
