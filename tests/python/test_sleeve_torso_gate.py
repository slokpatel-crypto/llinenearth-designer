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
        "requestedMmPerSleeve": 22.0,
        "selectedMmPerSleeve": 11.0,
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
            {"selectedMmPerSleeve": 23},
            {"selectedMmPerSleeve": -1},
            {"selectedMmPerSleeve": True},
            {"selectedMmPerSleeve": "11"},
            {"selectedMmPerSleeve": float("nan")},
            {"selectedMmPerSleeve": 12, "requestedMmPerSleeve": 11},
            {"requestedMmPerSleeve": 100},
            {"requestedMmPerSleeve": None},
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


    def test_exterior_cuff_final_mesh_and_original_seam_are_both_bound(self):
        outer = {
            "cuffContourMethod": "original_mesh_outer_perimeter_only_unapproved",
            "nativeWorldSpaceCollisionFree": True,
            "shirtTorsoContactNotWorsened": True,
            "requestedMmPerSleeve": 30.0,
            "selectedMmPerSleeve": 18.0,
            "shirtTorsoPairsAtOriginal": [4, 5],
            "shirtTorsoPairsAtSelected": [3, 5],
            "photoPoseApproved": False,
            "physicalDrapeApproved": False,
            "tailorApproved": False,
            "productionApproved": False,
            "trials": [{
                "requestedOuterContourMmPerSleeve": 18.0,
                "bodyContactPairs": [0, 0],
                "shirtTorsoPairsAtOriginal": [4, 5],
                "shirtTorsoPairsAtTrial": [3, 5],
                "shirtTorsoContactNotWorsened": True,
                "betweenSleevesContactPairs": 0,
                "nativeWorldSpaceCollisionFree": True,
            }],
        }
        raw = json.dumps(outer)
        verified = module.validate_outer_cuff_torso_receipts([raw, raw], [3, 5])
        self.assertEqual(verified["shirtTorsoPairsAtOriginal"], [4, 5])
        self.assertFalse(verified["productionApproved"])
        # First-stage selected torso receipt must match second-stage original,
        # not the current evaluated mesh after the exterior contour.
        first = receipt(baseline=(5, 6), selected=(4, 5))
        self.assertTrue(module.validate_sleeve_torso_receipts(
            [first, first], verified["shirtTorsoPairsAtOriginal"]
        )["independentNativeBvhMatchesReceipt"])
        with self.assertRaises(ValueError):
            module.validate_sleeve_torso_receipts([first, first], [3, 5])

        zero = {**outer, "selectedMmPerSleeve": 0.0,
                "shirtTorsoPairsAtSelected": [4, 5],
                "trials": [{**outer["trials"][0],
                            "requestedOuterContourMmPerSleeve": 0.0,
                            "shirtTorsoPairsAtTrial": [4, 5]}]}
        z = json.dumps(zero)
        self.assertTrue(module.validate_outer_cuff_torso_receipts(
            [z, z], [4, 5]
        )["independentNativeBvhMatchesReceipt"])

    def test_exterior_cuff_rejects_stale_coerced_and_forged_evidence(self):
        base = {
            "cuffContourMethod": "original_mesh_outer_perimeter_only_unapproved",
            "nativeWorldSpaceCollisionFree": True,
            "shirtTorsoContactNotWorsened": True,
            "requestedMmPerSleeve": 30.0,
            "selectedMmPerSleeve": 12.0,
            "shirtTorsoPairsAtOriginal": [4, 5],
            "shirtTorsoPairsAtSelected": [3, 5],
            "photoPoseApproved": False,
            "physicalDrapeApproved": False,
            "tailorApproved": False,
            "productionApproved": False,
            "trials": [{
                "requestedOuterContourMmPerSleeve": 12.0,
                "bodyContactPairs": [0, 0],
                "shirtTorsoPairsAtOriginal": [4, 5],
                "shirtTorsoPairsAtTrial": [3, 5],
                "shirtTorsoContactNotWorsened": True,
                "betweenSleevesContactPairs": 0,
                "nativeWorldSpaceCollisionFree": True,
            }],
        }
        raw = json.dumps(base)
        for pair, measured in (
            ([raw], [3, 5]),
            ([raw, None], [3, 5]),
            ([raw, raw], [4, 5]),
            ([raw, raw], [3, True]),
            ([raw, json.dumps({**base, "selectedMmPerSleeve": 0})], [3, 5]),
        ):
            with self.subTest(pair=pair, measured=measured), self.assertRaises(ValueError):
                module.validate_outer_cuff_torso_receipts(pair, measured)
        mutations = (
            {"selectedMmPerSleeve": True},
            {"selectedMmPerSleeve": "12"},
            {"selectedMmPerSleeve": 36.1},
            {"selectedMmPerSleeve": 31},
            {"requestedMmPerSleeve": float("nan")},
            {"shirtTorsoPairsAtOriginal": [4.0, 5]},
            {"shirtTorsoPairsAtSelected": [5, 5]},
            {"nativeWorldSpaceCollisionFree": 1},
            {"shirtTorsoContactNotWorsened": "true"},
            {"tailorApproved": True},
            {"trials": []},
            {"trials": [{**base["trials"][0], "bodyContactPairs": [1, 0]}]},
            {"trials": [{**base["trials"][0], "shirtTorsoPairsAtTrial": [4, 5]}]},
            {"trials": [{**base["trials"][0], "betweenSleevesContactPairs": True}]},
            {"trials": base["trials"] + base["trials"]},
        )
        for change in mutations:
            raw = json.dumps({**base, **change})
            with self.subTest(change=change), self.assertRaises(ValueError):
                module.validate_outer_cuff_torso_receipts([raw, raw], [3, 5])
        for raw in (
            '{"nativeWorldSpaceCollisionFree":true,"nativeWorldSpaceCollisionFree":true}',
            '{"nativeWorldSpaceCollisionFree":NaN}',
            'not json',
        ):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                module.validate_outer_cuff_torso_receipts([raw, raw], [3, 5])



if __name__ == "__main__":
    unittest.main()
