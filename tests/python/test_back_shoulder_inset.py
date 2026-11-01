"""Connected back shoulder insets change real armhole topology, not overlays."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from authored_shirt_panels import N, make_shirt_mesh, _mesh_edges
from authored_shirt_finishing import add_collar_and_cuffs
from authored_shirt_placket import add_raised_front_placket


class GenuineBackShoulderInsetTest(unittest.TestCase):
    def test_both_2_and_3_row_insets_weld_to_source_and_sleeves(self):
        baseline=make_shirt_mesh()
        for rows in (2,3):
            with self.subTest(rows=rows):
                trial=make_shirt_mesh(back_shoulder_inset_rows=rows)
                t=trial["topology"]
                self.assertEqual(t["actualBackShoulderInsetRows"],rows)
                self.assertEqual(t["backShoulderInsetFaceCount"],12*rows)
                self.assertFalse(t["backShoulderInsetMeasuredTailoringApproved"])
                self.assertEqual(t["connectedComponents"],1)
                self.assertEqual(t["windingErrors"],0)
                self.assertEqual(t["nonmanifoldEdges"],0)
                self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
                self.assertEqual(len(trial["faces"]),len(baseline["faces"])+12*rows)
                self.assertEqual(len(trial["vertices"]),len(baseline["vertices"]))
                self.assertEqual(trial["vertices"][:12*N],baseline["vertices"][:12*N])
                self.assertEqual(t["armholeLoopVertexCounts"],{
                    "left_sleeve":34,"right_sleeve":34,
                })
                self.assertEqual(t["armholeSeamEdgeCounts"],{
                    "left_sleeve":34,"right_sleeve":34,
                })
                self.assertEqual(len(set(map(tuple,trial["faces"]))),len(trial["faces"]))
                owners=_mesh_edges(trial["faces"])
                for edges in trial["armholeSeamEdges"].values():
                    for edge in edges:
                        self.assertEqual(len(owners[edge]),2)

    def test_added_back_panels_are_real_contiguous_mesh_faces(self):
        trial=make_shirt_mesh(back_shoulder_inset_rows=3)
        expected=[]
        for row in (5,6,7):
            for j in list(range(0,6))+list(range(26,32)):
                j2=(j+1)%N
                expected.append((row*N+j,row*N+j2,(row+1)*N+j2,(row+1)*N+j))
        faces=set(map(tuple,trial["faces"]))
        self.assertTrue(set(expected).issubset(faces))
        role_face={tuple(f):r for f,r in zip(trial["faces"],trial["roles"])}
        for face in expected:
            self.assertEqual(role_face[face],"back_shoulder_inset")

    def test_placket_collar_and_cuff_seams_still_join(self):
        trial=add_collar_and_cuffs(
            add_raised_front_placket(make_shirt_mesh(back_shoulder_inset_rows=3)))
        t=trial["topology"]
        self.assertEqual(t["connectedComponents"],1)
        self.assertEqual(t["nonmanifoldEdges"],0)
        self.assertEqual(t["windingErrors"],0)
        self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
        self.assertEqual(t["panelFaceCounts"]["back_shoulder_inset"],36)
        self.assertTrue(t["frontPlacketIntegratedPanel"])
        self.assertTrue(t["collarAndCuffTopologyAuthored"])

    def test_invalid_or_unsourced_inset_length_is_rejected(self):
        for rows in (-1,1,4,True,2.5,None,"3"):
            with self.subTest(rows=rows):
                with self.assertRaises(ValueError):
                    make_shirt_mesh(back_shoulder_inset_rows=rows)


if __name__=="__main__":
    unittest.main()
