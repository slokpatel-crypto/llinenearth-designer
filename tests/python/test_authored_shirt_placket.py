"""Connected front placket: no duplicate cloth, open hole or loose border."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))

from authored_shirt_panels import make_shirt_mesh, N, _mesh_edges
from authored_shirt_placket import add_raised_front_placket
from authored_shirt_finishing import add_collar_and_cuffs


class RaisedFrontPlacketTest(unittest.TestCase):
    def test_integrated_placket_has_shared_original_edges(self):
        old=make_shirt_mesh()
        new=add_raised_front_placket(old)
        t=new["topology"]
        self.assertTrue(t["frontPlacketIntegratedPanel"])
        self.assertTrue(t["frontPlacketNotOpenButtonClosure"])
        self.assertFalse(t["frontPlacketDimensionsMeasured"])
        self.assertEqual(t["connectedComponents"],1)
        self.assertEqual(t["nonmanifoldEdges"],0)
        self.assertEqual(t["windingErrors"],0)
        self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
        self.assertEqual(t["frontPlacketQuadrilateralFaceCount"],14)
        self.assertEqual(t["frontPlacketBorderEdgeCounts"],{"left":7,"right":7})
        self.assertEqual(t["frontPlacketRidgeEdgeCount"],7)
        self.assertEqual(t["panelFaceCounts"]["placket"],14)
        self.assertEqual(len(new["faces"]),len(old["faces"]))
        self.assertEqual(len(new["vertices"]),len(old["vertices"]))
        self.assertEqual(new["faces"],old["faces"])
        self.assertEqual(len(new["roles"]),len(new["faces"]))
        mesh_edges=_mesh_edges(new["faces"])
        for edges in new["placketSeamEdges"].values():
            self.assertTrue(all(len(mesh_edges[edge])==2 for edge in edges))

    def test_placket_moves_only_intended_center_vertices_forward(self):
        old=make_shirt_mesh()
        new=add_raised_front_placket(old)
        moved=set(new["placketMovedSourceVertexIds"])
        self.assertEqual(moved,{row*N+48 for row in range(4,12)})
        for i,(before,after) in enumerate(zip(old["vertices"],new["vertices"])):
            if i in moved:
                self.assertEqual(before[0],after[0])
                self.assertEqual(before[2],after[2])
                self.assertLess(after[1],before[1])
            else:
                self.assertEqual(before,after)
        self.assertFalse(new["topology"]["frontPlacketDimensionsMeasured"])

    def test_collar_cuffs_still_join_a_placket_pattern(self):
        result=add_collar_and_cuffs(
            add_raised_front_placket(make_shirt_mesh()))
        t=result["topology"]
        self.assertTrue(t["frontPlacketIntegratedPanel"])
        self.assertTrue(t["collarAndCuffTopologyAuthored"])
        self.assertEqual(t["connectedComponents"],1)
        self.assertEqual(t["windingErrors"],0)
        self.assertEqual(t["nonmanifoldEdges"],0)
        self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
        self.assertEqual(t["trimFaceCounts"],{
            "collar":128,"left_cuff":68,"right_cuff":68
        })

    def test_invalid_missing_placket_geometry_fails(self):
        with self.assertRaises(ValueError):
            add_raised_front_placket({})
        for value in (float("nan"),float("inf"),-2,0,7,True):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    add_raised_front_placket(make_shirt_mesh(),projection_mm=value)
        with self.assertRaises(ValueError):
            add_raised_front_placket(make_shirt_mesh(),first_ring=2)
        with self.assertRaises(ValueError):
            add_raised_front_placket(make_shirt_mesh(),last_ring=7)

    def test_original_source_mesh_not_mutated(self):
        original=make_shirt_mesh()
        before=(tuple(original["vertices"]),tuple(original["faces"]),
                tuple(original["roles"]))
        add_raised_front_placket(original)
        self.assertEqual(before,(
            tuple(original["vertices"]),tuple(original["faces"]),
            tuple(original["roles"]),
        ))

if __name__=="__main__":
    unittest.main()
