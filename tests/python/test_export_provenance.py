"""Test the actual Blender export provenance function without a Blender runtime.

Extract the function and constant from the source AST, so invalid supplier
calendar receipts are tested in regular CI while body/mesh QA stays Blender-only.
"""
import ast
from datetime import date
from pathlib import Path
import re
import unittest

EXPORTER = Path(__file__).resolve().parents[2] / "scripts/blender/export-linen-earth-officewear.py"
tree = ast.parse(EXPORTER.read_text(encoding="utf-8"), filename=str(EXPORTER))
source_key_node = next(
    node for node in tree.body
    if isinstance(node, ast.Assign)
    and any(isinstance(target, ast.Name) and target.id == "SOURCE_KEYS" for target in node.targets)
)
source_keys = ast.literal_eval(source_key_node.value)
function = next(
    node for node in tree.body
    if isinstance(node, ast.FunctionDef) and node.name == "scene_source_provenance"
)
namespace = {"SOURCE_KEYS": source_keys, "re": re, "date": date}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(EXPORTER), "exec"), namespace)
validate_source = namespace["scene_source_provenance"]


def verified_scene(value):
    return {
        source_keys["name"]: "Blender Human Base Meshes",
        source_keys["license"]: "CC0",
        source_keys["verifiedAt"]: value,
    }


class BlenderExportProvenanceTests(unittest.TestCase):
    def test_valid_real_calendar_date(self):
        result = validate_source(verified_scene("2024-02-29"))
        self.assertEqual(result["verifiedAt"], "2024-02-29")
        self.assertEqual(result["license"], "CC0")

    def test_impossible_and_malformed_dates_rejected(self):
        for verified_at in (
            "2026-02-29", "2026-02-31", "2026-04-31",
            "2026-13-01", "2026-00-01", "2026-1-01", "not verified",
        ):
            with self.subTest(verified_at=verified_at):
                with self.assertRaises(RuntimeError):
                    validate_source(verified_scene(verified_at))

    def test_missing_required_provenance_rejected(self):
        scene = verified_scene("2026-10-18")
        del scene[source_keys["license"]]
        with self.assertRaisesRegex(RuntimeError, "Missing"):
            validate_source(scene)


if __name__ == "__main__":
    unittest.main()
