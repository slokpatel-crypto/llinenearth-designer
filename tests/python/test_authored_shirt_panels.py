"""Non-Blender acceptance for genuinely connected authored shirt panel topology."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts/blender"))
from authored_shirt_panels import make_shirt_mesh, PROFILE, ROLE_NAMES, boundary_loops


class AuthoredShirtPatternTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mesh=make_shirt_mesh()
        cls.topo=cls.mesh["topology"]

    def test_one_connected_manifold_with_four_intended_openings(self):
        t=self.topo
        self.assertEqual(t["connectedComponents"],1)
        self.assertEqual(t["nonmanifoldEdges"],0)
        self.assertEqual(t["windingErrors"],0)
        self.assertEqual(t["boundaryLoopsAfterSleeves"],4)
        self.assertEqual(t["boundaryEdgeCount"],sum(t["boundaryLoopVertexCounts"]))

    def test_both_armholes_have_exact_welded_seam_edges(self):
        t=self.topo
        for side in ("left_sleeve","right_sleeve"):
            self.assertGreater(t["armholeLoopVertexCounts"][side],20)
            self.assertEqual(t["armholeSeamEdgeCounts"][side],
                             t["armholeLoopVertexCounts"][side])
            self.assertGreater(t["panelFaceCounts"][side],0)
        self.assertEqual(len(self.mesh["armholeSeamEdges"]["left_sleeve"]),
                         len(set(self.mesh["armholeSeamEdges"]["left_sleeve"])))

    def test_real_front_back_yoke_surfaces_have_quads(self):
        self.assertEqual(len(self.mesh["faces"]),len(self.mesh["roles"]))
        self.assertEqual(set(self.mesh["roles"]),set(ROLE_NAMES))
        for piece in ("front","back","yoke"):
            self.assertGreater(self.topo["panelFaceCounts"][piece],0)
        self.assertTrue(all(len(face)==4 for face in self.mesh["faces"]))

    def test_positions_are_finite_and_bounds_explicitly_unverified(self):
        self.assertTrue(all(all(math.isfinite(x) for x in xyz)
                            for xyz in self.mesh["vertices"]))
        self.assertFalse(self.topo["supplierMeasurementsApproved"])
        self.assertFalse(self.topo["realModelPoseParityApproved"])
        self.assertTrue(all(PROFILE[i][0]<PROFILE[i+1][0]
                            for i in range(len(PROFILE)-1)))

    def test_missing_sleeve_cannot_claim_completed_pattern(self):
        damaged=make_shirt_mesh(omit_sleeve="left_sleeve")
        self.assertEqual(damaged["topology"]["panelFaceCounts"].get("left_sleeve",0),0)
        self.assertEqual(damaged["topology"]["boundaryLoopsAfterSleeves"],4)
        self.assertGreater(damaged["topology"]["armholeSeamEdgeCounts"]["left_sleeve"],0)

    def test_upper_chest_shape_trial_changes_actual_mesh_not_waist_or_neck(self):
        first=make_shirt_mesh()
        trial=make_shirt_mesh(upper_ease_mm=18,cuff_radius_mm=75)
        self.assertEqual(first["topology"]["polygonCount"],
                         trial["topology"]["polygonCount"])
        self.assertEqual(first["topology"]["connectedComponents"],1)
        self.assertEqual(trial["topology"]["connectedComponents"],1)
        self.assertEqual(trial["topology"]["windingErrors"],0)
        self.assertEqual(trial["topology"]["nonmanifoldEdges"],0)
        self.assertEqual(trial["topology"]["boundaryLoopsAfterSleeves"],4)
        # First 64 vertices are the fixed tucked hem. Last torso ring at
        # the neck is also unchanged. The chest is intentionally larger.
        self.assertEqual(first["vertices"][:64],trial["vertices"][:64])
        self.assertEqual(first["vertices"][11*64:12*64],
                         trial["vertices"][11*64:12*64])
        self.assertNotEqual(first["vertices"][6*64],
                            trial["vertices"][6*64])
        self.assertFalse(trial["topology"]["supplierMeasurementsApproved"])

    def test_unbounded_or_nonfinite_shape_cannot_be_called_measured_fit(self):
        for kwargs in (
            {"upper_ease_mm":-1}, {"upper_ease_mm":31},
            {"upper_ease_mm":float("nan")},
            {"cuff_radius_mm":59}, {"cuff_radius_mm":91},
            {"cuff_radius_mm":float("inf")},
        ):
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    make_shirt_mesh(**kwargs)

    def test_measured_source_scan_path_moves_sleeves_not_shirt_torso(self):
        base=make_shirt_mesh()
        paths={}
        for side in ("left_sleeve","right_sleeve"):
            verts=sorted({i for e in base["armholeSeamEdges"][side] for i in e})
            root=[sum(base["vertices"][i][axis] for i in verts)/len(verts)
                  for axis in range(3)]
            sign=-1 if side=="left_sleeve" else 1
            paths[side]=[
                (sign*(.300+.010*step),.01,
                 root[2]+(.985-root[2])*step/5)
                for step in range(1,6)
            ]
        fitted=make_shirt_mesh(source_arm_centerlines=paths)
        self.assertEqual(fitted["topology"]["connectedComponents"],1)
        self.assertEqual(fitted["topology"]["nonmanifoldEdges"],0)
        self.assertEqual(fitted["topology"]["windingErrors"],0)
        self.assertEqual(fitted["topology"]["boundaryLoopsAfterSleeves"],4)
        self.assertTrue(fitted["topology"]["genericSourceScanArmPathUsed"])
        self.assertFalse(fitted["topology"]["canonicalPhotoModelArmPoseVerified"])
        self.assertEqual(fitted["vertices"][:64*12],base["vertices"][:64*12])
        self.assertNotEqual(fitted["vertices"][-1],base["vertices"][-1])

    def test_orthogonal_source_section_rings_keep_authored_shirt_sewn(self):
        old=make_shirt_mesh()
        sections={}
        for side in ("left_sleeve","right_sleeve"):
            sign=-1 if side=="left_sleeve" else 1
            root_indices=sorted({v for edge in old["armholeSeamEdges"][side] for v in edge})
            root_z=sum(old["vertices"][i][2] for i in root_indices)/len(root_indices)
            sections[side]=[
                {"centerM":(sign*(.260+.024*i),0.01,
                            root_z+(.985-root_z)*(i+1)/5),
                 "basisFront":(0.,1.,0.),
                 "basisSide":(1.,0.,0.),
                 "radiusM":.069,
                 "sourceMeasured":True}
                for i in range(5)
            ]
        candidate=make_shirt_mesh(source_arm_sections=sections)
        self.assertEqual(old["vertices"][:64*12],candidate["vertices"][:64*12])
        self.assertNotEqual(old["vertices"][-1],candidate["vertices"][-1])
        self.assertTrue(candidate["topology"]["bodySectionTangentRadiusCalibrated"])
        self.assertFalse(candidate["topology"]["canonicalPhotoModelArmPoseVerified"])
        self.assertEqual(candidate["topology"]["connectedComponents"],1)
        self.assertEqual(candidate["topology"]["nonmanifoldEdges"],0)
        self.assertEqual(candidate["topology"]["windingErrors"],0)
        self.assertEqual(candidate["topology"]["boundaryLoopsAfterSleeves"],4)

    def test_missing_source_section_does_not_silently_use_guessed_pose(self):
        with self.assertRaises(ValueError):
            make_shirt_mesh(source_arm_sections={})
        with self.assertRaises(ValueError):
            make_shirt_mesh(source_arm_sections={
                "left_sleeve":[{}]*5,"right_sleeve":[{}]*5})
        with self.assertRaises(ValueError):
            make_shirt_mesh(source_arm_sections={
                "left_sleeve":[{}]*5,"right_sleeve":[{}]*5},
                source_arm_centerlines={})

    def test_invalid_body_arm_path_fails_not_fallback_to_guess(self):
        source=make_shirt_mesh()
        for paths in ({}, {"left_sleeve":[(0,0,1)]*5},
                      {"left_sleeve":[(0,0,1)]*5,
                       "right_sleeve":[(0,0,float("nan"))]*5}):
            with self.subTest(paths=paths):
                with self.assertRaises(ValueError):
                    make_shirt_mesh(source_arm_centerlines=paths)

    def test_invalid_sleeve_request_is_rejected(self):
        with self.assertRaises(ValueError):
            make_shirt_mesh(omit_sleeve="tailored_already")


if __name__=="__main__":
    unittest.main()
