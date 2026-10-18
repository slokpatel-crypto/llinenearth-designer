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

    def test_body_side_band_uses_actual_immutable_xyz_not_photo_assumption(self):
        source = [
            (-.30, 0, .90), (-.29, 0, .91), (-.22, 0, .93),
            (-.23, 0, .90), (.22, 0, .9), (.23, 0, .93),
            (.29, 0, .91), (.30, 0, .9),
            (0.0, 0, .91), (-.48, 0, 1.2), (.44, 0, .3),
        ]
        original = tuple(source)
        left = module.source_arm_band_geometry(
            source, guide_z_m=.9, side=-1
        )
        right = module.source_arm_band_geometry(
            source, guide_z_m=.9, side=1
        )
        self.assertEqual(left["sourceSideBandCentreXMm"], -260)
        self.assertEqual(right["sourceSideBandCentreXMm"], 260)
        self.assertEqual(left["sourceSideBandWidthMm"], 80)
        self.assertEqual(right["sourceSideBandWidthMm"], 80)
        self.assertEqual(left["sampledSourceVertexCount"], 4)
        self.assertFalse(left["anatomicalJointCentreMeasured"])
        self.assertFalse(left["photoPoseApproved"])
        self.assertFalse(right["productionApproved"])
        self.assertEqual(tuple(source), original)

    def test_body_side_band_fails_closed_for_unmeasurable_or_invalid_geometry(self):
        self.assertIsNone(module.source_arm_band_geometry(
            [(0, 0, .9)]*8, guide_z_m=.9, side=-1
        ))
        for kwargs in (
            {"side": 0}, {"side": True}, {"side": 1, "guide_z_m": float("nan")},
            {"side": 1, "min_lateral_offset_m": 0},
            {"side": -1, "band_half_height_m": .13},
        ):
            params = {"guide_z_m": .9, "side": -1}
            params.update(kwargs)
            with self.subTest(params=params), self.assertRaises(ValueError):
                module.source_arm_band_geometry(
                    [(-.2, 0, .9)]*4, **params
                )
        for point in ((-0.2, 0), (-.2, True, .9),
                      (-.2, 0, float("inf")), ("-.2", 0, .9)):
            with self.subTest(point=point), self.assertRaises(ValueError):
                module.source_arm_band_geometry(
                    [point]*4, guide_z_m=.9, side=-1
                )

    def test_current_sleeve_gap_cannot_reach_lock_with_remaining_cap(self):
        # Source-locked current accepted result is 563.4 mm after 11 mm of
        # the existing 22-mm per-side contour; an ideal full additional
        # 11 mm/side would still be 541.4 mm (>500+36).
        result = module.optimistic_sleeve_spacing_budget(563.4, 11)
        self.assertEqual(result["remainingContourBudgetMmPerSleeve"], 11)
        self.assertEqual(result["optimisticMinimumSpacingMm"], 541.4)
        self.assertEqual(result["requiredExtraMmPerSleeveAtFullEffect"], 13.7)
        self.assertFalse(result["guideNumericallyReachableWithinExistingContourCap"])
        self.assertFalse(result["bodyContactOrFitApproved"])
        self.assertFalse(result["productionApproved"])

    def test_sleeve_budget_never_equates_numeric_reach_to_real_fit(self):
        result = module.optimistic_sleeve_spacing_budget(542, 11)
        self.assertTrue(result["guideNumericallyReachableWithinExistingContourCap"])
        self.assertFalse(result["bodyContactOrFitApproved"])
        self.assertFalse(result["productionApproved"])
        result = module.optimistic_sleeve_spacing_budget(450, 11)
        self.assertFalse(result["guideNumericallyReachableWithinExistingContourCap"])
        for spacing, used, target, tolerance in (
            (float("nan"), 0, 500, 36), (563, True, 500, 36),
            (563, 23, 500, 36), (563, -1, 500, 36),
            (563, 11, -1, 36), (563, 11, 500, 600),
            ("563", 11, 500, 36),
        ):
            with self.subTest(spacing=spacing, used=used), self.assertRaises(ValueError):
                module.optimistic_sleeve_spacing_budget(
                    spacing, used, target_mm=target, tolerance_mm=tolerance
                )

    def test_sleeve_refinement_probes_only_between_native_contact_results(self):
        probes = module.bounded_sleeve_cuff_refinement_trials(12.0, 11.0)
        self.assertEqual(probes, (11.75, 11.5, 11.25))
        self.assertTrue(all(11 < v < 12 for v in probes))
        self.assertEqual(module.bounded_sleeve_cuff_refinement_trials(12, 11, subdivisions=2),
                         (11.5,))
        for unsafe, safe in ((11, 11), (10, 11), (12.1, 11), (23, 22),
                             (1, -1), (float("nan"), 0), ("12", 11),
                             (12, True), (11.000000001, 11)):
            with self.subTest(unsafe=unsafe, safe=safe), self.assertRaises(ValueError):
                module.bounded_sleeve_cuff_refinement_trials(unsafe, safe)
        for divisions in (1, 9, 2.5, True):
            with self.subTest(divisions=divisions), self.assertRaises(ValueError):
                module.bounded_sleeve_cuff_refinement_trials(12, 11, subdivisions=divisions)

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
