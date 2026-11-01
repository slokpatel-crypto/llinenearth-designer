"""Regression: collar and cuffs attach to real open shirt edge loops."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from authored_shirt_panels import make_shirt_mesh
from authored_shirt_finishing import add_collar_and_cuffs


class AuthoredShirtFinishingTest(unittest.TestCase):
    def test_collar_and_cuffs_preserve_connected_manifold(self):
        source=make_shirt_mesh()
        finished=add_collar_and_cuffs(source)
        t=finished["topology"]
        self.assertEqual(t["connectedComponents"],1)
        self.assertEqual(t["nonmanifoldEdges"],0)
        self.assertEqual(t["windingErrors"],0)
        self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
        self.assertTrue(t["collarAndCuffTopologyAuthored"])
        self.assertEqual(t["trimSeamEdgeCounts"],
                         {"collar":64,"left_cuff":34,"right_cuff":34})
        self.assertEqual(t["trimFaceCounts"],
                         {"collar":128,"left_cuff":68,"right_cuff":68})
        self.assertEqual(len(finished["faces"]),
                         len(source["faces"])+264)
        self.assertEqual(len(finished["roles"]),len(finished["faces"]))
        self.assertFalse(t["shirtPatternMeasured"])
        self.assertFalse(t["supplierAndTailorVerified"])

    def test_existing_body_and_torso_mesh_vertices_are_unchanged(self):
        original=make_shirt_mesh()
        done=add_collar_and_cuffs(original,collar_height_mm=26,cuff_length_mm=37)
        self.assertEqual(done["vertices"][:len(original["vertices"])],
                         original["vertices"])
        self.assertEqual(done["faces"][:len(original["faces"])],
                         original["faces"])
        self.assertEqual(done["roles"][:len(original["roles"])],
                         original["roles"])

    def test_each_true_open_boundary_is_extended_without_floating_trim(self):
        done=add_collar_and_cuffs(make_shirt_mesh())
        faces=[tuple(f) for f in done["faces"]]
        for role,edges in done["trimRootSeams"].items():
            for edge in edges:
                # Root seam is in two adjacent faces, not floating trim.
                owners=sum(edge[0] in f and edge[1] in f for f in faces)
                self.assertEqual(owners,2,(role,edge))

    def test_unevaluated_dimensions_cannot_be_exaggerated(self):
        for params in (
            {"collar_height_mm":0},{"collar_height_mm":46},
            {"cuff_length_mm":24},{"cuff_length_mm":66},
            {"cuff_length_mm":float("nan")},
        ):
            with self.subTest(params=params):
                with self.assertRaises(ValueError):
                    add_collar_and_cuffs(make_shirt_mesh(),**params)

    def test_missing_original_source_face_data_fails_closed(self):
        with self.assertRaises(ValueError):
            add_collar_and_cuffs({})
        source=make_shirt_mesh()
        source["armholeSeamEdges"]={}
        with self.assertRaises(ValueError):
            add_collar_and_cuffs(source)


if __name__=="__main__":
    unittest.main()
