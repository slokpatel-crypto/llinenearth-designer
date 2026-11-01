"""Source-based back waist seam candidate: preserve fitted sleeves and source."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))

from authored_shirt_panels import make_shirt_mesh, N
from authored_shirt_placket import add_raised_front_placket
from authored_shirt_finishing import add_collar_and_cuffs
from back_waist_source_trial import construct_back_waist_trial


def waistband_fixture():
    # Model independent source posterior contour with 5 axial rings of
    # actual sampled positions. Not a measured supplier/tailor pattern.
    points=[]
    for z in (.96,1.0,1.04,1.08,1.12):
        for i in range(90):
            theta=2*math.pi*i/90
            x=.191*math.cos(theta)
            y=.141*math.sin(theta)
            points.append((x,y,z))
    return points


class BackWaistSourceTrialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pattern=add_collar_and_cuffs(
            add_raised_front_placket(make_shirt_mesh()))

    def test_inside_and_outside_repair_source_back_only(self):
        orig=self.pattern
        data=waistband_fixture()
        unchangedWaist=list(data)
        oldVerts=tuple(orig["vertices"])
        for side in ("inside","outside"):
            with self.subTest(side=side):
                trial=construct_back_waist_trial(orig,data,side=side)
                t=trial["topology"]
                self.assertEqual(t["connectedComponents"],1)
                self.assertEqual(t["nonmanifoldEdges"],0)
                self.assertEqual(t["windingErrors"],0)
                self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
                self.assertEqual(t["backWaistSourceContourTrial"],side)
                self.assertEqual(len(trial["backWaistModifiedOriginalVertexIds"]),75)
                self.assertEqual(trial["faces"],orig["faces"])
                self.assertEqual(trial["roles"],orig["roles"])
                self.assertEqual(trial["vertices"][3*N:],orig["vertices"][3*N:])
                self.assertEqual(len(trial["backWaistMeasuredSourceObservations"]),25)
                self.assertFalse(t["backWaistAuthoritativeFitApproved"])
        self.assertEqual(tuple(orig["vertices"]),oldVerts)
        self.assertEqual(data,unchangedWaist)

    def test_real_source_back_points_adjust_and_side_seams_preserved(self):
        trial=construct_back_waist_trial(self.pattern,waistband_fixture())
        for row in range(3):
            for j in (0,1,2,3,29,30,31,32,47,48,63):
                self.assertEqual(trial["vertices"][row*N+j],
                                 self.pattern["vertices"][row*N+j])
        self.assertNotEqual(trial["vertices"][16],
                            self.pattern["vertices"][16])

    def test_missing_unmeasured_or_invalid_source_fails_closed(self):
        data=waistband_fixture()
        for kwargs in (
            {"side":"unknown"},{"clearance_mm":0},
            {"clearance_mm":7},{"clearance_mm":float("inf")},
            {"max_panel_shift_mm":50},{"max_panel_shift_mm":float("nan")},
        ):
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    construct_back_waist_trial(self.pattern,data,**kwargs)
        for bad in ([], [(0,.15,1)]*10,
                    [(0,-.16,1)]*70,
                    data+[(float("nan"),.1,1)]):
            with self.subTest(length=len(bad)):
                with self.assertRaises(ValueError):
                    construct_back_waist_trial(self.pattern,bad)

    def test_original_sleeve_seam_edge_ids_exactly_preserved(self):
        trial=construct_back_waist_trial(self.pattern,waistband_fixture())
        self.assertEqual(trial["armholeSeamEdges"],
                         self.pattern["armholeSeamEdges"])
        self.assertEqual(trial["trimRootSeams"],
                         self.pattern["trimRootSeams"])
        self.assertEqual(trial["placketSeamEdges"],
                         self.pattern["placketSeamEdges"])


if __name__=="__main__":
    unittest.main()
