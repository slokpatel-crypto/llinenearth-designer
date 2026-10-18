"""Unit tests for deliberately unapproved cloth-only sleeve stance experiment."""
import importlib.util
import pathlib
import unittest

root = pathlib.Path(__file__).resolve().parents[2]
path = root / "scripts/blender/sleeve_stance_math.py"
spec = importlib.util.spec_from_file_location("sleeve_stance_math", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SleeveStanceTests(unittest.TestCase):
    def test_mirrored_cuffs_move_inward_not_outward(self):
        left = module.candidate_sleeve_inboard_mm("ShirtSleeveLFabric", 0.54, 20)
        right = module.candidate_sleeve_inboard_mm("ShirtSleeveRFabric", 0.54, 20)
        self.assertEqual(left, 20)
        self.assertEqual(right, -20)

    def test_shoulder_reference_remains_exactly_unmoved(self):
        for p in (0.79, 0.82, 0.95, 1.0):
            self.assertEqual(module.candidate_sleeve_inboard_mm("ShirtSleeveLFabric", p, 20), 0)

    def test_smooth_vertical_fade_is_bounded(self):
        levels = [module.candidate_sleeve_inboard_mm("ShirtSleeveLFabric", p / 100, 22)
                  for p in range(61, 80)]
        self.assertEqual(levels[0], 22)
        self.assertEqual(levels[-1], 0)
        self.assertTrue(all(a >= b for a, b in zip(levels, levels[1:])))
        self.assertTrue(all(0 <= x <= 22 for x in levels))
        self.assertAlmostEqual(module.candidate_sleeve_inboard_mm("ShirtSleeveLFabric", .70, 22), 11)

    def test_zero_option_preserves_original_cloth(self):
        self.assertEqual(module.candidate_sleeve_inboard_mm("ShirtSleeveRFabric", 0.54, 0), 0)

    def test_unsafe_requests_fail_closed(self):
        for panel, ratio, shift in [
            ("ShirtTorsoFabric", 0.54, 20),
            ("ShirtSleeveLFabric", float("nan"), 20),
            ("ShirtSleeveLFabric", .54, 23),
            ("ShirtSleeveLFabric", .54, -1),
            ("ShirtSleeveRFabric", .54, True),
            ("ShirtSleeveRFabric", 1.1, 20),
        ]:
            with self.subTest(panel=panel, ratio=ratio, shift=shift):
                with self.assertRaises(ValueError):
                    module.candidate_sleeve_inboard_mm(panel, ratio, shift)


if __name__ == "__main__":
    unittest.main()
