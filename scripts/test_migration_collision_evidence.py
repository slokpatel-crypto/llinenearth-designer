"""Read-only regression coverage for historical migration collision evidence."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from scripts.report_migration_history import report

class CollisionEvidenceTests(unittest.TestCase):
    def test_identical_sql_still_blocks_and_exposes_fingerprints(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            sql = b"select 1;\n"
            for name in ("20261105_first.sql", "20261105_second.sql"):
                (root / name).write_bytes(sql)
            findings = report(root)
            collision = findings["collisions"][0]
            self.assertEqual(collision["version"], "20261105")
            self.assertTrue(collision["sql_content_identical"])
            self.assertEqual(len(collision["fingerprints"]), 2)
            self.assertEqual({x["sha256"] for x in collision["fingerprints"]},
                             {hashlib.sha256(sql).hexdigest()})
            self.assertEqual(len(findings["collisions"]), 1)

    def test_divergent_sql_requires_manual_reconciliation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "20261105_first.sql").write_bytes(b"select 1;")
            (root / "20261105_second.sql").write_bytes(b"select 2;")
            collision = report(root)["collisions"][0]
            self.assertFalse(collision["sql_content_identical"])
            self.assertEqual(len({x["sha256"] for x in collision["fingerprints"]}), 2)

if __name__ == "__main__":
    unittest.main()
