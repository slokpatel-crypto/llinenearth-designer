"""Offline negative and positive tests for independent source sleeve/torso BVH gate."""
import importlib.util
import json
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[2] / "scripts/blender/sleeve_torso_gate.py"
spec = importlib.util.spec_from_file_location("sleeve_torso_gate", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def receipt(baseline=(4, 5), selected=(3, 5), **changes):
    data = {
        "nativeWorldSpaceCollisionFree": True,
        "shirtTorsoContactNotWorsened": True,
        "shirtTorsoPairsAtOriginal": list(baseline),
        "shirtTorsoPairsAtSelected": list(selected),
        "productionApproved": False,
        "tailorSleeveApproved": False,
    }
    data.update(changes)
    return json.dumps(data)


class SleeveTorsoGateTests(unittest.TestCase):
    def test_genuine_sewn_armhole_baseline_is_not_automatically_zero(self):
        raw = receipt()
        result = module.validate_sleeve_torso_receipts([raw, raw], (3, 5))
        self.assertTrue(result["independentNativeBvhMatchesReceipt"])
        self.assertFalse(result["productionApproved"])
        self.assertFalse(result["tailorSeamApproved"])
        self.assertEqual(result["shirtTorsoPairsAtOriginal"], [4, 5])

    def test_zero_contact_baseline_is_valid(self):
        raw = receipt((0, 0), (0, 0))
        self.assertEqual(
            module.validate_sleeve_torso_receipts([raw, raw], [0, 0])[
                "shirtTorsoPairsAtSelected"
            ], [0, 0]
        )

    def test_reject_contact_growth_and_stale_independent_mesh(self):
        for raw, measured in (
            (receipt((4, 5), (4, 6)), (4, 6)),
            (receipt((4, 5), (3, 5)), (4, 5)),
            (receipt((4, 5), (3, 5)), (3, 4)),
        ):
            with self.subTest(raw=raw, measured=measured), self.assertRaises(ValueError):
                module.validate_sleeve_torso_receipts([raw, raw], measured)

    def test_missing_and_disagreeing_sleeve_receipts_fail_closed(self):
        valid = receipt()
        for receipts in (
            [], [valid], [valid, None], [valid, ""],
            [valid, receipt((4, 6), (3, 5))], ["{}", "{}"],
            ["[]", "[]"], [valid, valid, valid],
        ):
            with self.subTest(receipts=receipts), self.assertRaises(ValueError):
                module.validate_sleeve_torso_receipts(receipts, (3, 5))

    def test_reject_coerced_counts_flags_and_bad_native_values(self):
        bad = (
            {"shirtTorsoPairsAtOriginal": [True, 5]},
            {"shirtTorsoPairsAtSelected": [3.0, 5]},
            {"shirtTorsoPairsAtSelected": ["3", 5]},
            {"shirtTorsoPairsAtSelected": [-1, 5]},
            {"shirtTorsoPairsAtSelected": [3]},
            {"nativeWorldSpaceCollisionFree": 1},
            {"shirtTorsoContactNotWorsened": "true"},
        )
        for changed in bad:
            raw = receipt(**changed)
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                module.validate_sleeve_torso_receipts([raw, raw], (3, 5))
        for measured in ((3, True), (3.0, 5), (3, -1), (3,), None):
            with self.subTest(measured=measured), self.assertRaises(ValueError):
                raw = receipt()
                module.validate_sleeve_torso_receipts([raw, raw], measured)

    def test_reject_duplicate_json_keys_and_nonfinite_constants(self):
        for raw in (
            '{"nativeWorldSpaceCollisionFree":true,"nativeWorldSpaceCollisionFree":true}',
            '{"nativeWorldSpaceCollisionFree":NaN}',
            '{"nativeWorldSpaceCollisionFree":Infinity}',
            '{"nativeWorldSpaceCollisionFree":-Infinity}',
            "{not-json",
        ):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                module.validate_sleeve_torso_receipts([raw, raw], (0, 0))


if __name__ == "__main__":
    unittest.main()
