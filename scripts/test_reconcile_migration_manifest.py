"""Fail-closed synthetic staging manifest comparison tests; no database connection."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from scripts.reconcile_migration_manifest import reconcile

class ReconcileManifestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)
        self.name = "20261101000000_stock.sql"
        self.sql = b"select 1;\n"
        (self.path / self.name).write_bytes(self.sql)
        self.item = {"version": "20261101000000", "file": self.name,
                     "sha256": hashlib.sha256(self.sql).hexdigest()}

    def check(self, items):
        return reconcile(self.path, {"migrations": items})

    def test_matching_export_only_certifies_manifest_match(self):
        self.assertTrue(self.check([self.item])["verified_manifest_match"])

    def test_changed_sql_or_filename_rejected(self):
        changed = dict(self.item, sha256="0" * 64)
        self.assertFalse(self.check([changed])["verified_manifest_match"])
        self.assertFalse(self.check([dict(self.item, file="other.sql")])["verified_manifest_match"])

    def test_missing_extra_and_duplicate_staging_versions_rejected(self):
        self.assertFalse(self.check([])["verified_manifest_match"])
        self.assertFalse(self.check([self.item, self.item])["verified_manifest_match"])
        extra = dict(self.item, version="20261102000000")
        self.assertFalse(self.check([self.item, extra])["verified_manifest_match"])

    def test_ambiguous_repository_or_unverified_manifest_rejected(self):
        (self.path / "20261101000000_collision.sql").write_bytes(b"select 2;")
        self.assertFalse(self.check([self.item])["verified_manifest_match"])
        (self.path / "20261101000000_collision.sql").unlink()
        self.assertFalse(self.check([{"version": self.item["version"], "file": self.name}])["verified_manifest_match"])
        self.assertFalse(reconcile(self.path, {})["verified_manifest_match"])

if __name__ == "__main__":
    unittest.main()
