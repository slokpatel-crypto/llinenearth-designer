"""Regression: missing spacing measurements must block 3D production promotion.

No absent cuff/leg samples may be interpreted as a passed fit check.
"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
PREFLIGHT = ROOT / "scripts" / "blender" / "preflight-linen-earth-officewear.py"


class SpacingMeasurementGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = PREFLIGHT.read_text(encoding="utf-8")

    def test_missing_cuff_spacing_is_blocking(self):
        self.assertIn(
            'reasons.append("Could not sample sleeve-center spacing near the locked hand guides; spacing gate cannot pass without measurement.")',
            self.source,
        )

    def test_missing_trouser_spacing_is_blocking(self):
        self.assertIn(
            'reasons.append("Could not sample trouser leg-center spacing from production geometry; spacing gate cannot pass without measurement.")',
            self.source,
        )


if __name__ == "__main__":
    unittest.main()
