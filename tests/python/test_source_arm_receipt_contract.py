"""Catch loss of native candidate report output path during future 3D edits.

The native scene script depends on bpy and is normally executed in Actions.
This AST contract checks without Blender that 'receipt' remains the Path
representing --report, not reused for a scan observation dictionary.
"""
import ast
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[2]/"scripts/blender/experiments/construct-authored-shirt-pattern.py"


class SourceArmReceiptContractTests(unittest.TestCase):
    def test_receipt_path_is_initialized_only_once(self):
        tree=ast.parse(SCRIPT.read_text(encoding="utf-8"))
        main=next(node for node in tree.body
                  if isinstance(node,ast.FunctionDef) and node.name=="main")
        writes=[]
        for node in ast.walk(main):
            if isinstance(node,ast.Assign) and any(
                isinstance(target,ast.Name) and target.id=="receipt"
                for target in node.targets
            ):
                writes.append(node)
            elif isinstance(node,ast.AnnAssign) and isinstance(node.target,ast.Name) and node.target.id=="receipt":
                writes.append(node)
        self.assertEqual(len(writes),1,"Native report Path must never be shadowed by body scan receipts")
        self.assertIsInstance(writes[0].value,ast.Call)
        # The real source uses Path(args.report).resolve(): preserve its
        # canonical absolute output path rather than asserting a literal
        # un-resolved Path constructor shape.
        outer=writes[0].value
        self.assertIsInstance(outer.func,ast.Attribute)
        self.assertEqual(outer.func.attr,"resolve")
        inner=outer.func.value
        self.assertIsInstance(inner,ast.Call)
        self.assertIsInstance(inner.func,ast.Name)
        self.assertEqual(inner.func.id,"Path")

    def test_native_scan_observation_uses_independent_variable(self):
        code=SCRIPT.read_text(encoding="utf-8")
        self.assertIn("arm_observation=sample_scanned_arm_path(",code)
        self.assertIn('arm_centerlines[sleeve]=arm_observation["centerline"]',code)
        self.assertIn("receipt.write_text(",code)


if __name__=="__main__":
    unittest.main()
