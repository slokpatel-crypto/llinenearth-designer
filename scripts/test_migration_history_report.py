"""Synthetic read-only migration history inventory tests."""
import tempfile
import hashlib
import unittest
from pathlib import Path
from scripts.report_migration_history import report


class MigrationHistoryReportTests(unittest.TestCase):
    def test_legacy_and_modern_are_separate(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261031_legacy.sql").touch()
            (p / "20261101000000_modern.sql").touch()
            result = report(p)
            self.assertEqual(result["legacy"], ["20261031_legacy.sql"])
            self.assertEqual(result["modern"], ["20261101000000_modern.sql"])
            self.assertEqual(result["collisions"], [])

    def test_legacy_collision_is_visible(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261031_first.sql").touch()
            (p / "20261031_second.sql").touch()
            result = report(p)
            self.assertEqual(result["collisions"], [{"version": "20261031",
                "files": ["20261031_first.sql", "20261031_second.sql"]}])

    def test_modern_collision_is_visible(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261101000000_first.sql").touch()
            (p / "20261101000000_second.sql").touch()
            self.assertEqual(len(report(p)["collisions"]), 1)

    def test_sql_fingerprints_are_byte_exact_and_stable(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            filename = "20261031_legacy.sql"
            (p / filename).write_bytes(b"select 1;\\n")
            first = report(p)["fingerprints"]
            self.assertEqual(first, [{"file": filename, "version": "20261031",
                "sha256": hashlib.sha256(b"select 1;\\n").hexdigest()}])
            self.assertEqual(report(p)["fingerprints"], first)
            (p / filename).write_bytes(b"select 2;\\n")
            self.assertNotEqual(report(p)["fingerprints"], first)
            self.assertEqual(report(p)["legacy"], [filename])

    def test_malformed_and_missing_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "invalid.sql").touch()
            self.assertEqual(report(p)["malformed"], ["invalid.sql"])
            self.assertTrue(report(p / "absent")["missing"])


if __name__ == "__main__":
    unittest.main()
