"""Only original model evidence is eligible for review: never autoapprove a scan."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from canonical_model_source_intake import (
    ANGLES, intake_source, fingerprint, verify_identity_spec
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
    "views":[{"id":v} for v in ANGLES]
}


class SourceIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.reference=self.png("original.png",100)

    def png(self,name,seed):
        file=self.root/name
        file.write_bytes(b"\x89PNG\r\n\x1a\n"+bytes([seed%255])*2048)
        return file

    def model(self):
        file=self.root/"owner-source.blend"
        file.write_bytes(b"BLENDER-v450"+b"\0"*2048)
        return file

    def test_no_owner_source_fails_closed_but_report_is_useful(self):
        data=intake_source(IDENTITY,self.reference)
        self.assertIn("owner_original_photo_matched_blend_not_supplied",data["blockers"])
        self.assertIn("missing_back_independent_view",data["blockers"])
        self.assertFalse(data["readyForIndependentOwnerAndTailorVisualReview"])
        self.assertFalse(data["samePhotographicModelApproved"])
        self.assertFalse(data["customerProductionReady"])

    def test_full_distinct_package_only_means_ready_for_human_review(self):
        files={name:self.png(name+".png",i*19+7) for i,name in enumerate(ANGLES)}
        out=intake_source(IDENTITY,self.reference,self.model(),files)
        self.assertEqual(out["blockers"],[])
        self.assertTrue(out["fourIndependentRendersCollected"])
        self.assertTrue(out["readyForIndependentOwnerAndTailorVisualReview"])
        self.assertFalse(out["sourceFromOwnerPhotoMatchedMasterProven"])
        self.assertFalse(out["samePhotographicModelApproved"])
        self.assertFalse(out["customerProductionReady"])
        self.assertEqual(len(out["sourceRenderFingerprints"]),4)
        self.assertEqual(len(out["sourceBlendFingerprint"]["sha256"]),64)

    def test_canonical_front_copy_and_duplicate_3d_views_rejected(self):
        files={name:self.png(name+".png",i*11+2) for i,name in enumerate(ANGLES)}
        files["front"]=self.reference
        files["side"]=files["back"]
        out=intake_source(IDENTITY,self.reference,self.model(),files)
        self.assertIn("front_is_copy_of_canonical_studio_photo",out["blockers"])
        self.assertIn("back_duplicates_other_supplied_view",out["blockers"])
        self.assertFalse(out["readyForIndependentOwnerAndTailorVisualReview"])

    def test_fake_blend_extension_is_not_a_real_blender_file(self):
        spoof=self.root/"fake.blend"
        spoof.write_bytes(b"NOTBLEND"+b"0"*2048)
        out=intake_source(IDENTITY,self.reference,spoof)
        self.assertIn("source_3d_not_a_blender_file",out["blockers"])

    def test_only_true_png_jpg_webp_signatures_allowed(self):
        bad=self.root/"bad.png"
        bad.write_bytes(b"not_image"*300)
        info,error=fingerprint(bad,"image")
        self.assertIsNone(info)
        self.assertEqual(error,"invalid_image_signature")
        webp=self.root/"photo.webp"
        webp.write_bytes(b"RIFF"+b"0"*4+b"WEBP"+b"0"*2048)
        self.assertIsNone(fingerprint(webp,"image")[1])
        jpeg=self.root/"photo.jpg"
        jpeg.write_bytes(b"\xff\xd8\xff"+b"0"*2048)
        self.assertIsNone(fingerprint(jpeg,"image")[1])

    def test_symlink_to_source_never_accepted(self):
        original=self.model()
        alias=self.root/"alias.blend"
        alias.symlink_to(original)
        self.assertEqual(fingerprint(alias,"blend")[1],"symbolic_link_not_accepted")

    def test_canonical_reference_lock_and_physical_targets(self):
        self.assertTrue(verify_identity_spec(IDENTITY))
        for mismatch in (
            {"version":"other"},
            {"referenceImage":"/designer/other.webp"},
            {"referenceHeightMm":1600},
            {"physicalTargetsMm":{}},
            {"views":[{"id":"front"}]},
        ):
            specimen=json.loads(json.dumps(IDENTITY))
            specimen.update(mismatch)
            with self.subTest(mismatch=mismatch):
                with self.assertRaises(ValueError):
                    verify_identity_spec(specimen)

    def test_missing_image_cannot_be_replaced_with_other_filename(self):
        missing=self.root/"gone.webp"
        with self.assertRaisesRegex(ValueError,"Canonical reference missing"):
            intake_source(IDENTITY,missing)
        with self.assertRaises(ValueError):
            intake_source(IDENTITY,self.reference,views={"other":self.reference})


if __name__=="__main__":
    unittest.main()
