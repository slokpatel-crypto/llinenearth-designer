"""Regressions for oversized deterministic shoes and truncated foot slices."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from footwear_fit_geometry import shoe_depth_bounds

class ShoeDepthFitTests(unittest.TestCase):
    def test_ankle_slice_does_not_crush_540mm_source_shoe(self):
        samples=[-0.075+0.135*i/31 for i in range(32)]
        low,high=shoe_depth_bounds(samples,1.727)
        self.assertAlmostEqual(high-low,0.155*1.727)
        self.assertGreaterEqual((high-low)/0.540,0.45)
    def test_bilateral_depth_is_symmetric(self):
        left=[-0.070+0.100*i/31 for i in range(32)]
        right=[-0.060+0.130*i/31 for i in range(32)]
        a=shoe_depth_bounds(left,1.727)
        b=shoe_depth_bounds(right,1.727)
        self.assertAlmostEqual(a[1]-a[0],b[1]-b[0])
    def test_longer_measured_foot_is_not_cropped(self):
        samples=[-0.14+0.280*i/31 for i in range(32)]
        low,high=shoe_depth_bounds(samples,1.727)
        self.assertAlmostEqual(high-low,0.308)
    def test_implausible_length_fails_closed(self):
        samples=[-0.20+0.40*i/31 for i in range(32)]
        with self.assertRaisesRegex(ValueError,"implausible"):
            shoe_depth_bounds(samples,1.727)
    def test_bad_evidence_fails_closed(self):
        samples=[0.001*i for i in range(32)]
        for points,stature in ((samples[:19],1.727),(samples+[math.nan],1.727),(samples,0.0)):
            with self.subTest(count=len(points),stature=stature):
                with self.assertRaises(ValueError):
                    shoe_depth_bounds(points,stature)

if __name__=="__main__":
    unittest.main()
