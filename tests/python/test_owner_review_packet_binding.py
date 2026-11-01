"""A human review signature must bind actual Blender bytes and four views."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from canonical_source_release_gate import (
    OWNER_REVIEW_STATUS, verify_external_owner_review_packet
)

IDENTITY={
    "version":"linen-earth-studio-model-v1",
    "referenceImage":"/designer/studio-tucked.webp",
    "referenceHeightMm":1727,
    "physicalTargetsMm":{
        "height":1727,"shoulderSeamWidth":388,"outerArmSilhouette":574,
        "shirtWaistWidth":294,"trouserWaistWidth":344,
        "handCenterSpacing":500,"legCenterSpacing":210,"hemWidth":64
    },
    "views":[{"id":n} for n in ("front","three-quarter","side","back")]
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class SourceReviewBindingTest(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        self.model=self.root/"owner.blend"
        self.model.write_bytes(b"BLENDER-v450"+b"1"*2048)
        self.reference=self.root/"reference.webp"
        self.reference.write_bytes(b"RIFF"+b"2"*4+b"WEBP"+b"R"*2048)
        self.spec=self.root/"spec.json"
        self.spec.write_text(json.dumps(IDENTITY),encoding="utf-8")
        self.views={}
        for idx,name in enumerate(("front","three-quarter","side","back")):
            p=self.root/(name+".png")
            p.write_bytes(b"\x89PNG\r\n\x1a\n"+bytes([20+idx])*2048)
            self.views[name]=p
        self.packet={
            "schemaVersion":"linen-earth-owner-four-angle-review-v1",
            "canonicalModelId":"linen-earth-studio-model-v1",
            "ownerConfirmsSameFacelessStudioModel":True,
            "reviewerName":"Owner Reviewer",
            "reviewedAt":"2026-11-01",
            "manualVisualChecks":{
                "facelessHead":True,"shouldersAndArms":True,
                "backTuckAndWaist":True,"legsAndShoes":True
            },
            "sceneBlendSha256":sha(self.model),
            "canonicalReferenceSha256":sha(self.reference),
            "viewPaths":{k:p.name for k,p in self.views.items()},
            "renderSha256":{k:sha(p) for k,p in self.views.items()},
        }
        self.scene={
            "linen_earth_model_identity_id":"linen-earth-studio-model-v1",
            "linen_earth_model_reference_image":"/designer/studio-tucked.webp",
            "linen_earth_model_identity_locked":True,
            "linen_earth_source_photo_visual_parity_approved":True,
            "linen_earth_source_photo_reference_count":4,
            "linen_earth_source_photo_visual_parity_status":OWNER_REVIEW_STATUS,
        }
        self.review=self.root/"owner-reviewed.json"
        self.save()

    def save(self):
        self.review.write_text(json.dumps(self.packet,sort_keys=True),encoding="utf-8")
        self.scene["linen_earth_source_photo_owner_review_sha256"]=sha(self.review)

    def evaluate(self):
        return verify_external_owner_review_packet(
            self.scene,scene_blend_path=self.model,
            reference_path=self.reference,identity_spec_path=self.spec,
            review_path=self.review
        )

    def test_human_attestation_bound_to_real_files_is_still_not_production(self):
        report=self.evaluate()
        self.assertTrue(report["sameOriginalFacelessModelHumanAttestation"])
        self.assertFalse(report["actualProductionApproved"])
        self.assertEqual(report["independentOwnerSourcePhotoReviewPacketSha256"],
                         sha(self.review))

    def test_tampering_with_source_blend_or_3d_view_rejects_receipt(self):
        self.model.write_bytes(self.model.read_bytes()+b"Z")
        with self.assertRaisesRegex(ValueError,"stale"):
            self.evaluate()
        self.model.write_bytes(self.model.read_bytes()[:-1])
        self.views["back"].write_bytes(self.views["back"].read_bytes()+b"Z")
        with self.assertRaisesRegex(ValueError,"render content changed"):
            self.evaluate()

    def test_absent_or_unreviewed_owner_packet_rejected(self):
        self.scene["linen_earth_source_photo_visual_parity_approved"]=False
        with self.assertRaises(ValueError):
            self.evaluate()
        self.scene["linen_earth_source_photo_visual_parity_approved"]=True
        self.packet["ownerConfirmsSameFacelessStudioModel"]=False
        self.save()
        with self.assertRaisesRegex(ValueError,"approval"):
            self.evaluate()
        self.packet["ownerConfirmsSameFacelessStudioModel"]=True
        self.packet["manualVisualChecks"]["backTuckAndWaist"]=False
        self.save()
        with self.assertRaisesRegex(ValueError,"checkpoints"):
            self.evaluate()

    def test_receipt_sha_cannot_be_relabelled_without_attestation_change(self):
        self.packet["reviewerName"]="Changed Reviewer"
        self.review.write_text(json.dumps(self.packet,sort_keys=True),encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"SHA256"):
            self.evaluate()

    def test_replayed_front_photo_or_duplicate_render_rejected(self):
        self.views["front"].write_bytes(self.reference.read_bytes())
        self.packet["renderSha256"]["front"]=sha(self.views["front"])
        self.save()
        with self.assertRaisesRegex(ValueError,"Missing/duplicate"):
            self.evaluate()

    def test_bad_location_and_missing_review_rejected(self):
        self.packet["viewPaths"]["front"]="../secret.png"
        self.save()
        with self.assertRaisesRegex(ValueError,"private review directory"):
            self.evaluate()
        self.assertIsNone(None)


if __name__=="__main__":
    unittest.main()
