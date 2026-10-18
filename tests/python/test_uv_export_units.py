"""Pure regressions for optional explicit physical UV unit provenance."""
import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[2] / "scripts/blender/uv_export_units.py"
spec = importlib.util.spec_from_file_location("uv_export_units", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UvExportUnitsTests(unittest.TestCase):
    def test_legacy_missing_units_keeps_legacy_manifest(self):
        self.assertIsNone(module.resolve_panel_uv_units([None] * 6))

    def test_explicit_metre_units_and_normalized_units_are_distinct(self):
        self.assertEqual(module.resolve_panel_uv_units(["mesh_metres"] * 6), "mesh_metres")
        self.assertEqual(module.resolve_panel_uv_units(["panel_normalized"] * 6), "panel_normalized")

    def test_mixed_partial_and_unknown_provenance_fail_closed(self):
        for units in (
            ["mesh_metres"] * 5 + [None],
            ["mesh_metres"] * 3 + ["panel_normalized"] * 3,
            ["texels"] * 6,
            [""] * 6,
            [" "] * 6,
            [False] * 6,
            ["mesh_metres"] * 5,
            [],
        ):
            with self.subTest(units=units):
                with self.assertRaises(ValueError):
                    module.resolve_panel_uv_units(units)


if __name__ == "__main__":
    unittest.main()
