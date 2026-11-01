"""The production exporter must not write GLB before source owner review gate."""
import ast
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[2]/"scripts/blender/export-linen-earth-officewear.py"


class ExportPhotoSourceContractTest(unittest.TestCase):
    def test_preflight_owner_review_precedes_any_glb_write(self):
        tree=ast.parse(SCRIPT.read_text(encoding="utf-8"))
        main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="main")
        src=ast.get_source_segment(SCRIPT.read_text(encoding="utf-8"),main)
        owner=src.index("verify_external_owner_review_packet(")
        native=src.index("run_scene_preflight()")
        exported=src.index("export_glb(collection, args.output)")
        self.assertLess(owner,native)
        self.assertLess(native,exported)
        self.assertIn("if panel_spec:",src)
        self.assertIn("LINEN_OWNER_MODEL_REVIEW_RECEIPT",src)
        self.assertIn("scene_blend_path=bpy.data.filepath",src)
        self.assertIn("raise RuntimeError(\"Production source/photo identity review gate blocked export:",src)

    def test_nonproduction_export_still_exposes_existing_native_gate(self):
        tree=ast.parse(SCRIPT.read_text(encoding="utf-8"))
        self.assertTrue(any(
            isinstance(n,ast.FunctionDef) and n.name=="run_scene_preflight"
            for n in tree.body
        ))


if __name__=="__main__":
    unittest.main()
