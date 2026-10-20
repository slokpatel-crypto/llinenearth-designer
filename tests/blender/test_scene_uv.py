"""Native garment texture-coordinate regressions; no cloth calibration claims.

blender --background --factory-startup --python-exit-code 1 \
  --python tests/blender/test_scene_uv.py
"""

from contextlib import redirect_stdout
import io
import json
import math
from pathlib import Path
import runpy
import unittest

import bpy

PREFLIGHT = runpy.run_path(str(
    Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
))
mesh_stats = PREFLIGHT["evaluated_mesh_stats"]


class SceneUvTests(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def garment(self, uv=((0, 0), (1, 0), (0, 1)), quad=False):
        mesh = bpy.data.meshes.new("garment fixture")
        points = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
        faces = [(0, 1, 2)]
        if quad:
            points = [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)]
            faces = [(0, 1, 2, 3)]
        mesh.from_pydata(points, [], faces)
        if uv is not None:
            layer = mesh.uv_layers.new(name="UVMap")
            # Bulk data writes model corrupt attribute buffers directly. RNA
            # element setters clamp infinity to a finite float maximum.
            layer.data.foreach_set("uv", [value for point in uv for value in point])
        mesh.update()
        obj = bpy.data.objects.new("ShirtTorsoFabric", mesh)
        bpy.context.scene.collection.objects.link(obj)
        bpy.context.view_layer.update()
        return obj

    def test_finite_noncollapsed_uvs_are_usable(self):
        result = mesh_stats(self.garment())
        self.assertEqual(result["uvLoops"], 3)
        self.assertEqual(result["nonFiniteVertices"], 0)
        self.assertEqual(result["nonFiniteUvLoops"], 0)
        self.assertEqual(result["collapsedUvTriangles"], 0)

    def test_a_named_but_collapsed_uv_map_is_not_usable(self):
        for uv in (((0, 0), (0, 0), (0, 0)), ((0, 0), (1, 1), (2, 2))):
            with self.subTest(uv=uv):
                result = mesh_stats(self.garment(uv))
                self.assertEqual(result["activeUv"], "UVMap")
                self.assertEqual(result["degenerateFaces"], 0)
                self.assertEqual(result["collapsedUvTriangles"], 1)

    def test_nan_and_infinite_uv_coordinates_are_counted(self):
        for value in (math.nan, math.inf, -math.inf):
            with self.subTest(value=value):
                obj = self.garment(((value, 0), (1, 0), (0, 1)))
                self.assertFalse(math.isfinite(obj.data.uv_layers.active.data[0].uv.x))
                result = mesh_stats(obj)
                self.assertEqual(result["nonFiniteUvLoops"], 1)

    def test_mirroring_and_uv_tiling_remain_supported(self):
        for uv in (((0, 0), (-1, 0), (0, 1)), ((-3, 4), (2, 4), (-3, 7))):
            with self.subTest(uv=uv):
                result = mesh_stats(self.garment(uv))
                self.assertEqual(result["collapsedUvTriangles"], 0)
                self.assertEqual(result["nonFiniteUvLoops"], 0)

    def test_small_nonzero_uv_triangles_do_not_invent_a_density_limit(self):
        result = mesh_stats(self.garment(((0, 0), (1e-10, 0), (0, 1e-10))))
        self.assertEqual(result["collapsedUvTriangles"], 0)
        self.assertEqual(result["nonFiniteUvLoops"], 0)

    def test_every_evaluated_triangle_of_a_quad_is_checked(self):
        result = mesh_stats(self.garment(((0, 0), (1, 0), (2, 0), (3, 0)), quad=True))
        self.assertEqual(result["polygons"], 1)
        self.assertEqual(result["triangles"], 2)
        self.assertEqual(result["uvLoops"], 4)
        self.assertEqual(result["collapsedUvTriangles"], 2)

    def test_modifier_generated_uv_data_is_checked(self):
        obj = self.garment(((0, 0), (0, 0), (0, 0)))
        modifier = obj.modifiers.new("evaluated duplicate fixture", "ARRAY")
        modifier.count = 2
        modifier.use_relative_offset = False
        modifier.use_constant_offset = True
        modifier.constant_offset_displace = (2, 0, 0)
        bpy.context.view_layer.update()
        result = mesh_stats(obj)
        self.assertEqual(result["triangles"], 2)
        self.assertEqual(result["collapsedUvTriangles"], 2)

    def test_valid_active_map_cannot_hide_a_collapsed_first_render_map(self):
        obj = self.garment(((0, 0), (0, 0), (0, 0)))
        valid = obj.data.uv_layers.new(name="valid active map", do_init=False)
        valid.data.foreach_set("uv", [0, 0, 1, 0, 0, 1])
        obj.data.uv_layers.active_index = 1
        obj.data.uv_layers[0].active_render = True
        bpy.context.view_layer.update()
        result = mesh_stats(obj)
        self.assertEqual(result["activeUv"], "valid active map")
        self.assertEqual(result["uvLoops"], 6)
        self.assertEqual(result["collapsedUvTriangles"], 1)
        self.assertEqual(result["uvMaps"][0]["collapsedUvTriangles"], 1)
        self.assertEqual(result["uvMaps"][1]["collapsedUvTriangles"], 0)

    def test_valid_first_map_cannot_hide_a_corrupt_secondary_map(self):
        obj = self.garment()
        bad = obj.data.uv_layers.new(name="corrupt secondary", do_init=False)
        bad.data.foreach_set("uv", [math.inf, 0, 1, 0, 0, 1])
        obj.data.uv_layers.active_index = 0
        bpy.context.view_layer.update()
        result = mesh_stats(obj)
        self.assertEqual(result["activeUv"], "UVMap")
        self.assertEqual(result["nonFiniteUvLoops"], 1)
        self.assertEqual(result["uvMaps"][1]["nonFiniteUvLoops"], 1)

    def test_multiple_usable_coordinate_sets_remain_supported(self):
        obj = self.garment()
        tiled = obj.data.uv_layers.new(name="tiled secondary", do_init=False)
        tiled.data.foreach_set("uv", [-3, 4, 2, 4, -3, 7])
        bpy.context.view_layer.update()
        result = mesh_stats(obj)
        self.assertEqual(len(result["uvMaps"]), 2)
        self.assertEqual(result["nonFiniteUvLoops"], 0)
        self.assertEqual(result["collapsedUvTriangles"], 0)

    def test_absent_uv_map_does_not_invent_uv_data(self):
        result = mesh_stats(self.garment(None))
        self.assertEqual(result["uvLayers"], 0)
        self.assertIsNone(result["activeUv"])
        self.assertEqual(result["uvLoops"], 0)

    def test_nonfinite_source_vertices_are_reported(self):
        obj = self.garment()
        obj.data.vertices[0].co.x = math.nan
        obj.data.update()
        bpy.context.view_layer.update()
        self.assertEqual(mesh_stats(obj)["nonFiniteVertices"], 1)

    def test_inspection_does_not_rewrite_source_uv_or_geometry(self):
        obj = self.garment(((-3, 4), (2, 4), (-3, 7)))
        vertices = [tuple(vertex.co) for vertex in obj.data.vertices]
        uv = [tuple(loop.uv) for loop in obj.data.uv_layers.active.data]
        counts = (len(bpy.data.meshes), len(bpy.data.objects))
        self.assertEqual(mesh_stats(obj), mesh_stats(obj))
        self.assertEqual([tuple(vertex.co) for vertex in obj.data.vertices], vertices)
        self.assertEqual([tuple(loop.uv) for loop in obj.data.uv_layers.active.data], uv)
        self.assertEqual((len(bpy.data.meshes), len(bpy.data.objects)), counts)

    def scene_report(self):
        output = io.StringIO()
        with redirect_stdout(output), self.assertRaises(SystemExit):
            PREFLIGHT["main"]()
        return json.loads(output.getvalue())

    def test_scene_report_blocks_collapsed_uv_instead_of_accepting_its_name(self):
        self.garment(((0, 0), (0, 0), (0, 0)))
        report = self.scene_report()
        self.assertFalse(report["ready"])
        self.assertTrue(any("ShirtTorsoFabric" in reason and "collapsed UV" in reason for reason in report["reasons"]))
        self.assertFalse(any("needs an active UV" in reason and "ShirtTorsoFabric" in reason for reason in report["reasons"]))

    def test_scene_report_blocks_nonfinite_uv_data(self):
        self.garment(((math.inf, 0), (1, 0), (0, 1)))
        report = self.scene_report()
        self.assertTrue(any("ShirtTorsoFabric" in reason and "non-finite UV" in reason for reason in report["reasons"]))

    def test_scene_report_blocks_nonfinite_geometry(self):
        obj = self.garment()
        obj.data.vertices[0].co.x = math.nan
        obj.data.update()
        bpy.context.view_layer.update()
        report = self.scene_report()
        self.assertTrue(any("ShirtTorsoFabric" in reason and "non-finite evaluated vertices" in reason for reason in report["reasons"]))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SceneUvTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
