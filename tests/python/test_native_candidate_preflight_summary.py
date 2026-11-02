"""Synthetic adversarial contracts for the REAL native Blender candidate report reader."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[2] / "scripts/blender/summarize-native-candidate-preflight.py"
spec = importlib.util.spec_from_file_location("native_candidate_report", source)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def example():
    return {
        "gate": "linen-earth-officewear-scene-preflight-v1",
        "ready": False,
        "reasons": ["Sleeve spacing exceeds 536 mm", "UV chart requires authored seams"],
        "modelIdentity": {"id": "linen-earth-studio-model-v1", "locked": True},
        "bodyHeightMm": 1727,
        "requiredGarmentObjects": list(mod.GARMENT_OBJECTS),
        "objects": {
            name: {"vertices": 500, "triangles": 800, "uvLayers": 1}
            for name in mod.GARMENT_OBJECTS
        },
        "identityFitMeasurementsMm": {"sleeveCenterSpacingMm": 563.54},
        "boundaryIntersections": {"bodyShirtTorso": 0},
    }


class NativeCandidateSummary(unittest.TestCase):
    def test_valid_rejected_candidate_has_no_production_approval(self):
        data = mod.summarize("Blender 4.5.14\n" + json.dumps(example()) + "\nBlender quit\n", 1)
        self.assertFalse(data["preflightReady"])
        self.assertFalse(data["productionApproved"])
        self.assertFalse(data["photographicIdentityApproved"])
        self.assertEqual(data["rejectionReasonCount"], 2)
        self.assertEqual(len(data["meshSummary"]), 6)
        self.assertEqual(data["identityFitMeasurementsMm"]["sleeveCenterSpacingMm"], 563.54)

    def test_crashes_and_success_exits_do_not_fake_a_rejection(self):
        for code in (0, -9, 2, 139):
            with self.subTest(code=code), self.assertRaises(RuntimeError):
                mod.summarize(json.dumps(example()), code)
        with self.assertRaises(RuntimeError):
            mod.summarize("Blender fatal stack trace", 1)

    def test_unlocked_or_missing_body_source_fails_closed(self):
        for key, value in (
            ("bodyHeightMm", 1600),
            ("bodyHeightMm", float("nan")),
            ("requiredGarmentObjects", []),
            ("objects", {}),
            ("ready", True),
            ("reasons", []),
        ):
            value_obj = example()
            value_obj[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                mod.summarize(json.dumps(value_obj), 1)
        value_obj = example()
        value_obj["modelIdentity"]["locked"] = False
        with self.assertRaises(RuntimeError):
            mod.summarize(json.dumps(value_obj), 1)

    def test_missing_garment_geometry_is_not_valid_evidence(self):
        for changed_key, changed_value in (("triangles", 0), ("uvLayers", 0)):
            value = example()
            value["objects"]["ShirtTorsoFabric"][changed_key] = changed_value
            with self.subTest(key=changed_key), self.assertRaises(RuntimeError):
                mod.summarize(json.dumps(value), 1)


if __name__ == "__main__":
    unittest.main()
