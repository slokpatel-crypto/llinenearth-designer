"""Pure Python safety regressions for collision-first, source-locked leg gap."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts/blender"))
from leg_gap_safety import bounded_leg_gap_trials, bounded_leg_gap_refinement_trials


class LegGapRollbackTests(unittest.TestCase):
    def test_trials_only_reduce_requested_fit_shift(self):
        self.assertEqual(bounded_leg_gap_trials(3.0),
                         (3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0.0))

    def test_fractional_requested_shift_preserved_before_rollback(self):
        trials = bounded_leg_gap_trials(1.3)
        self.assertEqual(trials, (1.3, 0.8, 0.3, 0.0))
        self.assertTrue(all(a > b for a, b in zip(trials, trials[1:])))

    def test_safe_submillimetre_refinement_never_crosses_rejected_contact(self):
        candidates = bounded_leg_gap_refinement_trials(3.5, 3.0)
        self.assertEqual(candidates, (3.375, 3.25, 3.125))
        self.assertTrue(all(3.0 < p < 3.5 for p in candidates))
        self.assertEqual(bounded_leg_gap_refinement_trials(3.5, 3.0, subdivisions=2),
                         (3.25,))

    def test_refinement_refuses_invalid_contact_brackets(self):
        for unsafe, safe in (
            (3, 3), (2.5, 3), (8.1, 8), (1.5, 0), (-1, -2),
            (float("nan"), 1), (2, float("inf")), ("3.5", 3), (True, 0),
        ):
            with self.subTest(unsafe=unsafe, safe=safe), self.assertRaises(ValueError):
                bounded_leg_gap_refinement_trials(unsafe, safe)
        for divisions in (1, 9, 2.5, True, "4"):
            with self.subTest(divisions=divisions), self.assertRaises(ValueError):
                bounded_leg_gap_refinement_trials(3.5, 3, subdivisions=divisions)

    def test_refinement_rejects_subprecision_and_nonunique_rounded_contacts(self):
        # Each native BVH trial must be a genuinely distinct point INSIDE
        # the independently measured unsafe/safe contact bracket.
        for unsafe, safe, subdivisions in (
            (3.00000001, 3.0, 4),
            (3.000009, 3.0, 8),
        ):
            with self.subTest(unsafe=unsafe, safe=safe, subdivisions=subdivisions):
                with self.assertRaises(ValueError):
                    bounded_leg_gap_refinement_trials(unsafe, safe, subdivisions=subdivisions)
        small = bounded_leg_gap_refinement_trials(3.000011, 3.0, subdivisions=8)
        self.assertTrue(all(3.0 < v < 3.000011 for v in small))
        values = bounded_leg_gap_refinement_trials(3.5, 3.0, subdivisions=8)
        self.assertEqual(len(values), len(set(values)))
        self.assertTrue(all(3.0 < v < 3.5 for v in values))

    def test_zero_is_legal_and_does_not_move_body(self):
        self.assertEqual(bounded_leg_gap_trials(0), (0.0,))

    def test_out_of_range_and_nonfinite_fail_closed(self):
        for value in (-0.1, 8.01, float("nan"), float("inf"), None, True, "3"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                bounded_leg_gap_trials(value)
        for value in (0, -1, 1.1, False, float("nan")):
            with self.subTest(step=value), self.assertRaises(ValueError):
                bounded_leg_gap_trials(3, step_mm=value)

    def test_never_increase_requested_shift_to_meet_visual_target(self):
        for requested in (0.1, 0.5, 1, 3.01, 8):
            trials = bounded_leg_gap_trials(requested)
            self.assertAlmostEqual(trials[0], requested, delta=1e-5)
            self.assertEqual(trials[-1], 0)
            self.assertLessEqual(len(trials), 18)
            self.assertTrue(all(0 <= trial <= requested for trial in trials))


if __name__ == "__main__":
    unittest.main()
