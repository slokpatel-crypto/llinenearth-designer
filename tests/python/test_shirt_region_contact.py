"""Native source contact counts must partition exactly by real cloth face roles."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from shirt_region_contact import summarize_native_region_contacts


class NativePanelContactReceiptTests(unittest.TestCase):
    def test_all_regions_and_exact_sum_are_checked(self):
        result=summarize_native_region_contacts(
            {"front":340,"back":120,"placket":30,"collar":90},
            580,{"front":180,"back":180,"placket":14,"collar":128}
        )
        self.assertTrue(result["regionMeasureAgreement"])
        self.assertFalse(result["canClaimCompleteBodyClearance"])
        self.assertEqual(result["contactRegionsRanked"][0]["region"],"front")
        self.assertFalse(result["productionApproved"])

    def test_aggregate_disagreement_does_not_approve(self):
        result=summarize_native_region_contacts(
            {"left_sleeve":5,"right_sleeve":3},9,
            {"left_sleeve":170,"right_sleeve":170}
        )
        self.assertFalse(result["regionMeasureAgreement"])
        self.assertFalse(result["canClaimCompleteBodyClearance"])

    def test_verified_zero_geometry_is_not_photo_or_tailor_approval(self):
        result=summarize_native_region_contacts(
            {"front":0,"back":0},0,{"front":1,"back":1}
        )
        self.assertTrue(result["canClaimCompleteBodyClearance"])
        self.assertFalse(result["photographicIdentityApproved"])
        self.assertFalse(result["tailorApproved"])
        self.assertFalse(result["productionApproved"])

    def test_missing_or_empty_actual_panel_fails_closed(self):
        for receipts,faces in (
            ({"front":0},{"front":2,"back":2}),
            ({"front":0,"back":0},{"front":2}),
            ({"front":0},{"front":0}),
            ({"front":None},{"front":4}),
            ({"front":True},{"front":4}),
            ({"front":-1},{"front":4}),
            ({"front":0},{"front":False}),
            ({},{}),
        ):
            with self.subTest(receipts=receipts,faces=faces):
                with self.assertRaises(ValueError):
                    summarize_native_region_contacts(receipts,0,faces)

    def test_missing_or_unsafe_total_fails_closed(self):
        for total in (None,-1,True,0.0,"0"):
            with self.subTest(total=total):
                with self.assertRaises(ValueError):
                    summarize_native_region_contacts({"front":0},total,{"front":5})


if __name__=="__main__":
    unittest.main()
