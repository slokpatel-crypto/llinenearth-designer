"""Reject identity tags without independent source/photo review provenance."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from canonical_source_release_gate import (
    OWNER_REVIEW_STATUS, require_independent_source_photo_review
)


def candidate():
    return {
        "linen_earth_model_identity_id":"linen-earth-studio-model-v1",
        "linen_earth_model_reference_image":"/designer/studio-tucked.webp",
        "linen_earth_model_identity_locked":True,
        "linen_earth_source_photo_visual_parity_approved":False,
        "linen_earth_source_photo_reference_count":1,
        "linen_earth_source_photo_visual_parity_status":
           "different_source_scan_requires_independent_four_angle_owner_review",
    }


class ProductionSourceReviewGateTests(unittest.TestCase):
    def test_current_actual_cc0_scene_does_not_pass_with_copied_tags(self):
        with self.assertRaisesRegex(ValueError,"not the original faceless"):
            require_independent_source_photo_review(candidate())

    def test_wrong_photo_and_refcount_cannot_pass(self):
        sample=candidate()
        sample["linen_earth_source_photo_visual_parity_approved"]=True
        sample["linen_earth_source_photo_visual_parity_status"]=OWNER_REVIEW_STATUS
        sample["linen_earth_source_photo_owner_review_sha256"]="a"*64
        for count in (None,True,1,3,"4"):
            sample["linen_earth_source_photo_reference_count"]=count
            with self.subTest(count=count):
                with self.assertRaises(ValueError):
                    require_independent_source_photo_review(sample)
        sample["linen_earth_source_photo_reference_count"]=4
        sample["linen_earth_model_reference_image"]="/designer/other.webp"
        with self.assertRaises(ValueError):
            require_independent_source_photo_review(sample)

    def test_scene_review_flags_do_not_themselves_certify_owner_review(self):
        s=candidate()
        s.update({
            "linen_earth_source_photo_visual_parity_approved":True,
            "linen_earth_source_photo_reference_count":4,
            "linen_earth_source_photo_visual_parity_status":OWNER_REVIEW_STATUS,
        })
        result=require_independent_source_photo_review(s)
        self.assertTrue(result["ownerEvidenceMustBeExternallyVerified"])
        self.assertFalse(result["productionApproved"])

    def test_full_attestation_is_not_a_production_acceptance(self):
        s=candidate()
        s.update({
            "linen_earth_source_photo_visual_parity_approved":True,
            "linen_earth_source_photo_reference_count":4,
            "linen_earth_source_photo_visual_parity_status":OWNER_REVIEW_STATUS,
            "linen_earth_source_photo_owner_review_sha256":"8"*64
        })
        r=require_independent_source_photo_review(s)
        self.assertTrue(r["sourceSceneReviewFlagsPresent"])
        self.assertFalse(r["productionApproved"])


if __name__=="__main__":
    unittest.main()
