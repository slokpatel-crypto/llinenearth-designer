"""Static fail-closed contract for diagnostic-only Blender mobile LOD."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
PROBE=(ROOT/"scripts/blender/probe-mobile-lod.py").read_text()
WORKFLOW=(ROOT/".github/workflows/realistic-3d-candidate.yml").read_text()
PREFLIGHT=(ROOT/"scripts/blender/preflight-linen-earth-officewear.py").read_text()
AUTHOR=(ROOT/"scripts/blender/author-linen-earth-officewear.py").read_text()


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
            '.length<=0.0015',
            '"mobileTriangleBudget":220000',
            '"mobileVertexBudget":280000',
            'delta_mm=max(',
            '"sampledBVHPass"',
            'def fit_candidate_mobile_contacts(',
            'max_shift_m=0.012, max_passes=6',
            'physical_body_probe(body_bvh,points,tris)',
            'contact["deepFaceOrEdgeHits"]==0 and contact["deepVertexHits"]==0',
            'candidate_point_inside_locked_body(body_bvh,destination)',
            'if total.length>max_shift_m:',
            'if any(abs(current.z-z)<.002 for z in guides)',
            'before_points==[tuple(vertex.co) for vertex in original.data.vertices]',
            'if not copy.data.uv_layers or not original.data.uv_layers:',
            '"boundedContactRepair":repair',
            'for sx,sy,sz in (',
            'for distance in (.003,.005,.007,.009,.011,max_shift_m):',
            'candidate_point_inside_locked_body(body_bvh,destination)',
            'if (destination-measure[0]).length<.002:',
            '"unresolvedContactSamples"',
            '"nearestBodyDepthMm"',

            '"sampledSkinPass":repair["succeeded"]',

            '"lockedSectionPass"',
            '"polygonBudgetPass"',
        ):
            self.assertIn(token,PROBE)

    def test_final_cloth_thickness_is_measured_against_actual_body_triangles(self):
        # SOLIDIFY changes rendered skin-contact triangles AFTER the original
        # source-mesh BVH pass. Do not fake approval from quad/vertex probes.
        for token in (
            'def repair_post_solidify_sleeve_contact(',
            'sampled_mesh_face_indices(len(mesh.loop_triangles),600)',
            'penetrating_surface_samples(points,sample_faces,deep_skin,max_hits=32)',
            'and (value-closest[0]).length>0.0015',
            'point_inside_closed_bvh(tree,value)',
            'if obj.name!="ShirtSleeveLFabric" or not (0<max_patch_m<=0.012)',
            'if any(abs(current.z-z)<0.002 for z in protected_z)',
            'if cumulative.length>max_patch_m:',
            'if iteration==max_passes:',
            '"Final thickened left sleeve still intersects real body',
            'if name=="ShirtSleeveLFabric":',
            '"postSolidifyTriangleContact"',
        ):
            self.assertIn(token,AUTHOR)
        self.assertLess(
            AUTHOR.index("finish_procedural_shell(obj, thickness_m)"),
            AUTHOR.index('face_refinements[name]["postSolidifyTriangleContact"]'),
        )

    def test_unapproved_four_angle_diagnostics_never_unlock_lab_or_production(self):
        before=WORKFLOW.index("name: Render unapproved scene for geometry diagnosis")
        after=WORKFLOW.index("name: Render four-angle fit review",before)
        unapproved=WORKFLOW[before:after]
        early=WORKFLOW[WORKFLOW.index("name: Upload early independent 3D blocking evidence"):before]
        self.assertIn('name: linen-earth-3d-blocking-evidence',early)
        self.assertIn('artifacts/realistic-3d/preflight.json',early)
        self.assertIn('artifacts/realistic-3d/mobile-lod-diagnostic.json',early)
        self.assertIn('if: always() && (steps.assemble.outcome != \'success\' || steps.preflight.outcome != \'success\')',early)
        self.assertIn('timeout --signal=TERM --kill-after=15s 4m',unapproved)
        self.assertIn("if: always() && (steps.assemble.outcome != 'success' || steps.preflight.outcome != 'success')",unapproved)
        self.assertIn("review-unapproved/UNAPPROVED.txt",unapproved)
        self.assertIn("--resolution-x 448 --resolution-y 600",unapproved)
        production=WORKFLOW[after:]
        self.assertIn("steps.preflight.outcome == 'success'",production)
        self.assertIn("steps.review_visibility.outcome == 'success'",production)
        self.assertIn('test "${{ steps.preflight.outcome }}" = "success"',production)
        self.assertNotIn("steps.review_unapproved",production)

    def test_left_sleeve_uses_real_rendered_triangles_for_native_bvh_fit(self):
        self.assertIn('iteration==0 and obj.name=="ShirtSleeveLFabric"',AUTHOR)
        self.assertIn('bmesh.ops.triangulate(',AUTHOR)
        self.assertIn('if len(bm.faces)+len(quads)>80000:',AUTHOR)
        self.assertIn('if giant_faces or triangulated_for_preflight:',AUTHOR)
        self.assertIn('minimumInsideDepthMm',AUTHOR)
        self.assertIn('bounded_source_cloth_shift(',AUTHOR)
        self.assertIn('evaluatedTriangleIndex',PREFLIGHT)
        self.assertIn('triangleVertexIndices',PREFLIGHT)
        self.assertIn('"depthMm":round(',PREFLIGHT)

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
