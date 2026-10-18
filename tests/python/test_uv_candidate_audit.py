"""Pure Python regressions for unapproved source-derived UV diagnostics."""
import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).resolve().parents[2] / "scripts/blender/uv_candidate_audit.py"
spec = importlib.util.spec_from_file_location("uv_candidate_audit", path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

XYZ = ((0,0,0), (1,0,0), (0,0,1))
UV = ((0,0), (1,0), (0,1))


class CandidateUvAuditTests(unittest.TestCase):
    def test_valid_uv_is_not_a_physical_fabric_certificate(self):
        result = audit.audit_uv_triangles([(XYZ, UV)])
        self.assertTrue(result["candidateUvTopologyPass"])
        self.assertEqual(result["noncollapsedTriangleCount"], 1)
        self.assertFalse(result["physicalFabricRepeatVerified"])
        self.assertFalse(result["supplierGrainVerified"])
        self.assertFalse(result["productionApproved"])

    def test_collapsed_uv_is_recorded_and_rejected(self):
        result = audit.audit_uv_triangles([(XYZ, ((0,0),(0,0),(0,0)))])
        self.assertFalse(result["candidateUvTopologyPass"])
        self.assertEqual(result["collapsedUvTriangles"], 1)

    def test_zero_area_geometry_is_not_misdiagnosed_as_uv(self):
        xyz = ((0,0,0),(1,0,0),(2,0,0))
        result = audit.audit_uv_triangles([(xyz, UV)])
        self.assertFalse(result["candidateUvTopologyPass"])
        self.assertEqual(result["degenerateSurfaceTriangles"], 1)

    def test_nonfinite_and_empty_candidates_fail_closed(self):
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([])
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([(XYZ, ((0,0),(float("nan"),0),(0,1)))])
        with self.assertRaises(ValueError):
            audit.audit_uv_triangles([(XYZ, UV)], min_uv_area=0)

    def test_density_tracks_surface_units(self):
        result = audit.audit_uv_triangles([(XYZ, UV)])
        self.assertAlmostEqual(result["medianUvAreaPerSquareMetre"], 1)
        self.assertAlmostEqual(result["p95RelativeUvDensityDeviation"], 0)

    def test_uv_density_variance_is_reported_without_false_approval(self):
        # Same UV area on a physically larger triangle means inconsistent
        # projection density; it must be observable but NEVER supplier-approved.
        wide_xyz = ((0,0,0), (2,0,0), (0,0,1))
        result = audit.audit_uv_triangles([(XYZ, UV), (wide_xyz, UV)])
        self.assertGreater(result["p95RelativeUvDensityDeviation"], 0)
        self.assertFalse(result["physicalFabricRepeatVerified"])
        self.assertFalse(result["productionApproved"])


if __name__ == "__main__":
    unittest.main()
