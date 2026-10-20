"""Native export failures must stop before any stale candidate validation.

Run with Blender --background --factory-startup --python-exit-code 1 --python
tests/blender/test_scene_exports.py. Empty scenes and sentinel bytes are test
fixtures only; none are production models or physical fabric evidence.
"""

import os
from pathlib import Path
import runpy
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import bpy

ROOT = Path(__file__).resolve().parents[2]
EXPORTER = runpy.run_path(str(ROOT / "scripts/blender/export-linen-earth-officewear.py"))
export_glb = EXPORTER["export_glb"]


class SceneExportTests(unittest.TestCase):
    def test_native_preflight_exception_cannot_validate_a_prior_candidate(self):
        with tempfile.TemporaryDirectory(prefix="linen native export ") as directory:
            root = Path(directory)
            scripts = root / "scripts"
            (scripts / "blender").mkdir(parents=True)
            for name in ("export-linen-earth-officewear.py", "preflight-linen-earth-officewear.py"):
                shutil.copyfile(ROOT / "scripts/blender" / name, scripts / "blender" / name)
            marker = root / "validator-ran"
            # A marker isolates process ordering. This stub never certifies GLB
            # structure: the real Blender preflight must prevent it being run.
            (scripts / "check-garment-viewer-model.mjs").write_text(
                "import fs from 'node:fs'; fs.writeFileSync('validator-ran', 'unexpected');\n"
            )
            bpy.ops.wm.read_factory_settings(use_empty=True)
            scene = root / "invalid empty scene.blend"
            bpy.ops.wm.save_as_mainfile(filepath=str(scene))
            panel = root / "panel spec.json"
            panel.write_text("{}")
            output = root / "prior.glb"
            manifest = root / "prior.viewer.json"
            output.write_bytes(b"prior candidate fixture")
            manifest.write_bytes(b"prior manifest fixture")
            env = dict(os.environ, LINEN_GARMENT_BLEND=str(scene),
                LINEN_GARMENT_PANEL_SPEC=str(panel), LINEN_GARMENT_OUTPUT=str(output))
            env["PATH"] = str(Path(bpy.app.binary_path).parent) + os.pathsep + env.get("PATH", "")
            node = shutil.which("node", path=env["PATH"])
            self.assertIsNotNone(node, "Native export regressions require Node")
            result = subprocess.run([node, str(ROOT / "scripts/build-production-garment-model.mjs")],
                cwd=root, env=env, capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn("Production scene preflight failed", result.stdout + result.stderr)
            self.assertFalse(marker.exists(), "Failed native export must not run structural validation")
            self.assertNotIn("candidate passed export", result.stdout)
            self.assertEqual(output.read_bytes(), b"prior candidate fixture")
            self.assertEqual(manifest.read_bytes(), b"prior manifest fixture")

    def run_operator(self, result):
        operator = SimpleNamespace(ops=SimpleNamespace(
            object=SimpleNamespace(select_all=lambda **_: None),
            export_scene=SimpleNamespace(gltf=lambda **_: result),
        ))
        with tempfile.TemporaryDirectory(prefix="linen cancelled export ") as directory:
            with patch.dict(export_glb.__globals__, bpy=operator):
                return export_glb(SimpleNamespace(all_objects=[]), str(Path(directory) / "candidate.glb"))

    def test_cancelled_and_incomplete_operators_are_not_success(self):
        for result in ({"CANCELLED"}, {"RUNNING_MODAL"}, set()):
            with self.subTest(result=result):
                with self.assertRaisesRegex(RuntimeError, "did not finish"):
                    self.run_operator(result)

    def test_finished_operator_remains_supported(self):
        self.assertIsNone(self.run_operator({"FINISHED"}))

    def test_operator_python_exception_is_not_swallowed(self):
        def fail(**_):
            raise RuntimeError("export operator error fixture")
        operator = SimpleNamespace(ops=SimpleNamespace(
            object=SimpleNamespace(select_all=lambda **_: None),
            export_scene=SimpleNamespace(gltf=fail),
        ))
        with tempfile.TemporaryDirectory(prefix="linen export error ") as directory:
            with patch.dict(export_glb.__globals__, bpy=operator):
                with self.assertRaisesRegex(RuntimeError, "export operator error fixture"):
                    export_glb(SimpleNamespace(all_objects=[]), str(Path(directory) / "candidate.glb"))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SceneExportTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
