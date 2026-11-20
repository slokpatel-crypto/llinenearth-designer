"""Offline regression for the pinned original Blender CC0 source fallback.

Only Blender's two official URLs are allowed; byte size and ZIP structure
must be verified. No substitute body asset or production model is permitted.
"""
from __future__ import annotations

import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch
import zipfile

source = Path(__file__).resolve().parents[2] / "scripts/blender/bootstrap-human-base-meshes.py"
spec = importlib.util.spec_from_file_location("cc0_source_fallback", source)
assert spec is not None and spec.loader is not None
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


def archive_bytes():
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr("original.blend", "synthetic fixture, NOT a body source")
    return out.getvalue()


def blocked(request, timeout=None):
    raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)


class SourceMirrorFallbackTest(unittest.TestCase):
    def test_official_blender_source_then_exact_mirror(self):
        payload = archive_bytes()
        urls = []
        def fetch(request, timeout=None):
            urls.append(request.full_url)
            if len(urls) == 1:
                return blocked(request, timeout)
            return io.BytesIO(payload)

        with tempfile.TemporaryDirectory() as root, patch.object(
            bootstrap, "EXPECTED_ARCHIVE_BYTES", len(payload)
        ), patch.object(bootstrap.urllib.request, "urlopen", side_effect=fetch):
            path = Path(root) / "source.zip"
            bootstrap.download_archive(path)
            self.assertEqual(path.read_bytes(), payload)
            self.assertFalse(Path(str(path) + ".partial").exists())
            self.assertEqual(urls, [bootstrap.BUNDLE_URL, bootstrap.BUNDLE_MIRROR_URL])
            self.assertTrue(bootstrap.BUNDLE_MIRROR_URL.startswith("https://mirror.blender.org/"))

    def test_both_official_sources_unavailable_fails_without_partial(self):
        urls = []
        def fetch(request, timeout=None):
            urls.append(request.full_url)
            return blocked(request, timeout)

        with tempfile.TemporaryDirectory() as root, patch.object(
            bootstrap.urllib.request, "urlopen", side_effect=fetch
        ):
            path = Path(root) / "source.zip"
            with self.assertRaisesRegex(RuntimeError, "unavailable from both Blender sources"):
                bootstrap.download_archive(path)
            self.assertFalse(path.exists())
            self.assertFalse(Path(str(path) + ".partial").exists())
            self.assertEqual(urls, [bootstrap.BUNDLE_URL, bootstrap.BUNDLE_MIRROR_URL])

    def test_invalid_mirror_archive_is_not_accepted_as_source(self):
        payload = b"this is not a Blender mesh ZIP"
        calls = []
        def fetch(request, timeout=None):
            calls.append(request.full_url)
            if len(calls) == 1:
                return blocked(request, timeout)
            return io.BytesIO(payload)

        with tempfile.TemporaryDirectory() as root, patch.object(
            bootstrap, "EXPECTED_ARCHIVE_BYTES", len(payload)
        ), patch.object(bootstrap.urllib.request, "urlopen", side_effect=fetch):
            path = Path(root) / "source.zip"
            with self.assertRaisesRegex(RuntimeError, "not a valid ZIP"):
                bootstrap.download_archive(path)
            self.assertFalse(path.exists())
            self.assertFalse(Path(str(path) + ".partial").exists())


if __name__ == "__main__":
    unittest.main()
