"""Section radius and transverse frame are computed from real source samples."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from source_sleeve_sections import build_source_sleeve_sections


def fixture(side):
    sign=-1 if side=="left_sleeve" else 1
    zvals=(1.281,1.207,1.133,1.059,.985)
    xs=(.263,.288,.315,.352,.375)
    centers=[(sign*x,.012,z) for x,z in zip(xs,zvals)]
    body=[]
    for center in centers:
        for i in range(48):
            phi=math.pi*2*i/48
            body.append((center[0]+.052*math.cos(phi),
                         center[1]+.052*math.sin(phi),
                         center[2]+.001*((i%3)-1)))
    return body,{
        "side":side,"rootCenterM":(sign*.183,0,1.355),
        "centerline":centers,"sourceBasedArmPose":True
    }


class SourceSleeveSectionTests(unittest.TestCase):
    def test_real_circle_samples_yield_finite_orthogonal_frames(self):
        for side in ("left_sleeve","right_sleeve"):
            with self.subTest(side=side):
                body,receipt=fixture(side)
                original=list(body)
                sections=build_source_sleeve_sections(body,receipt)
                self.assertEqual(body,original)
                self.assertEqual(len(sections),5)
                for section in sections:
                    self.assertGreater(section["realScanVertexCount"],12)
                    self.assertGreater(section["radiusM"],.044)
                    self.assertLess(section["radiusM"],.083)
                    self.assertTrue(section["sourceMeasured"])
                    self.assertFalse(section["photographicPoseVerified"])
                    tangent=section["tangent"]
                    front=section["basisFront"]
                    lateral=section["basisSide"]
                    dot=lambda a,b:sum(x*y for x,y in zip(a,b))
                    self.assertAlmostEqual(dot(tangent,front),0,places=5)
                    self.assertAlmostEqual(dot(tangent,lateral),0,places=5)
                    self.assertAlmostEqual(dot(front,lateral),0,places=5)
                    for vector in (tangent,front,lateral):
                        self.assertAlmostEqual(dot(vector,vector),1,places=5)

    def test_missing_or_nan_scan_data_fails_without_pose_fallback(self):
        body,receipt=fixture("right_sleeve")
        for invalid in (
            {},{"side":"left_sleeve","sourceBasedArmPose":False},
            {**receipt,"centerline":receipt["centerline"][:4]},
            {**receipt,"centerline":[(float("nan"),0,1)]*5},
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    build_source_sleeve_sections(body,invalid)
        with self.assertRaises(ValueError):
            build_source_sleeve_sections(body+[(float("nan"),0,1)],receipt)

    def test_clearance_envelope_stays_bounded_unmeasured(self):
        body,receipt=fixture("right_sleeve")
        for wrong in (0,1,8,True,float("inf")):
            with self.subTest(wrong=wrong):
                with self.assertRaises(ValueError):
                    build_source_sleeve_sections(body,receipt,clearance_mm=wrong)
        a=build_source_sleeve_sections(body,receipt,clearance_mm=2)
        b=build_source_sleeve_sections(body,receipt,clearance_mm=6)
        for s0,s1 in zip(a,b):
            self.assertAlmostEqual(s1["radiusM"]-s0["radiusM"],.004)


if __name__=="__main__":
    unittest.main()
