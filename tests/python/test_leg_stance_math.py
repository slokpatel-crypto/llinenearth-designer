"""Pure regression for the unapproved 7mm garment-only leg gap experiment."""
from pathlib import Path
import importlib.util
import unittest

path = Path(__file__).resolve().parents[2] / "scripts/blender/leg_stance_math.py"
spec = importlib.util.spec_from_file_location("leg_stance_math", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LegStanceTests(unittest.TestCase):
    def test_gap_reduction_is_symmetrical_and_within_budget(self):
        self.assertEqual(module.candidate_leg_inboard_mm("TrouserLegLFabric", 0.37, 7), 7)
        self.assertEqual(module.candidate_leg_inboard_mm("TrouserLegRFabric", 0.37, 7), -7)

    def test_source_hem_and_waist_guides_are_untouched(self):
        for ratio in (0, 0.07, 0.10, 0.52, 0.535, 1):
            self.assertEqual(module.candidate_leg_inboard_mm("TrouserLegLFabric", ratio, 7), 0)

    def test_inward_contour_fades_without_discontinuous_changes(self):
        z = [k / 1000 for k in range(100, 521)]
        shifts = [module.candidate_leg_inboard_mm("TrouserLegLFabric", v, 8)
                  for v in z]
        self.assertTrue(all(0 <= x <= 8 for x in shifts))
        self.assertAlmostEqual(shifts[0], 0)
        self.assertAlmostEqual(shifts[-1], 0)
        self.assertLess(max(abs(a-b) for a,b in zip(shifts, shifts[1:])), 0.5)

    def test_empty_motion_preserves_geometry(self):
        self.assertEqual(module.candidate_leg_inboard_mm("TrouserLegLFabric", 0.37, 0), 0)

    def test_invalid_settings_fail_closed(self):
        for panel, ratio, delta in [
            ("ShirtSleeveLFabric", 0.37, 7),
            ("TrouserLegLFabric", 1.1, 7),
            ("TrouserLegLFabric", 0.37, 9),
            ("TrouserLegRFabric", 0.37, -1),
            ("TrouserLegLFabric", 0.37, float("nan")),
            ("TrouserLegLFabric", True, 7),
        ]:
            with self.subTest(panel=panel, ratio=ratio, delta=delta):
                with self.assertRaises(ValueError):
                    module.candidate_leg_inboard_mm(panel, ratio, delta)


if __name__ == "__main__":
    unittest.main()
