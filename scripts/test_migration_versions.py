"""Pure tests for migration version preflight; synthetic files only."""
import tempfile
import json
import contextlib
import io
from unittest.mock import patch
from scripts.check_migration_versions import main
import unittest
from pathlib import Path
from scripts.check_migration_versions import inspect_migrations

class MigrationPreflightTests(unittest.TestCase):
    def test_unique_versions_pass(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261101000000_first.sql").touch()
            (p / "20261102000000_second.sql").touch()
            self.assertEqual(inspect_migrations(p), [])

    def test_duplicate_versions_block(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261101000000_first.sql").touch()
            (p / "20261101000000_second.sql").touch()
            self.assertIn("duplicate migration version", "\n".join(inspect_migrations(p)))

    def test_malformed_filename_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "not_timestamped.sql").touch()
            self.assertIn("invalid migration filename", "\n".join(inspect_migrations(p)))

    def test_symlinked_sql_migration_blocks_even_when_target_is_valid(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261101000000_first.sql").touch()
            target = p / "20261101000000_first.sql"
            (p / "20261102000000_link.sql").symlink_to(target)
            self.assertIn("symlinked migration file", "\n".join(inspect_migrations(p)))

    def test_symlinked_directory_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            actual = root / "actual"
            actual.mkdir()
            (actual / "20261101000000_first.sql").touch()
            linked = root / "migrations"
            linked.symlink_to(actual, target_is_directory=True)
            self.assertIn("symlinked migration directory", "\n".join(inspect_migrations(linked)))

    def test_missing_or_empty_directory_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            self.assertTrue(inspect_migrations(p / "missing"))
            self.assertTrue(inspect_migrations(p))

    def test_uppercase_sql_extension_blocks_instead_of_being_ignored(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261101000000_first.sql").touch()
            (p / "20261102000000_hidden.SQL").touch()
            self.assertIn("invalid migration filename", "\n".join(inspect_migrations(p)))

    def test_read_only_inventory_classifies_legacy_and_collisions_without_approval(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "20261101000000_first.sql").touch()
            (p / "20261101000000_second.sql").touch()
            (p / "20260101_legacy.sql").touch()
            output = io.StringIO()
            with patch("sys.argv", ["check_migration_versions.py", str(p), "--inventory-json"]):
                with contextlib.redirect_stdout(output):
                    status = main()
            report = json.loads(output.getvalue())
            self.assertEqual(status, 1)
            self.assertFalse(report["approved"])
            self.assertEqual(report["finding_count"], 2)
            self.assertEqual({f["kind"] for f in report["findings"]},
                             {"duplicate_version", "legacy_or_invalid_filename"})

    def test_inventory_never_claims_approval_even_when_clean(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "20261101000000_first.sql").touch()
            output = io.StringIO()
            with patch("sys.argv", ["check_migration_versions.py", d, "--inventory-json"]):
                with contextlib.redirect_stdout(output):
                    status = main()
            self.assertEqual(status, 0)
            self.assertFalse(json.loads(output.getvalue())["approved"])

if __name__ == "__main__":
    unittest.main()
