"""Source face band partitions conserve all true authored garment faces."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from shirt_spatial_contact import group_actual_source_faces_by_height,source_height_band


class SourceBandTests(unittest.TestCase):
    def test_every_source_face_in_exactly_one_spatial_group(self):
        verts=[(0,0,1.08),(1,0,1.08),(0,1,1.08),
               (0,0,1.19),(1,0,1.19),(0,1,1.19),
               (0,0,1.30),(1,0,1.30),(0,1,1.30),
               (0,0,1.43),(1,0,1.43),(0,1,1.43)]
        faces=[(0,1,2),(3,4,5),(6,7,8),(9,10,11)]
        roles=["back","back","left_sleeve","right_sleeve"]
        got=group_actual_source_faces_by_height(verts,faces,roles)
        self.assertEqual(got,{
            "back@hem":[0],"back@waist":[1],
            "left_sleeve@underarm":[2],"right_sleeve@shoulder":[3]
        })
        self.assertEqual(sorted(i for seq in got.values() for i in seq),
                         list(range(len(faces))))

    def test_non_watch_roles_are_not_reassigned(self):
        verts=[(0,0,1.4),(1,0,1.4),(0,1,1.4)]
        self.assertEqual(group_actual_source_faces_by_height(
            verts,[(0,1,2)],["placket"]),{"placket":[0]})

    def test_invalid_source_fails_without_fake_zero(self):
        bad=[([(0,0,1)],[(0,1,3)],["back"]),
             ([(0,0,float("nan"))]*3,[(0,1,2)],["back"]),
             ([(0,0,1)]*3,[(0,1,2)],[]),
             ([(0,0,1)]*3,[(0,1,2)],[""])]
        for verts,faces,roles in bad:
            with self.subTest(roles=roles,faces=faces):
                with self.assertRaises(ValueError):
                    group_actual_source_faces_by_height(verts,faces,roles)
        with self.assertRaises(ValueError):
            source_height_band(float("inf"))


if __name__=="__main__":
    unittest.main()
