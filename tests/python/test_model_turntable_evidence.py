"""Fail-closed provenance regressions for four-angle source Blender evidence."""
import hashlib
import json
import random
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "qa"))
from model_turntable_evidence import verify_turntable, VIEWS


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png(width, height, seed):
    rng = random.Random(seed)
    raw = b"".join(b"\0" + rng.randbytes(width) for _ in range(height))

    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))


class TurntableEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "linen-earth-officewear-authored.blend"
        self.source.write_bytes(b"source-blender-identity-lock-fixture")
        self.manifest = self.root / "model-qa-manifest.json"
        self.front = self.root / "linen-earth-model-front.png"
        self.data = {
            "version": "linen-earth-model-qa-turntable-v1",
            "referenceImage": "/designer/studio-tucked.webp",
            "modelIdentityId": "linen-earth-studio-model-v1",
            "sourceBlendName": self.source.name,
            "sourceBlendSha256": digest(self.source),
            "identityLocked": True,
            "candidateOnly": True,
            "diagnosticColorsOnly": True,
            "supplierColorCalibration": False,
            "photographicMatchApproved": False,
            "realismApproved": False,
            "tailorApproved": False,
            "measuredFabricDrapeApproved": False,
            "renderEngine": "BLENDER_EEVEE_NEXT",
            "resolution": [480, 640],
            "angles": [],
        }
        for seed, (view, yaw) in enumerate(VIEWS):
            filename = f"linen-earth-model-{view}.png"
            frame = self.root / filename
            frame.write_bytes(png(480, 640, seed))
            self.data["angles"].append({
                "view": view, "yawDeg": yaw, "file": filename,
                "sha256": digest(frame),
            })

    def verify(self):
        self.manifest.write_text(json.dumps(self.data))
        return verify_turntable(self.manifest, self.front, self.source)

    def test_valid_complete_four_angle_source(self):
        result = self.verify()
        self.assertEqual(result["sourceBlendSha256"], digest(self.source))
        self.assertEqual(len(result["frameSha256ByView"]), 4)
        self.assertFalse(result["photographicMatchApproved"])

    def test_reject_swapped_original_source(self):
        self.source.write_bytes(b"another-body-source")
        with self.assertRaisesRegex(ValueError, "source digest"):
            self.verify()

    def test_reject_wrong_identity(self):
        self.data["modelIdentityId"] = "replacement-model"
        with self.assertRaisesRegex(ValueError, "locked studio identity"):
            self.verify()

    def test_reject_forged_visual_approval(self):
        self.data["photographicMatchApproved"] = True
        with self.assertRaisesRegex(ValueError, "must not assert"):
            self.verify()

    def test_reject_coerced_boolean(self):
        self.data["tailorApproved"] = 0
        with self.assertRaisesRegex(ValueError, "must not assert"):
            self.verify()

    def test_reject_swapped_front_frame(self):
        self.manifest.write_text(json.dumps(self.data))
        with self.assertRaisesRegex(ValueError, "manifest-bound front"):
            verify_turntable(self.manifest,
                             self.root / "linen-earth-model-side.png", self.source)

    def test_reject_missing_back_frame(self):
        (self.root / "linen-earth-model-back.png").unlink()
        with self.assertRaises((ValueError, FileNotFoundError)):
            self.verify()

    def test_reject_tampered_side_frame(self):
        with (self.root / "linen-earth-model-side.png").open("ab") as handle:
            handle.write(b"tamper")
        with self.assertRaisesRegex(ValueError, "side frame digest"):
            self.verify()

    def test_reject_wrong_yaw(self):
        self.data["angles"][1]["yawDeg"] = 90.0
        with self.assertRaisesRegex(ValueError, "three-quarter camera yaw"):
            self.verify()

    def test_reject_duplicate_angle_entry(self):
        self.data["angles"][3] = self.data["angles"][0].copy()
        with self.assertRaisesRegex(ValueError, "back camera yaw"):
            self.verify()

    def test_reject_duplicate_camera_pixels(self):
        side = self.root / "linen-earth-model-side.png"
        side.write_bytes(self.front.read_bytes())
        self.data["angles"][2]["sha256"] = digest(side)
        with self.assertRaisesRegex(ValueError, "Duplicate camera frames"):
            self.verify()

    def test_reject_path_traversal(self):
        self.data["angles"][0]["file"] = "../linen-earth-model-front.png"
        with self.assertRaisesRegex(ValueError, "frame path"):
            self.verify()

    def test_reject_mismatched_image_dimensions(self):
        self.data["resolution"] = [576, 864]
        with self.assertRaisesRegex(ValueError, "PNG header/dimensions"):
            self.verify()

    def test_reject_duplicate_json_keys(self):
        original = json.dumps(self.data)
        self.manifest.write_text('{"version":"shadow",' + original[1:])
        with self.assertRaisesRegex(ValueError, "Duplicate manifest key"):
            verify_turntable(self.manifest, self.front, self.source)

    def test_reject_nonfinite_yaw(self):
        self.data["angles"][1]["yawDeg"] = float("nan")
        with self.assertRaisesRegex(ValueError, "Non-finite JSON"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
