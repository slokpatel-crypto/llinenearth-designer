"""Exercise the actual preflight contact block without requiring Blender.

Geometry is stubbed here; native Blender remains required to measure contact.
"""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).resolve().parents[2] / 'scripts/blender/preflight-linen-earth-officewear.py'
PANELS = ('ShirtTorsoFabric', 'ShirtSleeveLFabric', 'ShirtSleeveRFabric',
          'TrouserWaistFabric', 'TrouserLegLFabric', 'TrouserLegRFabric')


class MissingContactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        main = next(n for n in ast.parse(SOURCE.read_text()).body
                    if isinstance(n, ast.FunctionDef) and n.name == 'main')
        start = next(i for i, n in enumerate(main.body)
                     if isinstance(n, ast.Assign) and any(
                         isinstance(t, ast.Name) and t.id == 'boundary_intersections'
                         for t in n.targets))
        cls.block = compile(ast.Module(body=main.body[start:start+2], type_ignores=[]),
                            str(SOURCE), 'exec')

    def run_gate(self, missing=None, tuck=0):
        def count(left, right):
            if right == missing or (missing == 'tuck' and left == 'ShirtTorsoFabric'):
                return None
            return tuck if left == 'ShirtTorsoFabric' else 0
        env = dict(body='Body', reasons=[], warnings=[],
                   bpy=SimpleNamespace(data=SimpleNamespace(objects={p: p for p in PANELS})),
                   intersection_pair_count=count)
        exec(self.block, env)
        return env

    def test_each_unmeasured_body_boundary_blocks(self):
        for panel in PANELS:
            with self.subTest(panel=panel):
                result = self.run_gate(missing=panel)
                self.assertTrue(result['reasons'])
                self.assertTrue(any('Could not evaluate' in r for r in result['reasons']))

    def test_unmeasured_tuck_blocks(self):
        self.assertTrue(any('tucked shirt/trouser' in r
                            for r in self.run_gate(missing='tuck')['reasons']))

    def test_measured_zero_is_valid(self):
        result = self.run_gate()
        self.assertEqual(result['reasons'], [])
        self.assertEqual(len(result['boundary_intersections']), 8)
        self.assertTrue(all(v == 0 for v in result['boundary_intersections'].values()))

    def test_tuck_tolerance_is_preserved(self):
        self.assertEqual(self.run_gate(tuck=120)['reasons'], [])
        self.assertTrue(self.run_gate(tuck=121)['reasons'])


if __name__ == '__main__':
    unittest.main()
