"""Native evaluated body height verification (synthetic QA meshes only).

blender --background --factory-startup --python-exit-code 1 \
  --python tests/blender/test_scene_height.py
"""

import math
from pathlib import Path
import runpy
import unittest

import bpy

ROOT = Path(__file__).resolve().parents[2]
PREFLIGHT = runpy.run_path(str(ROOT / "scripts/blender/preflight-linen-earth-officewear.py"))
EXPORTER = runpy.run_path(str(ROOT / "scripts/blender/export-linen-earth-officewear.py"))
preflight_height = PREFLIGHT["object_height"]
export_height = EXPORTER["object_height"]


class EvaluatedBodyHeightTests(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def body(self):
        # A deliberately small synthetic tetrahedron; never the production model.
        mesh = bpy.data.meshes.new("synthetic body fixture")
        mesh.from_pydata(
            [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1.727)],
            [], [(0, 1, 2), (0, 1, 3), (1, 2, 3), (2, 0, 3)]
        )
        mesh.update()
        body = bpy.data.objects.new("Body", mesh)
        bpy.context.scene.collection.objects.link(body)
        bpy.context.view_layer.update()
        return body

    def assert_shared(self, body, expected):
        bpy.context.view_layer.update()
        self.assertAlmostEqual(preflight_height(body), expected, delta=1e-5)
        self.assertAlmostEqual(export_height(body), expected, delta=1e-5)

    def test_reference_height_and_world_translation(self):
        body = self.body()
        self.assert_shared(body, 1.727)
        body.location = (3, -4, 7)
        self.assert_shared(body, 1.727)

    def test_modifier_generated_geometry_is_measured_in_both_gates(self):
        body = self.body()
        modifier = body.modifiers.new("exported height extension", "ARRAY")
        modifier.count = 2
        modifier.use_relative_offset = False
        modifier.use_constant_offset = True
        modifier.constant_offset_displace = (0, 0, 0.21)
        bpy.context.view_layer.update()
        self.assertAlmostEqual(body.dimensions.z, 1.727, delta=1e-5,
            msg="Raw Blender object bounds should remain unchanged in this fixture")
        self.assert_shared(body, 1.937)
        self.assertGreater(abs(preflight_height(body) - 1.727), PREFLIGHT["HEIGHT_TOLERANCE_M"])
        body.modifiers.remove(modifier)
        self.assert_shared(body, 1.727)

    def test_evaluated_constraint_transform_not_only_raw_object_transform(self):
        body = self.body()
        target = bpy.data.objects.new("scale target", None)
        bpy.context.scene.collection.objects.link(target)
        target.scale = (1, 1, 1.5)
        constraint = body.constraints.new("COPY_SCALE")
        constraint.target = target
        bpy.context.view_layer.update()
        self.assert_shared(body, 2.5905)
        self.assertAlmostEqual(body.scale.z, 1.0)

    def test_nonfinite_mesh_vertex_fails_closed(self):
        body = self.body()
        body.data.vertices[0].co.z = math.nan
        body.data.update()
        bpy.context.view_layer.update()
        self.assertTrue(math.isnan(preflight_height(body)))
        self.assertTrue(math.isnan(export_height(body)))

    def test_empty_mesh_cannot_pass_height_gate(self):
        mesh = bpy.data.meshes.new("empty fixture")
        body = bpy.data.objects.new("Body", mesh)
        bpy.context.scene.collection.objects.link(body)
        bpy.context.view_layer.update()
        self.assertTrue(math.isnan(preflight_height(body)))
        self.assertTrue(math.isnan(export_height(body)))

    def test_evaluated_reads_do_not_modify_source_or_leak_meshes(self):
        body = self.body()
        vertices = [tuple(v.co) for v in body.data.vertices]
        counts = (len(bpy.data.meshes), len(bpy.data.objects))
        for _ in range(20):
            self.assert_shared(body, 1.727)
        self.assertEqual((len(bpy.data.meshes), len(bpy.data.objects)), counts)
        self.assertEqual([tuple(v.co) for v in body.data.vertices], vertices)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(EvaluatedBodyHeightTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
