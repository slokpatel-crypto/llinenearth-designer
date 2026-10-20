"""Native Blender regressions; synthetic meshes are fixtures, never model assets.

blender --background --factory-startup --python-exit-code 1 \
  --python tests/blender/test_scene_collisions.py
"""

import math
from pathlib import Path
import runpy
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import bpy
from mathutils import Matrix, Vector

PREFLIGHT = runpy.run_path(str(
    Path(__file__).resolve().parents[2] / "scripts/blender/preflight-linen-earth-officewear.py"
))
intersections = PREFLIGHT["intersection_pair_count"]
checked = PREFLIGHT["checked_boundary_intersections"]
surface_tree = PREFLIGHT["world_surface_tree"]
HORIZONTAL = [(0, 0, 0), (2, 0, 0), (0, 2, 0)]
VERTICAL = [(0.5, 0.5, -1), (0.5, 0.5, 1), (1.5, 0.5, 0)]


class SceneCollisionTests(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def mesh(self, name, points):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(points, [], [(0, 1, 2)])
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj

    def count(self, left, right):
        bpy.context.view_layer.update()
        result = intersections(left, right)
        self.assertEqual(result, intersections(right, left), "Pair order must not change contacts")
        return result

    def test_identity_transform_intersection_and_separation(self):
        a, b = self.mesh("body", HORIZONTAL), self.mesh("garment", VERTICAL)
        self.assertGreater(self.count(a, b), 0)
        b.location.x = 10
        self.assertEqual(self.count(a, b), 0)

    def test_different_local_origins_can_intersect_in_world(self):
        a = self.mesh("body", HORIZONTAL)
        b = self.mesh("garment", [(x + 10, y, z) for x, y, z in VERTICAL])
        b.location.x = -10
        self.assertGreater(self.count(a, b), 0)

    def test_parent_transform_is_used(self):
        a, b = self.mesh("body", HORIZONTAL), self.mesh("garment", VERTICAL)
        parent = bpy.data.objects.new("parent", None)
        bpy.context.scene.collection.objects.link(parent)
        b.parent = parent
        parent.location.x = 10
        self.assertEqual(self.count(a, b), 0)
        a.location.x = 10
        self.assertGreater(self.count(a, b), 0)

    def test_constraint_evaluated_transform_is_used(self):
        a, b = self.mesh("body", HORIZONTAL), self.mesh("garment", VERTICAL)
        target = bpy.data.objects.new("target", None)
        bpy.context.scene.collection.objects.link(target)
        target.location.x = 10
        constraint = b.constraints.new("COPY_LOCATION")
        constraint.target = target
        # The unevaluated object's transform remains identity.
        self.assertEqual(tuple(b.location), (0, 0, 0))
        self.assertEqual(self.count(a, b), 0)
        a.location.x = 10
        self.assertGreater(self.count(a, b), 0)

    def test_shared_rotation_translation_and_nonuniform_scale(self):
        a, b = self.mesh("body", HORIZONTAL), self.mesh("garment", VERTICAL)
        for obj in (a, b):
            obj.location = (3, -2, 1)
            obj.rotation_euler = (0.4, 0.6, 0.8)
            obj.scale = (2, 0.75, 1.5)
        self.assertGreater(self.count(a, b), 0)
        b.location.x += 20
        self.assertEqual(self.count(a, b), 0)

    def test_evaluated_modifier_geometry_is_used(self):
        a = self.mesh("body", HORIZONTAL)
        b = self.mesh("garment", [(x + 10, y, z) for x, y, z in VERTICAL])
        modifier = b.modifiers.new("translated duplicate", "ARRAY")
        modifier.count = 2
        modifier.use_relative_offset = False
        modifier.use_constant_offset = True
        modifier.constant_offset_displace = (-10, 0, 0)
        self.assertGreater(self.count(a, b), 0)
        b.modifiers.remove(modifier)
        self.assertEqual(self.count(a, b), 0)

    def test_quads_are_triangulated(self):
        a = self.mesh("body", HORIZONTAL)
        mesh = bpy.data.meshes.new("quad")
        mesh.from_pydata([(0.5, 0.5, -1), (0.5, 0.5, 1), (1.5, 0.5, 1), (1.5, 0.5, -1)], [], [(0, 1, 2, 3)])
        b = bpy.data.objects.new("garment", mesh)
        bpy.context.scene.collection.objects.link(b)
        self.assertGreater(self.count(a, b), 0)

    def test_missing_wrong_type_and_empty_mesh_fail_closed(self):
        a = self.mesh("body", HORIZONTAL)
        empty = bpy.data.objects.new("empty", None)
        blank = bpy.data.objects.new("blank", bpy.data.meshes.new("blank"))
        bpy.context.scene.collection.objects.link(blank)
        for other in (None, empty, blank):
            reasons = []
            self.assertIsNone(checked("bodyShirtTorso", a, other, 0, reasons))
            self.assertEqual(len(reasons), 1)
            self.assertIn("Could not evaluate", reasons[0])

    def test_existing_zero_contact_and_tuck_thresholds(self):
        for count, allowance, blocked in ((0, 0, False), (1, 0, True), (120, 120, False), (121, 120, True)):
            with self.subTest(count=count, allowance=allowance):
                reasons = []
                with patch.dict(checked.__globals__, intersection_pair_count=lambda *_: count):
                    self.assertEqual(checked("boundary", None, None, allowance, reasons), count)
                self.assertEqual(bool(reasons), blocked)

    def test_evaluation_errors_are_blocking_reasons(self):
        for exception in (RuntimeError("evaluation unavailable"), ValueError("non-finite coordinates")):
            def fail(*_):
                raise exception
            reasons = []
            with patch.dict(checked.__globals__, intersection_pair_count=fail):
                self.assertIsNone(checked("bodySleeveL", None, None, 0, reasons))
            self.assertIn("bodySleeveL", reasons[0])
            self.assertIn(str(exception), reasons[0])

    def test_temporary_meshes_are_released_on_success_and_failure(self):
        # Instrument the evaluated-mesh ownership boundary; BVH remains native.
        for invalid in (False, True):
            cleared = []
            vertices = [SimpleNamespace(co=Vector(point)) for point in HORIZONTAL]
            if invalid:
                vertices[0].co.x = math.nan
            mesh = SimpleNamespace(vertices=vertices,
                loop_triangles=[SimpleNamespace(vertices=(0, 1, 2))], calc_loop_triangles=lambda: None)
            evaluated = SimpleNamespace(matrix_world=Matrix.Identity(4), to_mesh=lambda: mesh,
                to_mesh_clear=lambda: cleared.append(True))
            obj = SimpleNamespace(name="candidate", evaluated_get=lambda _: evaluated)
            if invalid:
                with self.assertRaisesRegex(ValueError, "non-finite"):
                    surface_tree(obj, None)
            else:
                self.assertIsNotNone(surface_tree(obj, None))
            self.assertEqual(cleared, [True])


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SceneCollisionTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
