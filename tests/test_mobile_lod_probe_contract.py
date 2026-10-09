"""Static fail-closed contract for diagnostic-only Blender mobile LOD."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
PROBE=(ROOT/"scripts/blender/probe-mobile-lod.py").read_text()
WORKFLOW=(ROOT/".github/workflows/realistic-3d-candidate.yml").read_text()
PREFLIGHT=(ROOT/"scripts/blender/preflight-linen-earth-officewear.py").read_text()
AUTHOR=(ROOT/"scripts/blender/author-linen-earth-officewear.py").read_text()
EXPORT=(ROOT/"scripts/blender/export-linen-earth-officewear.py").read_text()
RENDER=(ROOT/"scripts/blender/render-linen-earth-officewear-review.py").read_text()


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

    def test_contact_safe_fidelity_trials_do_not_weaken_identity_or_budget(self):
        # Real October 9 Blender evidence: source guards cleared LEFT leg,
        # right sleeve still clipped or shifted its locked guide by 4.267mm.
        # Test more of the SAME original cloth before any 12mm repair, but
        # accept only independent zero-hit BVH + <=2mm guide fidelity.
        for token in (
            'def adaptive_contact_safe_ratio_trial(',
            'for ratio in (.265, .30, .34):',
            'trial=original.copy()',
            'trial.data=original.data.copy()',
            'modifier.decimate_type="COLLAPSE"',
            'modifier.use_collapse_triangulate=True',
            'max(\n                abs(span[i]-source_span[i]) for i in (0,1)',
            '"lockedGuidesPass":guide_shift<=2.0',
            'fit_candidate_mobile_contacts(trial,body_bvh,guides)',
            'physical_body_probe(body_bvh,points,triangles)',
            '"independentlySkinSafe"',
            'repair["succeeded"] and body_contact["deepFaceOrEdgeHits"]==0',
            'if not trial.data.uv_layers:',
            '"effectiveReductionRatio":measured_ratio',
            '"higherSourceFidelityTrials":higher_ratio',
            'target_tris<=220000 and target_verts<=280000',
            '"eligibleForProduction":False',
        ):
            self.assertIn(token,PROBE,token)
        self.assertNotIn("ratio=0.50",PROBE)
        self.assertNotIn("original.data=trial.data",PROBE)

    def test_mobile_lod_is_saved_separately_and_independently_preflighted_without_promotion(self):
        for token in (
            'parser.add_argument("--diagnostic-scene"',
            'if cfg.diagnostic_scene and preliminary_guide_pass and preliminary_skin_pass and preliminary_budget_pass:',
            'if destination==Path(bpy.data.filepath).resolve():',
            'bpy.context.scene["linen_earth_derived_mobile_lod_unapproved"]=True',
            'bpy.context.scene["linen_earth_mobile_lod_diagnostic_only"]=True',
            'bpy.ops.wm.save_as_mainfile(filepath=str(destination),check_existing=False)',
            '"diagnosticSceneSavedForIndependentPreflight":diagnostic_scene_written',
            '"independentFullPreflightPassed":False',
            '"eligibleForProduction":False',
        ):
            self.assertIn(token,PROBE,token)
        independent=WORKFLOW[WORKFLOW.index("name: Independently preflight mobile LOD (UNAPPROVED evidence only)"):]
        self.assertIn('mobile-lod-independent-preflight.json',independent)
        self.assertIn('--python scripts/blender/preflight-linen-earth-officewear.py',independent)
        self.assertIn('--diagnostic-scene artifacts/realistic-3d/mobile-lod-unapproved.blend',WORKFLOW)
        self.assertIn('continue-on-error: true',independent)
        gate=WORKFLOW[WORKFLOW.index('name: Enforce candidate gates'):]
        self.assertNotIn('mobile_independent_preflight.outcome',gate)
        self.assertNotIn('mobile-lod-unapproved.blend',gate)
        # The production authoring .blend is never overwritten by this probe.
        self.assertIn('bpy.data.objects.remove(authored,do_unlink=True)',PROBE)
        self.assertIn('diagnostic_scene_written=destination.is_file()',PROBE)

    def test_derived_lod_retains_export_slots_but_can_never_export_as_production(self):
        self.assertIn('for collection in tuple(authored.users_collection):',PROBE)
        self.assertIn('collection.objects.link(selected)',PROBE)
        self.assertIn('selected.name=name',PROBE)
        self.assertIn('linen_earth_derived_mobile_lod_unapproved',PROBE)
        self.assertIn('if bool(bpy.context.scene.get("linen_earth_derived_mobile_lod_unapproved",False)) and not args.lab_preview:',EXPORT)
        self.assertIn('production GLB export is forbidden',EXPORT)
        self.assertIn('preflight_report = run_scene_preflight()',EXPORT)
        self.assertIn('geometry_panel_spec() if args.lab_preview else None',EXPORT)

    def test_mobile_lab_asset_requires_separate_green_preflight_and_never_promotes(self):
        marker='name: Export mobile LOD GLB for LAB ONLY after independent BVH preflight'
        self.assertIn(marker,WORKFLOW)
        section=WORKFLOW[WORKFLOW.index(marker):WORKFLOW.index('name: Upload early independent 3D blocking evidence')]
        for token in (
            "steps.mobile_independent_preflight.outcome == 'success'",
            'data.get("ready") is True',
            'totals.get("triangles")',
            'totals.get("vertices")',
            'scripts/blender/export-linen-earth-officewear.py',
            '--lab-preview --output artifacts/realistic-3d/mobile-lod-LAB-UNAPPROVED.glb',
            "LAB-only diagnostic GLB exported, NOT approved",
        ):
            self.assertIn(token,section,token)
        gate=WORKFLOW[WORKFLOW.index("name: Enforce candidate gates"):]
        self.assertNotIn("mobile_lab_export",gate)
        self.assertNotIn("mobile-lod-LAB-UNAPPROVED.glb",gate)

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

    def test_real_blender_review_does_not_render_all_586_tailoring_variants_at_once(self):
        # Real native candidate looked like a striped overlapping shell
        # because Blender import gave every alternate mesh hide_render=False.
        # Quality review must show a neutral, measured six-panel garment only,
        # never every available collar/sleeve/trouser geometry at once.
        for token in (
            'def isolate_neutral_six_panel_fit_review():',
            'bool(obj.get("linen_earth_tailoring_variant",False))',
            'obj.hide_render=True',
            'obj.hide_render=False',
            'hidden_alternates = isolate_neutral_six_panel_fit_review()',
            'review-geometry-provenance.json',
            '"selectedTailoringRecipeVerified":False',
            '"referencePhotoVisualParityApproved":False',
        ):
            self.assertIn(token,RENDER,token)
        self.assertLess(
            RENDER.index('hidden_alternates = isolate_neutral_six_panel_fit_review()'),
            RENDER.index('    configure_scene(options)'),
            "Baking all geometry before isolation would invalidate the four-angle review."
        )
        # Source tailoring geometry is retained in the exported customer GLB;
        # render-only isolation cannot quietly remove a style variation.
        self.assertIn('EXPORT_COLLECTION = "LinenEarthExport"',EXPORT)
        self.assertNotIn('bpy.data.objects.remove(obj',RENDER)

    def test_unapproved_mobile_four_angle_workbench_cannot_masquerade_as_premium_render(self):
        diagnostic=WORKFLOW[
            WORKFLOW.index("name: Render unapproved scene for geometry diagnosis"):
            WORKFLOW.index("name: Render four-angle fit review")
        ]
        for token in (
            'scene="artifacts/realistic-3d/mobile-lod-unapproved.blend"',
            'steps.mobile_independent_preflight.outcome',
            'scene=".cache/linen-earth/linen-earth-officewear-authored.blend"',
            'scripts/blender/diagnose-unapproved-cpu-silhouettes.py',
            '--unapproved',
            'review-unapproved/UNAPPROVED.txt',
            'timeout --signal=TERM --kill-after=15s 4m',
        ):
            self.assertIn(token,diagnostic,token)
        cpu=(ROOT/"scripts/blender/diagnose-unapproved-cpu-silhouettes.py").read_text()
        for token in (
            'parser.add_argument("--unapproved",action="store_true",required=True)',
            'for name,yaw in VIEWS:',
            'mesh.calc_loop_triangles()',
            'evaluated.to_mesh_clear()',
            '"visualApproval":False',
            'physicalFabricRepeatVerified',
            'UNAPPROVED',
            'geometry.svg',
        ):
            self.assertIn(token,cpu,token)
        production=WORKFLOW[WORKFLOW.index("name: Render four-angle fit review"):]
        self.assertIn("steps.preflight.outcome == 'success'",production)
        self.assertIn('npm run garment:model-production:render-review',production)
        self.assertNotIn('--diagnostic-workbench',production)
        self.assertNotIn('steps.mobile_independent_preflight.outcome',production)

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
