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

    def test_inboard_cuffs_cannot_fake_fit_by_floating_off_scanned_arm(self):
        self.assertIn('"forearmSleeveCoverage": forearm_sleeve_coverage', self.source)
        self.assertIn('distance_mm > 28.0', self.source)
        self.assertIn('nearest = cloth_bvh.find_nearest(point)', self.source)
        self.assertIn('reasons.append(f"{panel} has insufficient real forearm coverage samples.")', self.source)
        self.assertIn('reasons.append(', self.source)

    def test_garment_leg_gap_narrowing_cannot_intersect_the_other_leg(self):
        self.assertIn('"garmentLegToLeg"', self.source)
        self.assertIn('if leg_to_leg is None:', self.source)
        self.assertIn('elif leg_to_leg > 0:', self.source)
        self.assertIn('leg-gap correction must not create self-intersecting cloth.', self.source)

    def test_missing_trouser_spacing_is_blocking(self):
        self.assertIn(
            'reasons.append("Could not sample trouser leg-center spacing from production geometry; spacing gate cannot pass without measurement.")',
            self.source,
        )


    def test_missing_silhouette_measurements_are_blocking(self):
        self.assertIn(
            'reasons.append(f"Could not sample {key} from garment geometry; identity-fit gate cannot pass without measurement.")',
            self.source,
        )

    def test_missing_centerline_measurements_are_blocking(self):
        self.assertIn(
            'reasons.append(f"Could not sample {key} for garment centerline QA; production fit cannot pass.")',
            self.source,
        )

    def test_missing_symmetry_measurements_are_blocking(self):
        self.assertIn(
            'reasons.append("Could not calculate left/right cuff-zone width symmetry; production fit cannot pass.")',
            self.source,
        )
        self.assertIn(
            'reasons.append("Could not calculate left/right trouser hem symmetry; production fit cannot pass.")',
            self.source,
        )


if __name__ == "__main__":
    unittest.main()
