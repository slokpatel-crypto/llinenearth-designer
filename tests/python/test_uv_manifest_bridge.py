"""Source audit of the GLB/web UV-units bridge; no Blender mocked passing.

This checks invariant glue between the Blender scene, exported .viewer.json,
runtime sampler scale, and release preflight. It never certifies texture or
physical garment correctness without native Blender and real textile evidence.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
AUTHOR = ROOT / "scripts/blender/author-linen-earth-officewear.py"
EXPORT = ROOT / "scripts/blender/export-linen-earth-officewear.py"
PREFLIGHT = ROOT / "scripts/blender/preflight-linen-earth-officewear.py"
VIEWER = ROOT / "src/components/GarmentViewer.tsx"
SCALE = ROOT / "src/lib/garment-viewer-scale.ts"
CONTRACT = ROOT / "src/lib/garment-viewer-model-contract.ts"


class UvManifestBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.author = AUTHOR.read_text(encoding="utf8")
        cls.export = EXPORT.read_text(encoding="utf8")
        cls.preflight = PREFLIGHT.read_text(encoding="utf8")
        cls.viewer = VIEWER.read_text(encoding="utf8")
        cls.scale = SCALE.read_text(encoding="utf8")
        cls.contract = CONTRACT.read_text(encoding="utf8")

    def test_exporter_carries_actual_blender_source_units(self):
        self.assertIn('scene.get("linen_earth_uv_coordinate_units", "normalized_panel")',
                      self.export)
        self.assertIn('"uvCoordinateUnits": uv_units', self.export)
        self.assertIn('panel.get("linen_earth_uv_coordinate_units") != "mesh_metres"',
                      self.export)
        self.assertIn('obj["linen_earth_uv_coordinate_units"] = "mesh_metres"',
                      self.author)

    def test_viewer_uses_manifest_units_in_its_actual_sampler(self):
        self.assertIn('modelManifest?.uvCoordinateUnits ?? "normalized_panel"', self.viewer)
        self.assertIn('texture.sampler?.setScale?.(scale)', self.viewer)
        self.assertIn('1000/tileWidthMm', self.scale)
        self.assertIn('widthMm/tileWidthMm', self.scale)

    def test_unknown_units_and_ambiguous_cylinder_seams_block(self):
        self.assertIn('Unknown garment UV unit system', self.contract)
        self.assertIn('candidateUvFallbackFaces', self.preflight)
        self.assertIn('uv_fallback_faces > 0', self.preflight)
        self.assertIn('linen_earth_uv_seam_certified', self.author)

    def test_uv_truth_cannot_be_silently_promoted(self):
        self.assertIn('obj["linen_earth_supplier_repeat_verified"] = False', self.author)
        self.assertIn('obj["linen_earth_grain_direction_verified"] = False', self.author)
        self.assertIn('bpy.context.scene["linen_earth_production_approved"] = False', self.author)
        self.assertIn('bpy.context.scene["linen_earth_photo_parity_verified"] = False', self.author)


if __name__ == "__main__":
    unittest.main()
