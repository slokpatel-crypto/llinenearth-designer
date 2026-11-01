"""Deterministic tests for single-topology source region meshing."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from connected_shirt_source import classify_shirt_face,analyze_labelled_faces


class SourceShirtTest(unittest.TestCase):
    def test_prior_shoulder_overlap_is_assigned_once_to_torso(self):
        # Anatomical height window where source torso and sleeves overlap.
        # Earlier separate-shell authoring duplicated this region.
        self.assertEqual(classify_shirt_face((-.17,0,.84),0,0,1),"torso")
        self.assertEqual(classify_shirt_face((-.30,0,.84),0,0,1),"left_sleeve")
        self.assertEqual(classify_shirt_face((.30,0,.84),0,0,1),"right_sleeve")

    def test_hand_lower_zone_not_shirt(self):
        self.assertIsNone(classify_shirt_face((-.26,0,.48),0,0,1))
        self.assertIsNone(classify_shirt_face((0,0,.91),0,0,1))

    def test_exact_shared_edges_form_a_single_shoulder(self):
        # Counterclockwise adjacent quads share unmodified edge vertex IDs.
        faces=[(0,1,4,3),(1,2,5,4),(3,4,7,6),(4,5,8,7)]
        labels=["left_sleeve","torso","left_sleeve","torso"]
        result=analyze_labelled_faces(faces,labels)
        self.assertEqual(result["connectedComponents"],1)
        self.assertEqual(result["sourceEdgeSeamCount"],2)
        self.assertEqual(result["sourceSeamRegionPairs"],{"left_sleeve/torso":2})
        self.assertEqual(result["sourceNonmanifoldEdges"],0)
        self.assertEqual(result["sharedEdgeWindingErrors"],0)
        self.assertEqual(result["sourceOpenBoundaryEdges"],8)

    def test_disconnected_approximated_shoulders_cannot_pass(self):
        result=analyze_labelled_faces([(0,1,2),(3,4,5)],["torso","left_sleeve"])
        self.assertEqual(result["sourceEdgeSeamCount"],0)
        self.assertEqual(result["connectedComponents"],2)

    def test_bad_winding_cannot_be_masked_by_shared_edge(self):
        result=analyze_labelled_faces([(0,1,2),(1,2,3)],["torso","left_sleeve"])
        self.assertEqual(result["sharedEdgeWindingErrors"],1)

    def test_invalid_faces_fail_closed(self):
        for faces in [[(0,1,1)],[(0,1,2),(2,1,0)],[(0,1,-1)]]:
            with self.subTest(faces=faces):
                with self.assertRaises(ValueError):
                    analyze_labelled_faces(faces,["torso"]*len(faces))
        with self.assertRaises(ValueError):
            classify_shirt_face((float('nan'),0,1),0,0,1)


if __name__=="__main__":
    unittest.main()
