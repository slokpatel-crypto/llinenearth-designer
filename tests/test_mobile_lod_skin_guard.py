"""Geometry-only regression of protective weights; runs without Blender."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "blender"))
from mobile_lod_skin_guard import skin_protection_weight


class SkinGuardWeightTests(unittest.TestCase):
    def test_source_cloth_near_contact_is_strongly_protected(self):
        for d in (0, 0.012, 0.033, 0.055):
            self.assertEqual(skin_protection_weight(d), 1.0)

    def test_far_cloth_is_unaffected(self):
        for d in (0.115, 0.3, 3.0):
            self.assertEqual(skin_protection_weight(d), 0.0)

    def test_falloff_is_continuous_bounded_and_monotone(self):
        weights = [skin_protection_weight(d / 1000) for d in range(0, 151)]
        self.assertTrue(all(0 <= w <= 1 for w in weights))
        self.assertTrue(all(a >= b for a, b in zip(weights, weights[1:])))
        self.assertAlmostEqual(skin_protection_weight(.085), .5, places=12)
        self.assertAlmostEqual(skin_protection_weight(.055000001), 1, places=10)
        self.assertAlmostEqual(skin_protection_weight(.114999999), 0, places=10)

    def test_invalid_contact_measurements_are_rejected(self):
        for value in (-.01, -math.inf, math.inf, math.nan):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    skin_protection_weight(value)


if __name__ == "__main__":
    unittest.main()
