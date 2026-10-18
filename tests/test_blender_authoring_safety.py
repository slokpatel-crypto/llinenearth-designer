"""Dependency-free regression checks for candidate Blender authoring safeguards.

Run: python3 -m unittest discover -s tests -p 'test_blender_authoring_safety.py'
These verify authoring source contracts only; they DO NOT replace native Blender BVH QA.
"""
from pathlib import Path
import ast
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts/blender/author-linen-earth-officewear.py"


class AuthoringSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SOURCE.read_text(encoding="utf8")
        cls.tree = ast.parse(cls.source)

    def test_uv_does_not_normalize_each_garment_to_unit_square(self):
        function = next(n for n in self.tree.body if isinstance(n, ast.FunctionDef) and n.name == "planar_grain_uv")
        source = ast.get_source_segment(self.source, function) or ""
        self.assertIn("vertex.co.x - min_x", source)
        self.assertIn("vertex.co.z - min_z", source)
        self.assertNotIn("/ span_x", source)
        self.assertNotIn("/ span_z", source)

    def test_unverified_fabric_evidence_is_explicit(self):
        self.assertIn('"linen_earth_supplier_repeat_verified"] = False', self.source)
        self.assertIn('"linen_earth_grain_direction_verified"] = False', self.source)
        self.assertIn('"uncalibrated-metric-projection"', self.source)

    def test_leg_candidates_restricted_to_hip_width(self):
        self.assertIn("-hip_half <= p.x - center_x < 0", self.source)
        self.assertIn("0 <= p.x - center_x <= hip_half", self.source)

    def test_fit_inputs_fail_closed_rather_than_clamp(self):
        self.assertIn("math.isfinite(options.clearance_mm)", self.source)
        self.assertIn("math.isfinite(options.thickness_mm)", self.source)
        self.assertIn("refusing silent fit changes", self.source)
        self.assertNotIn("max(0.003, min(0.018", self.source)
        self.assertNotIn("max(0.0006, min(0.004", self.source)


if __name__ == "__main__":
    unittest.main()
