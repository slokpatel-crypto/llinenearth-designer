"""Pure Python safety regressions for collision-first, source-locked leg gap."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts/blender"))
from leg_gap_safety import bounded_leg_gap_trials


class LegGapRollbackTests(unittest.TestCase):
    def test_trials_only_reduce_requested_fit_shift(self):
        self.assertEqual(bounded_leg_gap_trials(3.0),
                         (3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0.0))

    def test_fractional_requested_shift_preserved_before_rollback(self):
        trials = bounded_leg_gap_trials(1.3)
        self.assertEqual(trials, (1.3, 0.8, 0.3, 0.0))
        self.assertTrue(all(a > b for a, b in zip(trials, trials[1:])))

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
