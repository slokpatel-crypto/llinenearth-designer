"""Static fail-closed contract for diagnostic-only Blender mobile LOD."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
PROBE=(ROOT/"scripts/blender/probe-mobile-lod.py").read_text()
WORKFLOW=(ROOT/".github/workflows/realistic-3d-candidate.yml").read_text()


class RealBodySafeMobileLodDiagnostics(unittest.TestCase):
    def test_temporary_source_clones_and_strict_locked_model(self):
        for token in (
            'EXPECTED_ID="linen-earth-studio-model-v1"',
            'copy=original.copy()',
            'copy.data=original.data.copy()',
            'bpy.data.objects.remove(copy,do_unlink=True)',
            'sourceMeshUnchanged',
            'realBodyUnmodified',
            '"diagnosticOnly":True',
            '"eligibleForProduction":False',
        ):
            self.assertIn(token,PROBE)
        self.assertNotIn('bpy.data.objects.remove(original',PROBE)
        self.assertNotIn('body.data.vertices[',PROBE)

    def test_full_source_shape_and_independent_3d_body_contact_are_not_waived(self):
        for token in (
            'modifier.decimate_type="COLLAPSE"',
            'modifier.use_collapse_triangulate=True',
            'penetrating_surface_samples(',
            'len(points[::vertex_stride][:600])',
            'body_bvh.find_nearest(point)',
            'count%2==1',
            'distance<=0.0015',
            '"mobileTriangleBudget":220000',
            '"mobileVertexBudget":280000',
            'delta_mm=max(',
            '"sampledBVHPass"',
            '"lockedSectionPass"',
            '"polygonBudgetPass"',
        ):
            self.assertIn(token,PROBE)

    def test_experimental_probe_cannot_enable_render_export_or_production_gate(self):
        assert 'name: Probe mobile candidate from immutable source (diagnostic only)' in WORKFLOW
        self.assertIn('--python scripts/blender/probe-mobile-lod.py',WORKFLOW)
        self.assertIn('mobile-lod-diagnostic.json',WORKFLOW)
        self.assertIn('continue-on-error: true',WORKFLOW)
        before=WORKFLOW.index('name: Probe mobile candidate')
        after=WORKFLOW.index('name: Render four-angle fit review',before)
        scope=WORKFLOW[before:after]
        self.assertNotIn('steps.preflight.outcome == \'success\'',scope)
        self.assertIn('if: always()',scope)
        final=WORKFLOW[WORKFLOW.index('name: Enforce candidate gates'):]
        self.assertIn('test "${{ steps.preflight.outcome }}" = "success"',final)
        self.assertIn('test "${{ steps.render.outcome }}" = "success"',final)
        self.assertNotIn('mobile_lod_probe.outcome',final)


if __name__=="__main__":
    unittest.main()
