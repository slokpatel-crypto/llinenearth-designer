"""Standalone tests: can run in CI without Blender or textile measurements."""
import importlib.util
import math
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "scripts" / "blender" / "drape_preview_math.py"
spec = importlib.util.spec_from_file_location("linen_earth_drape_preview_math", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CandidateDrapeProfileTests(unittest.TestCase):
    def test_all_six_panels_are_bounded_and_non_negative(self):
        for panel in module.GARMENT_PANELS:
            for x in range(-20, 21):
                for z in range(21):
                    amount = module.candidate_drape_offset_mm(panel, x/20, z/20, 4)
                    self.assertTrue(math.isfinite(amount))
                    self.assertGreaterEqual(amount, 0)
                    self.assertLessEqual(amount, 4)

    def test_open_boundaries_remain_unchanged(self):
        for panel in module.GARMENT_PANELS:
            for x in (-1, -0.6, 0, 0.6, 1):
                self.assertEqual(module.candidate_drape_offset_mm(panel, x, 0), 0)
                self.assertEqual(module.candidate_drape_offset_mm(panel, x, 1), 0)
            for z in (0, 0.2, 0.5, 0.8, 1):
                self.assertEqual(module.candidate_drape_offset_mm(panel, -1, z), 0)
                self.assertEqual(module.candidate_drape_offset_mm(panel, 1, z), 0)

    def test_clean_shell_option_really_disables_preview_folds(self):
        self.assertEqual(module.candidate_drape_offset_mm("ShirtTorsoFabric", 0, .5, 0), 0)

    def test_invalid_strength_and_inputs_fail_closed(self):
        for value in (-1, 6.1, float("inf"), float("nan")):
            with self.assertRaises(ValueError):
                module.candidate_drape_offset_mm("TrouserLegLFabric", 0, .5, value)
        with self.assertRaises(ValueError):
            module.candidate_drape_offset_mm("Other", 0, 0.5)
        with self.assertRaises(ValueError):
            module.candidate_drape_offset_mm("ShirtTorsoFabric", 1.2, .5)

    def test_malformed_operator_values_fail_closed(self):
        for field in range(3):
            for invalid in ("3", "", None, True, False, [], {}, 1 + 2j):
                values = [0.2, 0.5, 3.0]
                values[field] = invalid
                with self.subTest(field=field, invalid=repr(invalid)):
                    with self.assertRaises(ValueError):
                        module.candidate_drape_offset_mm("ShirtTorsoFabric", *values)

    def test_mirrored_pairs_use_identical_candidate_relief(self):
        for a,b in (("ShirtSleeveLFabric","ShirtSleeveRFabric"),("TrouserLegLFabric","TrouserLegRFabric")):
            for x in (-0.8,-0.2,0.0,0.4,0.8):
                self.assertAlmostEqual(
                    module.candidate_drape_offset_mm(a,x,.45),
                    module.candidate_drape_offset_mm(b,x,.45)
                )


if __name__ == "__main__":
    unittest.main()
