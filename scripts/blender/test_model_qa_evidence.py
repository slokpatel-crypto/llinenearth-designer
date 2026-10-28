import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_qa_evidence import (VIEWS, MODEL_IDENTITY_ID, REFERENCE_IMAGE,
                               MANIFEST_VERSION, PREFLIGHT_GATE, PREFLIGHT_REPORT_FILE, GARMENT_OBJECTS,
                               sha256_file, validate_candidate_manifest, run_native_preflight, validate_native_preflight_report)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)


def png(width=480, height=640):
    pixels = b"".join(b"\0" + b"\x00\x00\x00" * width for _ in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"tEXt", b"QA\0" + b"x" * 12000)
            + chunk(b"IDAT", zlib.compress(pixels))
            + chunk(b"IEND", b""))


class CandidateFourAngleEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.source = self.directory / "identity-locked.blend"
        self.source.write_bytes(b"test identity locked source fixture")
        self.photo = self.directory / "studio-tucked.webp"
        self.photo.write_bytes(b"canonical photo fixture")
        self.preflight = self.directory / "preflight.py"
        self.preflight.write_text("# test preflight fixture\n", encoding="utf-8")
        self.manifest = {
            "version": MANIFEST_VERSION,
            "referenceImage": REFERENCE_IMAGE,
            "modelIdentityId": MODEL_IDENTITY_ID,
            "sourceBlendName": self.source.name,
            "sourceBlendSha256": sha256_file(self.source),
            "referencePhotoSha256": sha256_file(self.photo),
            "nativePreflightGate": PREFLIGHT_GATE,
            "nativePreflightPassed": True,
            "rejectedDiagnostic": False,
            "nativePreflightScriptSha256": sha256_file(self.preflight),
            "nativePreflightReportFile": PREFLIGHT_REPORT_FILE,
            "identityLocked": True,
            "candidateOnly": True,
            "photographicMatchApproved": False,
            "realismApproved": False,
            "tailorApproved": False,
            "measuredFabricDrapeApproved": False,
            "renderEngine": "BLENDER_EEVEE_NEXT",
            "resolution": [480, 640],
            "angles": [],
        }
        self.report = {
            "gate": PREFLIGHT_GATE, "ready": True, "reasons": [],
            "modelIdentity": {"id": MODEL_IDENTITY_ID, "referenceImage": REFERENCE_IMAGE, "locked": True},
            "requiredGarmentObjects": list(GARMENT_OBJECTS),
            "identityFitMeasurementsMm": {"sleeveCenterSpacingMm": 500.0, "legCenterSpacingMm": 210.0},
            "objects": {name: {"present": True, "inExportCollection": True,
                               "uvQuality": {"invalidUvFaces": 0, "nonfiniteUvFaces": 0,
                                             "collapsedUvFaces": 0, "discontinuousSharedUvEdges": 0,
                                             "nonmanifoldUvEdges": 0, "sharedUvEdges": 50}}
                        for name in GARMENT_OBJECTS},
            "boundaryIntersections": {key: 0 for key in
                ("bodyShirtTorso", "bodySleeveL", "bodySleeveR", "bodyTrouserWaist",
                 "bodyTrouserLegL", "bodyTrouserLegR", "shirtTrouserTuck")},
        }
        (self.directory / PREFLIGHT_REPORT_FILE).write_text(json.dumps(self.report), encoding="utf-8")
        self.manifest["nativePreflightReportSha256"] = sha256_file(self.directory / PREFLIGHT_REPORT_FILE)
        for label, yaw in VIEWS:
            filename = f"linen-earth-model-{label}.png"
            (self.directory / filename).write_bytes(png())
            self.manifest["angles"].append({"view": label, "yawDeg": yaw,
                                            "file": filename,
                                            "sha256": sha256_file(self.directory / filename)})

    def validate(self):
        return validate_candidate_manifest(self.manifest, self.directory,
                                           source=self.source, preflight_script=self.preflight,
                                           reference_photo=self.photo)

    def test_complete_candidate_evidence_is_integrity_valid_but_not_approved(self):
        self.assertEqual(self.validate(), [])
        self.assertFalse(self.manifest["photographicMatchApproved"])
        self.assertFalse(self.manifest["tailorApproved"])

    def test_missing_reordered_duplicate_or_traversal_view_rejected(self):
        self.manifest["angles"][1] = dict(self.manifest["angles"][0])
        self.assertTrue(self.validate())
        self.manifest["angles"][1]["file"] = "../other.png"
        self.assertTrue(self.validate())
        self.manifest["angles"].pop()
        self.assertIn("Exactly four camera-angle entries are required", self.validate())

    def test_wrong_yaw_and_false_approval_rejected(self):
        self.manifest["angles"][2]["yawDeg"] = 0
        self.manifest["realismApproved"] = True
        errors = self.validate()
        self.assertTrue(any("yaw" in x for x in errors))
        self.assertTrue(any("realismApproved" in x for x in errors))

    def test_source_or_preflight_script_drift_invalidates_candidate(self):
        self.source.write_bytes(b"modified .blend")
        self.preflight.write_text("# changed", encoding="utf-8")
        errors = self.validate()
        self.assertTrue(any("sourceBlendSha256" in x for x in errors))
        self.assertTrue(any("nativePreflightScriptSha256" in x for x in errors))

    def test_corrupt_crc_truncated_png_and_wrong_resolution_rejected(self):
        frame = self.directory / "linen-earth-model-front.png"
        content = frame.read_bytes()
        frame.write_bytes(content[:200])
        self.assertTrue(any("front" in x for x in self.validate()))
        frame.write_bytes(content[:-10] + b"broken tail")
        self.manifest["angles"][0]["sha256"] = sha256_file(frame)
        self.assertTrue(any("front" in x for x in self.validate()))
        frame.write_bytes(png(500, 640))
        self.manifest["angles"][0]["sha256"] = sha256_file(frame)
        self.assertTrue(any("dimensions" in x for x in self.validate()))

    def test_symlink_frame_and_missing_frame_rejected(self):
        frame = self.directory / "linen-earth-model-back.png"
        frame.unlink()
        self.assertTrue(any("back" in x for x in self.validate()))
        frame.symlink_to(self.directory / "linen-earth-model-front.png")
        self.assertTrue(any("symlinked" in x for x in self.validate()))

    def test_coerced_metadata_and_malformed_manifest_rejected(self):
        self.manifest["resolution"] = [True, 640]
        self.manifest["nativePreflightPassed"] = "true"
        self.assertTrue(any("resolution" in x for x in self.validate()))
        self.assertTrue(any("nativePreflightPassed" in x for x in self.validate()))
        self.assertTrue(validate_candidate_manifest(None, self.directory))

    def test_native_preflight_required_and_failure_blocks_render(self):
        script = self.directory / "mock-native-preflight.py"
        with self.assertRaises(RuntimeError):
            run_native_preflight(script)
        script.write_text("def main():\n    raise SystemExit(1)\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "preflight failed"):
            run_native_preflight(script)
        script.write_text("def main():\n    return None\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "evidence failed"):
            run_native_preflight(script)
        script.write_text("def main():\n    return " + repr(self.report) + "\n", encoding="utf-8")
        self.assertEqual(run_native_preflight(script), self.report)
        script.write_text("pass\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "main"):
            run_native_preflight(script)

    def test_unsaved_blender_scene_cannot_claim_saved_source_digest(self):
        code = """
import runpy, sys, types
bpy = types.ModuleType("bpy")
bpy.data = types.SimpleNamespace(filepath=sys.argv[2], is_dirty=True)
sys.modules["bpy"] = bpy
mathutils = types.ModuleType("mathutils")
mathutils.Vector = object
sys.modules["mathutils"] = mathutils
namespace = runpy.run_path(sys.argv[1], run_name="candidate_import_only")
try:
    namespace["verify_source"]()
except RuntimeError as error:
    assert "Unsaved Blender scene" in str(error)
else:
    raise AssertionError("Unsaved scene incorrectly accepted")
"""
        renderer = Path(__file__).with_name("render-linen-earth-model-qa.py")
        result = subprocess.run(
            [sys.executable, "-I", "-c", code, str(renderer), str(self.source)],
            cwd=self.directory, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_truthy_string_cannot_spoof_scene_identity_lock(self):
        code = """
import runpy, sys, types
bpy = types.ModuleType("bpy")
bpy.data = types.SimpleNamespace(filepath=sys.argv[2], is_dirty=False)
bpy.context = types.SimpleNamespace(scene={
    "linen_earth_model_identity_id": "linen-earth-studio-model-v1",
    "linen_earth_model_reference_image": "/designer/studio-tucked.webp",
    "linen_earth_model_identity_locked": "false",
})
sys.modules["bpy"] = bpy
mathutils = types.ModuleType("mathutils")
mathutils.Vector = object
sys.modules["mathutils"] = mathutils
namespace = runpy.run_path(sys.argv[1], run_name="candidate_import_only")
try:
    namespace["verify_source"]()
except RuntimeError as error:
    assert "not locked" in str(error)
else:
    raise AssertionError("Truthy string accepted as identity lock")
"""
        renderer = Path(__file__).with_name("render-linen-earth-model-qa.py")
        result = subprocess.run(
            [sys.executable, "-I", "-c", code, str(renderer), str(self.source)],
            cwd=self.directory, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        native_source = Path(__file__).with_name("preflight-linen-earth-officewear.py").read_text(encoding="utf-8")
        self.assertIn('identity_locked = bpy.context.scene.get("linen_earth_model_identity_locked") is True', native_source)

    def test_blender_script_resolves_local_helper_under_isolated_python(self):
        # Blender's --python runner may execute a file without adding its
        # directory to sys.path. Simulate that with isolated Python and bpy stubs.
        code = (
            "import runpy,sys,types;"
            "sys.modules['bpy']=types.ModuleType('bpy');"
            "m=types.ModuleType('mathutils');m.Vector=object;"
            "sys.modules['mathutils']=m;"
            "runpy.run_path(sys.argv[1],run_name='candidate_import_only')"
        )
        renderer = Path(__file__).with_name("render-linen-earth-model-qa.py")
        result = subprocess.run(
            [sys.executable, "-I", "-c", code, str(renderer)],
            cwd=self.directory, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_independent_cli_rechecks_exact_source_and_frames(self):
        manifest_path = self.directory / "model-qa-manifest.json"
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        command = [sys.executable, str(Path(__file__).with_name("model_qa_evidence.py")),
                   "--manifest", str(manifest_path), "--source-blend", str(self.source),
                   "--preflight-script", str(self.preflight),
                   "--reference-photo", str(self.photo)]
        valid = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(valid.returncode, 0, valid.stdout + valid.stderr)
        self.assertIn("candidate file integrity only", valid.stdout)
        self.source.write_bytes(b"altered")
        invalid = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(invalid.returncode, 1)
        self.assertIn("sourceBlendSha256", invalid.stdout)
        manifest_path.write_text("{not JSON", encoding="utf-8")
        corrupt = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(corrupt.returncode, 1)

    def test_rejected_diagnostic_renderer_exits_nonzero_after_writing_artifacts(self):
        source = Path(__file__).with_name("render-linen-earth-model-qa.py").read_text(encoding="utf-8")
        self.assertIn("if options.diagnostic_rejected:\n        raise SystemExit(2)", source)

    def test_native_preflight_rejected_report_requires_explicit_diagnostic_opt_in(self):
        script = self.directory / "mock-rejected-preflight.py"
        rejected = dict(self.report)
        rejected["ready"] = False
        rejected["reasons"] = ["Sleeve spacing exceeds target"]
        script.write_text(
            "class Rejected(SystemExit):\n"
            " def __init__(self, report):\n  super().__init__(1)\n  self.report=report\n"
            "def main():\n raise Rejected(" + repr(rejected) + ")\n", encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "preflight failed"):
            run_native_preflight(script)
        self.assertEqual(run_native_preflight(script, allow_rejected=True), rejected)

    def test_rejected_diagnostic_can_be_audited_but_never_pass_candidate_gate(self):
        self.assertTrue(validate_native_preflight_report(self.report, allow_rejected=True))
        self.report["ready"] = False
        self.report["reasons"] = ["Sleeve center 563.4mm", "Unreviewed UV seams 83/85"]
        self.report["identityFitMeasurementsMm"]["sleeveCenterSpacingMm"] = 563.4
        self.report["objects"]["ShirtSleeveLFabric"]["uvQuality"]["discontinuousSharedUvEdges"] = 83
        report_path = self.directory / PREFLIGHT_REPORT_FILE
        report_path.write_text(json.dumps(self.report), encoding="utf-8")
        self.manifest["nativePreflightReportSha256"] = sha256_file(report_path)
        self.manifest["nativePreflightPassed"] = False
        self.manifest["rejectedDiagnostic"] = True
        self.assertTrue(self.validate())
        self.assertEqual(validate_candidate_manifest(self.manifest, self.directory,
            source=self.source, preflight_script=self.preflight,
            reference_photo=self.photo, allow_rejected=True), [])
        manifest_path = self.directory / "model-qa-manifest.json"
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        result = subprocess.run([
            sys.executable, str(Path(__file__).with_name("model_qa_evidence.py")),
            "--manifest", str(manifest_path), "--source-blend", str(self.source),
            "--preflight-script", str(self.preflight), "--reference-photo", str(self.photo),
            "--allow-rejected-diagnostic",
        ], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("REJECTED DIAGNOSTIC", result.stdout)

    def test_native_report_blocks_old_sleeve_spacing_and_uv_seam_failures(self):
        self.report["identityFitMeasurementsMm"]["sleeveCenterSpacingMm"] = 563.4
        self.report["objects"]["ShirtSleeveLFabric"]["uvQuality"]["discontinuousSharedUvEdges"] = 83
        report_path = self.directory / PREFLIGHT_REPORT_FILE
        report_path.write_text(json.dumps(self.report), encoding="utf-8")
        self.manifest["nativePreflightReportSha256"] = sha256_file(report_path)
        errors = self.validate()
        self.assertTrue(any("sleeveCenterSpacingMm" in x for x in errors))
        self.assertTrue(any("discontinuousSharedUvEdges" in x for x in errors))

    def test_reference_photo_drift_invalidates_candidate_identity(self):
        self.photo.write_bytes(b"different studio reference")
        self.assertTrue(any("referencePhotoSha256" in x for x in self.validate()))

    def test_native_report_rejects_missing_or_tampered_geometry(self):
        report_path = self.directory / PREFLIGHT_REPORT_FILE
        report_path.unlink()
        self.assertTrue(any("native preflight report" in x.lower() for x in self.validate()))
        self.report["ready"] = False
        self.report["objects"].pop("TrouserLegRFabric")
        self.assertTrue(validate_native_preflight_report(self.report))

    def test_invalid_png_signature_and_trailing_bytes(self):
        frame = self.directory / "linen-earth-model-front.png"
        frame.write_bytes(b"not PNG" + b"x" * 12000)
        self.manifest["angles"][0]["sha256"] = sha256_file(frame)
        self.assertTrue(any("front" in x for x in self.validate()))
        frame.write_bytes(png() + b"junk")
        self.manifest["angles"][0]["sha256"] = sha256_file(frame)
        self.assertTrue(any("trailing" in x for x in self.validate()))


if __name__ == "__main__":
    unittest.main()
