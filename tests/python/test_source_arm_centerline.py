"""Body-vertex-slice arm centreline is real, symmetric, bounded evidence."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from source_arm_centerline import sample_scanned_arm_path


class SourceArmSamplingTests(unittest.TestCase):
    def setUp(self):
        self.points=[]
        for i in range(6):
            z=1.245-(.26*i/5)
            for side in (-1,1):
                for j in range(30):
                    self.points.append((side*(.310 + ((j%7)-3)*.008),
                                        ((j%5)-2)*.014,
                                        z+(j%3-1)*.002))
            # Body torso/hip distractors: should not own sleeve position.
            for j in range(24):
                self.points.append((.12 + j*.003,0,z))

    def test_source_body_positions_both_sleeves_without_changing_body(self):
        before=tuple(self.points)
        left=sample_scanned_arm_path(self.points,"left_sleeve",(-.21,0,1.31))
        right=sample_scanned_arm_path(self.points,"right_sleeve",(.21,0,1.31))
        self.assertEqual(before,tuple(self.points))
        self.assertEqual(len(left["centerline"]),5)
        self.assertEqual(len(right["centerline"]),5)
        self.assertTrue(all(x<-.26 for x,_,_ in left["centerline"]))
        self.assertTrue(all(x>.26 for x,_,_ in right["centerline"]))
        self.assertTrue(all(a[2]>b[2] for a,b in zip(left["centerline"],left["centerline"][1:])))
        self.assertFalse(left["originalPhotoIdentityProven"])
        self.assertFalse(left["fabricAndTailorFitApproved"])

    def test_lost_scan_section_fails_instead_of_inventing_wrist(self):
        with self.assertRaises(ValueError):
            sample_scanned_arm_path(self.points[:80],"left_sleeve",(-.21,0,1.31))

    def test_invalid_root_or_side_does_not_cross_assign_sleeves(self):
        for side,root in (
            ("left_sleeve",(.21,0,1.31)),
            ("right_sleeve",(-.21,0,1.31)),
            ("sleeve",(.21,0,1.31)),
            ("right_sleeve",(.21,0,1.12)),
            ("right_sleeve",(.21,0,float("nan"))),
        ):
            with self.subTest(side=side,root=root):
                with self.assertRaises(ValueError):
                    sample_scanned_arm_path(self.points,side,root)

    def test_non_finite_source_or_unsupported_sampling_is_rejected(self):
        with self.assertRaises(ValueError):
            sample_scanned_arm_path(self.points+[(float("nan"),0,1)],
                                    "right_sleeve",(.21,0,1.31))
        with self.assertRaises(ValueError):
            sample_scanned_arm_path(self.points,"right_sleeve",(.21,0,1.31),
                                    sample_half_band_m=.10)


if __name__=="__main__":
    unittest.main()
