"""Pure tests for independent 13-pair garment collision evidence."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/blender"))
from garment_panel_contacts import (
    PANELS, PROPOSED_SEWN_JOINS, ESTABLISHED_SEPARATE_GATES,
    remaining_panel_pairs, review_panel_contacts,
)


class GarmentPanelContactsTest(unittest.TestCase):
    def setUp(self):
        self.panels = {name: name for name in PANELS}

    def test_every_non_tuck_non_leg_pair_is_reviewed_once(self):
        all_pairs = {frozenset(pair) for pair in remaining_panel_pairs()}
        self.assertEqual(len(all_pairs), 13)
        self.assertEqual(len(all_pairs | ESTABLISHED_SEPARATE_GATES), 15)
        self.assertFalse(all_pairs & ESTABLISHED_SEPARATE_GATES)
        self.assertTrue(PROPOSED_SEWN_JOINS <= all_pairs)

    def test_all_zero_does_not_approve_sewn_construction(self):
        observed = []
        report, reasons = review_panel_contacts(
            self.panels, lambda a, b: observed.append((a, b)) or 0,
        )
        self.assertEqual(reasons, [])
        self.assertEqual(len(observed), 13)
        self.assertEqual(len(report), 13)
        self.assertTrue(all(
            record["status"] == "zero_crossings_not_seam_approval"
            and record["sewnConstructionApproved"] is False
            for record in report.values()
        ))

    def test_proposed_armhole_crossings_are_not_whitelisted(self):
        def count(a, b):
            return 231 if (a, b) == ("ShirtTorsoFabric", "ShirtSleeveLFabric") else 0
        report, reasons = review_panel_contacts(self.panels, count)
        self.assertEqual(len(reasons), 1)
        self.assertIn("231 intersecting triangle pairs", reasons[0])
        record = report["ShirtTorsoFabric__ShirtSleeveLFabric"]
        self.assertEqual(record["relationship"], "proposed_sewn_join_unverified")
        self.assertEqual(record["status"], "crossings_unapproved")

    def test_sleeve_leg_contact_is_unintended(self):
        def count(a, b):
            return 26 if (a, b) == ("ShirtSleeveLFabric", "TrouserLegLFabric") else 0
        report, reasons = review_panel_contacts(self.panels, count)
        self.assertEqual(len(reasons), 1)
        self.assertEqual(
            report["ShirtSleeveLFabric__TrouserLegLFabric"]["relationship"],
            "unintended_panel_contact",
        )

    def test_unmeasured_pair_is_not_zero(self):
        garments = dict(self.panels)
        garments["ShirtSleeveRFabric"] = None
        report, reasons = review_panel_contacts(
            garments, lambda a, b: None if a is None or b is None else 0
        )
        self.assertGreater(len(reasons), 0)
        self.assertIsNone(
            report["ShirtTorsoFabric__ShirtSleeveRFabric"]["intersectionTrianglePairs"]
        )
        self.assertIn("Unmeasured garment panel", reasons[0])

    def test_invalid_counts_fail_closed(self):
        for value in (-1, True, float("nan"), "0"):
            with self.subTest(value=value):
                _, reasons = review_panel_contacts(self.panels, lambda a, b: value)
                self.assertEqual(len(reasons), 13)


if __name__ == "__main__":
    unittest.main()
