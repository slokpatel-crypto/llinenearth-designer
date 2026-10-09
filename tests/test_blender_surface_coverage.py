"""Blender-independent collision-envelope tests for realistic tailoring rings."""
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "blender"))
from surface_coverage import (
    adaptive_surface_cut_rounds,
    body_aware_sleeve_ring,
    underarm_inboard_relief_m,
    underarm_centreline_contact_relief_m,
    waist_panel_ease_pull_m,
    trouser_waist_side_seam_limit_m,
    preserve_trouser_leg_outer_seam_with_inseam_gap,
    bounded_source_cloth_shift,
    precision_safe_source_radius,
    waist_to_chest_taper_radius,
    anatomically_enclose_intermediate_rings,
    bounded_body_section_center_y,
    belongs_to_locked_shirt_trunk,
    terminal_face_patch_allowed,
    needs_tailoring_face_triangulation,
    reproject_vertex_to_fitted_ring,
    rounded_tailoring_ring_xy,
    outward_ring_quad,
    nested_tucked_hem_ring,
    sampled_mesh_face_indices,
    penetrating_surface_samples,
    subdivide_ring_profiles,
    vertical_subdivision_cuts,
)


class DistinctRealThighInseamTests(unittest.TestCase):
    def test_left_thigh_no_longer_sweeps_into_opposite_leg(self):
        # Blender measured +35mm left-tube overshoot near z=.868m.
        centre, radius, shift=preserve_trouser_leg_outer_seam_with_inseam_gap(
            -.105,.140,0,-1,
        )
        self.assertAlmostEqual(shift,.0195)
        self.assertAlmostEqual(centre-radius,-.245)
        self.assertAlmostEqual(centre+radius,-.004)
        self.assertAlmostEqual(shift,.039/2,delta=.001)

    def test_mirror_symmetry_preserves_outer_side_seam(self):
        left=preserve_trouser_leg_outer_seam_with_inseam_gap(-.105,.140,0,-1)
        right=preserve_trouser_leg_outer_seam_with_inseam_gap(.105,.140,0,1)
        self.assertAlmostEqual(left[0],-right[0])
        self.assertAlmostEqual(left[1],right[1])
        self.assertAlmostEqual(left[0]-left[1],-.245)
        self.assertAlmostEqual(right[0]+right[1],.245)

    def test_safe_inseam_needs_no_edit_and_extreme_fail_closed(self):
        self.assertEqual(
            preserve_trouser_leg_outer_seam_with_inseam_gap(-.14,.09,0,-1),
            (-.14,.09,0.0),
        )
        with self.assertRaisesRegex(ValueError,"source would need"):
            preserve_trouser_leg_outer_seam_with_inseam_gap(
                -.06,.180,0,-1,max_center_shift_m=.030
            )
        for invalid in [float("nan"),float("inf"),True]:
            with self.assertRaises(ValueError):
                preserve_trouser_leg_outer_seam_with_inseam_gap(-.10,invalid,0,-1)

    def test_native_candidate_uses_body_measured_sources_and_real_bvh(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        self.assertIn("preserve_trouser_leg_outer_seam_with_inseam_gap(",source)
        self.assertIn("Linen Earth measured trouser leg source fit:",source)
        self.assertIn("repair_between_vertex_collisions(",source)


class MeasuredTrouserSeatClearanceTests(unittest.TestCase):
    def test_locked_344mm_waist_tapers_toward_real_hip(self):
        self.assertAlmostEqual(
            trouser_waist_side_seam_limit_m(.172,0),.179
        )
        # At the measured 1.0425m failed intersection (~70mm below waist)
        # the panel cannot arbitrarily expand to 252mm half-width around
        # hands. True hip and arm clearance remain independently BVH-tested.
        self.assertLess(
            trouser_waist_side_seam_limit_m(.172,.070),.22
        )
        self.assertGreater(
            trouser_waist_side_seam_limit_m(.172,.160),.22
        )
        self.assertLess(
            trouser_waist_side_seam_limit_m(.172,.230),.30
        )

    def test_source_hip_shaping_never_edits_locked_waist_or_body(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        begin=source.index("def restore_trouser_waist_side_seam(")
        end=source.index("def restore_shirt_waist_side_seam(",begin)
        body=source[begin:end]
        self.assertIn("if not 0.002<below<0.24:",body)
        self.assertIn("if distance>0.095:",body)
        self.assertIn("trouser_waist_side_seam_limit_m(",body)
        self.assertIn("realBodyCollisionStillRequiresBVH",body)
        self.assertIn('fit_profile["trouserWaistSideSeamContinuity"]',source)
        for bad in [float("nan"),float("inf"),-1]:
            with self.assertRaises(ValueError):
                trouser_waist_side_seam_limit_m(.172,bad)
        with self.assertRaises(ValueError):
            trouser_waist_side_seam_limit_m(.172,.06,hip_slope=.90)


class InnerSleeveBodyContactReliefTests(unittest.TestCase):
    def test_torso_facing_quadrant_relief_tapers_to_zero_at_outer_sleeve(self):
        waist=1.11423
        center=waist+0.040
        self.assertAlmostEqual(underarm_inboard_relief_m(center,.07,waist),.045)
        self.assertGreater(underarm_inboard_relief_m(1.10807,.07,waist),.03)
        self.assertGreater(underarm_inboard_relief_m(1.17501,.07,waist),.04)
        self.assertEqual(underarm_inboard_relief_m(center,-.02,waist),0.0)
        self.assertEqual(underarm_inboard_relief_m(center,0,waist),0.0)
        self.assertEqual(underarm_inboard_relief_m(center+.28,.07,waist),0.0)
        # The left sleeve lower gusset already passed the strict native
        # BVH gate; cover the new right-side shoulder/armpit contact too.
        self.assertGreater(underarm_inboard_relief_m(1.2706,.07,waist),.039)
        self.assertLessEqual(underarm_inboard_relief_m(1.2706,.07,waist),.045)
        self.assertGreater(
            underarm_inboard_relief_m(center+.03,.06,waist),0)
        self.assertLess(
            underarm_inboard_relief_m(center+.03,.06,waist),.045)

    def test_source_underarm_relief_cannot_distort_arms_or_waist_unboundedly(self):
        for bad in [(float("nan"),.05,1.1), (1.15,True,1.1),
                    (1.15,.05,1.1,0.16), (1.15,.05,1.1,-0.1)]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    if len(bad)==3:
                        underarm_inboard_relief_m(*bad)
                    else:
                        underarm_inboard_relief_m(*bad[:3],half_span_m=bad[3])
        with self.assertRaises(ValueError):
            underarm_inboard_relief_m(1.15,.03,1.1,max_relief_m=.06)


class MeasuredPostThicknessSleeveSeamTests(unittest.TestCase):
    def test_left_native_bvh_contact_has_small_local_smooth_notch(self):
        waist=1.11423
        # Real source Blender preflight: x=-244mm, z=1.116m,
        # two sleeve points penetrate by more than 1.5mm.
        self.assertAlmostEqual(
            underarm_centreline_contact_relief_m(1.11623,.006,waist),
            .008,
        )
        self.assertGreater(
            underarm_centreline_contact_relief_m(1.10807,.006,waist),
            .005,
        )
        # Real final BVH contacts at -244.3 and -236.7mm straddle the
        # centre of the left sleeve. Preserve a bounded outboard notch.
        self.assertAlmostEqual(
            underarm_centreline_contact_relief_m(1.11623,0,waist),.008,
        )
        self.assertAlmostEqual(
            underarm_centreline_contact_relief_m(1.11623,-.004,waist),.008,
        )
        self.assertGreater(
            underarm_centreline_contact_relief_m(1.11623,-.007,waist),0,
        )
        self.assertEqual(
            underarm_centreline_contact_relief_m(1.11623,-.010,waist),0,
        )
        self.assertEqual(
            underarm_centreline_contact_relief_m(1.11623,-.015,waist),0,
        )
        self.assertEqual(
            underarm_centreline_contact_relief_m(1.11623,.029,waist),0,
        )
        self.assertEqual(
            underarm_centreline_contact_relief_m(1.160,.006,waist),0,
        )

    def test_original_45mm_source_and_real_bvh_gates_remain_strict(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        self.assertIn(
            "min(0.045,displacement+underarm_centreline_contact_relief_m(",source
        )
        self.assertIn("repair_between_vertex_collisions(",source)
        for bad in (float("nan"),True,float("inf")):
            with self.assertRaises(ValueError):
                underarm_centreline_contact_relief_m(1.116,bad,1.114)
        with self.assertRaises(ValueError):
            underarm_centreline_contact_relief_m(
                1.116,.006,1.114,max_relief_m=.012
            )


class MeasuredWaistEaseConvergenceTests(unittest.TestCase):
    def test_inward_fit_uses_real_skin_distance_and_never_alters_guides(self):
        # 29mm shirt median needs a small take-in to pass the 28mm gate.
        self.assertAlmostEqual(
            waist_panel_ease_pull_m(.029,.018,.022,.008),.007
        )
        # 35.9mm trouser median: 12mm physical maximum inward movement.
        self.assertAlmostEqual(
            waist_panel_ease_pull_m(.0359,.015,.026,.012),.0099
        )
        self.assertEqual(waist_panel_ease_pull_m(.050,0,.022,.008),0)
        self.assertEqual(waist_panel_ease_pull_m(.050,.002,.022,.008),0)
        self.assertEqual(waist_panel_ease_pull_m(.050,.050,.022,.008),0)
        self.assertEqual(waist_panel_ease_pull_m(.005,.018,.022,.008),0)
        self.assertLess(
            waist_panel_ease_pull_m(.050,.045,.022,.008),.008
        )
        # New measured 32.37mm trouser median is 0.37mm outside the
        # unchanged strict 32mm production limit. Broaden ONLY the
        # cloth's non-guide hip transition to 60mm for native retest.
        self.assertGreater(
            waist_panel_ease_pull_m(.036,.050,.026,.012,waist_band_m=.060),0
        )
        self.assertEqual(
            waist_panel_ease_pull_m(.036,.060,.026,.012,waist_band_m=.060),0
        )
        with self.assertRaises(ValueError):
            waist_panel_ease_pull_m(.036,.050,.026,.012,waist_band_m=.075)

    def test_no_fake_tailor_evidence_or_body_bvh_exemption(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        body=source[source.index("def tighten_waist_to_measured_body_ease("):
                    source.index("def restore_trouser_waist_side_seam(")]
        self.assertIn("point_inside_closed_bvh(tree,candidate)",body)
        self.assertIn("waist_panel_ease_pull_m(",body)
        self.assertIn("fit_profile[\"waistEaseConvergence\"]",source)
        self.assertIn("waist_band_m=0.060",source)
        self.assertIn("waist_band_m=waist_band_m",source)
        self.assertIn("repair_between_vertex_collisions(",source)
        for bad in [float("nan"),float("inf"),True,-.005]:
            with self.assertRaises(ValueError):
                waist_panel_ease_pull_m(bad,.015,.026,.012)
        with self.assertRaises(ValueError):
            waist_panel_ease_pull_m(.04,.012,.026,.015)


class AnatomicalSleeveConstructionTests(unittest.TestCase):
    def test_real_arm_pose_moves_sleeve_y_but_preserves_hand_center(self):
        ring=(1.1,-.255,0.0,.042,.034)
        body=[
            (-.242+.029*math.cos(i*math.tau/64),
             .025+.033*math.sin(i*math.tau/64),1.1)
            for i in range(64)
        ]
        fitted,info=body_aware_sleeve_ring(
            body,ring,body_center_x=0.0,side=-1,clearance_m=.006)
        self.assertEqual(fitted[0],ring[0])
        self.assertGreater(fitted[2],.018)
        self.assertLessEqual(abs(fitted[1]-ring[1]),.02800001)
        self.assertEqual(fitted[1],ring[1],
                         "upper sleeve must never recenter INWARD into chest")
        builder=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                 "author-linen-earth-officewear.py").read_text()
        self.assertIn("sleeve_top_center = shoulder_half + 0.037",builder)
        self.assertIn("sleeve_top_radius = 0.056",builder)
        self.assertGreaterEqual(fitted[3],ring[3])
        self.assertGreaterEqual(fitted[4],ring[4])
        self.assertEqual(info["sampleCount"],64)
        self.assertEqual(info["sampleBandMm"],35.0)
        self.assertEqual(info["armInnerBoundaryMm"],172.0)
        with self.assertRaises(ValueError):
            body_aware_sleeve_ring(
                body,ring,body_center_x=0,side=-1,min_arm_distance_m=.26)
        expanded,_=body_aware_sleeve_ring(
            body,ring,body_center_x=0.0,side=-1,
            clearance_m=.006,sample_band_m=.060)
        self.assertEqual(expanded[0],ring[0])
        with self.assertRaises(ValueError):
            body_aware_sleeve_ring(
                body,ring,body_center_x=0,side=-1,sample_band_m=.075)
        cuff,evidence=body_aware_sleeve_ring(
            body,ring,body_center_x=0.0,side=-1,
            clearance_m=.006,locked_hand_center=True)
        self.assertAlmostEqual(cuff[1],ring[1])
        self.assertTrue(evidence["handCenterLocked"])

    def test_torso_vertices_are_not_mistaken_for_arm_cross_section(self):
        torso=[(-.10,.0,1.1)]*80
        with self.assertRaisesRegex(ValueError,"measured arm samples"):
            body_aware_sleeve_ring(
                torso,(1.1,-.24,0,.05,.04),
                body_center_x=0,side=-1)

    def test_unmeasured_sleeve_and_unphysical_clearance_fail_closed(self):
        ring=(1.1,.25,0,.04,.034)
        for bad_side in (0,True,2):
            with self.subTest(side=bad_side):
                with self.assertRaises(ValueError):
                    body_aware_sleeve_ring(
                        [],ring,body_center_x=0,side=bad_side)
        with self.assertRaises(ValueError):
            body_aware_sleeve_ring([],ring,body_center_x=0,side=1)
        with self.assertRaises(ValueError):
            body_aware_sleeve_ring(
                [],ring,body_center_x=0,side=1,clearance_m=.2)


class SourceShirtSideSeamContinuityTests(unittest.TestCase):
    def test_waist_band_cannot_inflate_to_hanging_arm_width(self):
        waist=0.147  # photograph: 294mm total shirt waist
        self.assertAlmostEqual(waist_to_chest_taper_radius(waist,0.016),
                               0.147+0.008+0.32*0.016)
        self.assertLess(waist_to_chest_taper_radius(waist,0.016),0.17)
        # True waist must remain 294mm; near hanging arms inboard panel
        # cannot grow to the observed false 203-245mm half-width.
        self.assertLess(waist_to_chest_taper_radius(waist,0.114),0.195)
        self.assertEqual(waist_to_chest_taper_radius(waist,0,ease_m=0),waist)
        self.assertGreater(waist_to_chest_taper_radius(waist,0.115),0.17)

    def test_waist_taper_rejects_unbounded_or_nonfinite_source_geometry(self):
        for args in [(-1,0),(0.30,0),(0.147,-0.01),
                     (0.147,0.51),(0.147,float("nan")),(True,.01)]:
            with self.subTest(args=args):
                with self.assertRaises(ValueError):
                    waist_to_chest_taper_radius(*args)

    def test_source_reshape_preserves_measured_waist_and_retests_skin(self):
        author=(Path(__file__).resolve().parents[1] / "scripts" / "blender" /
                "author-linen-earth-officewear.py").read_text()
        start=author.index("def restore_shirt_waist_side_seam(")
        end=author.index("def refine_collision_faces(",start)
        section=author[start:end]
        self.assertIn("waist_z+0.002 < z",section)
        self.assertIn("if movement>0.095:",section)
        self.assertIn("waist_to_chest_taper_radius",section)
        self.assertLess(author.index('fit_profile["shirtWaistSeamContinuity"]'),
                        author.index('collision_repairs = {}'))


class PhysicalClothTopologyTests(unittest.TestCase):
    def test_only_nonlocal_giant_ngons_are_triangulated(self):
        # Native Blender 37783648648 showed one purported face with over
        # 80 distinct waist-ring heights; its arithmetic centre was 32.4mm
        # inside skin. A proper physical cloth panel is a triangle or quad.
        self.assertFalse(needs_tailoring_face_triangulation(3))
        self.assertFalse(needs_tailoring_face_triangulation(4))
        self.assertTrue(needs_tailoring_face_triangulation(5))
        self.assertTrue(needs_tailoring_face_triangulation(88))

    def test_invalid_topology_counts_fail_closed(self):
        for bad in (-1,3.14,True,float("nan")):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    needs_tailoring_face_triangulation(bad)


class SourceBoundedBVHCorrectionTests(unittest.TestCase):
    def test_cloth_shift_checks_all_affected_source_vertices_and_real_body(self):
        source=(Path(__file__).resolve().parents[1] / "scripts" / "blender" /
                "author-linen-earth-officewear.py").read_text()
        start=source.index("def outside_correction(point,vertices):")
        end=source.index("                proposals={}",start)
        correction=source[start:end]
        self.assertIn("point_inside_closed_bvh(body_tree,candidate)",correction)
        self.assertIn("source_world_positions[vertex.index]",correction)
        self.assertIn("if max_total>0.095:",correction)
        self.assertIn("Vector((0,1,0)),Vector((0,-1,0))",correction)
        self.assertIn("if not options:",correction)
        self.assertIn("SOURCE-LOCKED 95mm",correction)


class Float32PrecisionWithoutRelaxedClothLimit(unittest.TestCase):
    def test_exact_95mm_and_float32_nanometre_roundoff(self):
        self.assertEqual(precision_safe_source_radius(.095),.095)
        self.assertAlmostEqual(
            precision_safe_source_radius(.095000004),
            .095-.0000002,places=12
        )
        self.assertLess(precision_safe_source_radius(.095000004),.095)
        with self.assertRaises(ValueError):
            precision_safe_source_radius(.0950001)
        with self.assertRaises(ValueError):
            precision_safe_source_radius(float("nan"))

    def test_native_roundoff_goes_inward_not_outward(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        self.assertIn("safe=precision_safe_source_radius(distance)",source)
        self.assertIn("source+direction*safe",source)
        self.assertIn("if deviations[worst]>0.095:",source)
        self.assertIn("if remaining_face or remaining_edge:",source)


class OriginalPanelVertexReprojectionGuards(unittest.TestCase):
    def test_skin_reprojection_must_look_back_to_prepatch_source(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        start=source.index("def repair_body_penetrations(")
        end=source.index("def repair_between_vertex_collisions(",start)
        skin=source[start:end]
        self.assertIn("original_source=None",skin)
        self.assertIn("len(original_source)!=len(obj.data.vertices)",skin)
        self.assertIn("(candidate-original_source[vertex.index]).length>0.095",skin)
        self.assertIn("point_inside_closed_bvh(body_tree, candidate)",skin)
        self.assertIn("original 95mm cloth-source radius",skin)
        face=source[end:source.index("def finish_procedural_shell(",end)]
        self.assertIn("original_source=source_world_positions",face)
        self.assertIn("remaining_face or remaining_edge",face)


class LockedClothSourceSphereTests(unittest.TestCase):
    def test_small_safe_shift_is_exact(self):
        self.assertEqual(bounded_source_cloth_shift((0,0,0),(.01,0,0),
                          (.012,0,0)),(.012,0,0))

    def test_terminal_shift_is_clipped_to_original_95mm_radius(self):
        # Native right-sleeve run had one face inside at a source
        # displacement of 87.89mm; coherent correction may overshoot.
        source=(0,0,0)
        current=(.08789,0,0)
        delta=bounded_source_cloth_shift(source,current,(.02,0,0))
        result=current[0]+delta[0]
        self.assertLessEqual(result,.095)
        self.assertGreater(result,.0949)
        self.assertGreater(delta[0],0)

    def test_lateral_safe_direction_is_not_zeroed_by_radial_budget(self):
        delta=bounded_source_cloth_shift((0,0,0),(.093,0,0),
                                         (-.012,.018,0))
        self.assertGreater(delta[1],.017)
        self.assertLessEqual(sum((a+b)**2 for a,b in
                                  zip((.093,0,0),delta)),.095**2+1e-9)

    def test_source_violation_and_invalid_input_fail_closed(self):
        with self.assertRaises(ValueError):
            bounded_source_cloth_shift((0,0,0),(.12,0,0),(.01,0,0))
        with self.assertRaises(ValueError):
            bounded_source_cloth_shift((0,0,0),(.03,0,0),
                                       (.02,0,0),max_m=.2)
        with self.assertRaises(ValueError):
            bounded_source_cloth_shift((0,0,0),(float("nan"),0,0),
                                       (.01,0,0))

    def test_terminal_patch_still_measures_contacts_after_clipping(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        start=source.index("def repair_between_vertex_collisions(")
        end=source.index("def finish_procedural_shell(",start)
        body=source[start:end]
        self.assertIn("bounded_source_cloth_shift(",body)
        self.assertIn("if remaining_face or remaining_edge:",body)
        self.assertIn("source_world_positions[vertex.index]",body)
        self.assertIn("point_inside_closed_bvh(body_tree",body)


class BoundedMultiPassSeamConvergenceTests(unittest.TestCase):
    def test_repeated_coherent_patch_is_bounded_and_revalidates_real_bvh(self):
        source=(Path(__file__).resolve().parents[1]/"scripts"/"blender"/
                "author-linen-earth-officewear.py").read_text()
        start=source.index("def repair_between_vertex_collisions(")
        end=source.index("def finish_procedural_shell(",start)
        body=source[start:end]
        self.assertIn("terminal_patch_budget=6",body)
        self.assertIn("weights=[max(delta.length,0.001)**2 for delta in corrections]",body)
        self.assertIn("range(max_rounds+1+terminal_patch_budget)",body)
        self.assertIn("if iteration < max_rounds+terminal_patch_budget:",body)
        self.assertIn("if remaining_face or remaining_edge:",body)
        self.assertIn("if distance>0.025:",body)
        self.assertIn("source_world_positions[vertex.index]",body)
        self.assertIn("(point-nearest[0]).length > 0.0015",body)
        self.assertIn("raise RuntimeError(",body)


class TerminalMeasuredSeamRepairTests(unittest.TestCase):
    def test_final_patch_accounts_for_real_edge_contacts_without_waiving_bvh(self):
        source=(Path(__file__).resolve().parents[1] / "scripts" / "blender" /
                "author-linen-earth-officewear.py").read_text()
        beginning=source.index("def repair_between_vertex_collisions(")
        ending=source.index("def finish_procedural_shell(",beginning)
        section=source[beginning:ending]
        # Edges may receive EXTRA bounded patch passes, never an exception to
        # the final >1.5mm skin penetration gate. Face+edge contact retains
        # the tighter four-edge bound; edge-only residue may have up to eight.
        self.assertIn("0 <= edge_hits <= 4",section)
        self.assertIn("or centroid_hits == 0 and 0 < edge_hits <= 8",section)
        self.assertIn("if not penetration(centre):",section)
        self.assertIn("if distance>0.025:",section)
        self.assertIn("source_world_positions[vertex.index]",section)
        self.assertIn("if remaining_face or remaining_edge:",section)
        self.assertIn("(point-nearest[0]).length > 0.0015",section)


class TerminalCoherentClothPatchTests(unittest.TestCase):
    def test_real_four_face_zero_edge_residue_requires_coherent_patch(self):
        self.assertTrue(terminal_face_patch_allowed(4,0))
        self.assertTrue(terminal_face_patch_allowed(8,0))
        self.assertFalse(terminal_face_patch_allowed(0,0))
        self.assertFalse(terminal_face_patch_allowed(9,0))
        self.assertFalse(terminal_face_patch_allowed(4,1))
        self.assertFalse(terminal_face_patch_allowed(100,200))

    def test_centroid_repair_budget_never_accepts_invalid_or_unbounded_counts(self):
        for face,edge,limit in (
            (-1,0,8),(1,-1,8),(True,0,8),(3,False,8),(3,0,17),(3,0,0)
        ):
            with self.subTest(f=face,e=edge,limit=limit):
                with self.assertRaises(ValueError):
                    terminal_face_patch_allowed(face,edge,limit=limit)


class ShirtCollarVersusTorsoRingTests(unittest.TestCase):
    def test_collared_neck_cap_is_not_forced_over_chest(self):
        shoulder_z=1.46
        self.assertTrue(belongs_to_locked_shirt_trunk(1.32,shoulder_z))
        self.assertTrue(belongs_to_locked_shirt_trunk(shoulder_z,shoulder_z))
        # Native Blender 37781653509: p=3.2 collar cap at 1.4776 m,
        # radius 67 x 29.5 mm. It is not a full torso enclosure ring.
        self.assertFalse(belongs_to_locked_shirt_trunk(1.4776,shoulder_z))
        self.assertFalse(belongs_to_locked_shirt_trunk(1.50,shoulder_z))

    def test_neck_exclusion_cannot_consume_shoulder_guide(self):
        shoulder_z=1.455
        self.assertTrue(belongs_to_locked_shirt_trunk(shoulder_z,shoulder_z))
        self.assertTrue(belongs_to_locked_shirt_trunk(shoulder_z-0.001,shoulder_z))
        for bad in (float("nan"),float("inf"),True):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    belongs_to_locked_shirt_trunk(bad,shoulder_z)


class PostIdentityGarmentReprojectionTests(unittest.TestCase):
    def test_real_chest_ring_recenters_without_changing_body_or_shoulder_height(self):
        original=(1.22,0.0,-0.03,0.15,0.12)
        target=(1.22,0.0,-0.015,0.17,0.14)
        point=(0.15,0.09,1.22)
        fitted=reproject_vertex_to_fitted_ring(point,original,target)
        self.assertAlmostEqual(fitted[0],.17)
        self.assertAlmostEqual(fitted[1],.125)
        self.assertEqual(fitted[2],point[2])
        self.assertEqual(original,(1.22,0.0,-.03,.15,.12))
        self.assertEqual(target,(1.22,0.0,-.015,.17,.14))

    def test_no_op_reprojection_is_exact_for_guide_rings(self):
        locked=(1.25,-.012,.015,.194,.136)
        p=(.182,.137,1.25)
        self.assertEqual(reproject_vertex_to_fitted_ring(p,locked,locked),p)

    def test_nonfinite_or_z_changing_body_fit_is_rejected(self):
        ring=(1.22,0,-.03,.15,.12)
        for point,target in [
            ((0,0,1.24),ring),
            ((0,0,1.22),(1.24,0,0,.15,.12)),
            ((float("nan"),0,1.22),ring),
            ((0,0,1.22),(1.22,0,0,-.1,.12)),
        ]:
            with self.subTest(point=point,target=target):
                with self.assertRaises(ValueError):
                    reproject_vertex_to_fitted_ring(point,ring,target)


class MeasuredAnatomicalPostureTests(unittest.TestCase):
    def test_real_front_and_back_skin_permit_only_small_cloth_center_adjustments(self):
        before=(1.17,0.0,-0.03,0.1590,0.1264)
        after=(1.29,0.0,-0.03,0.1590,0.1264)
        middle=(1.2292,0.0,-0.03,0.1590,0.1264)
        section=(
            [(0.18,0.11,1.2530)]*73 +
            [(-0.10,-0.14,1.2530)]*73
        )
        with self.assertRaisesRegex(ValueError,"70mm"):
            anatomically_enclose_intermediate_rings(
                [before,after],[before,middle,after],section,
                profile_power=3.2,max_center_shift_m=0,
            )
        result=anatomically_enclose_intermediate_rings(
            [before,after],[before,middle,after],section,
            profile_power=3.2,max_center_shift_m=0.018,
        )
        self.assertEqual(result[0],before)
        self.assertEqual(result[-1],after)
        self.assertGreater(result[1][2],middle[2])
        self.assertLessEqual(abs(result[1][2]-middle[2]),.01800001)
        self.assertLessEqual(result[1][3]-middle[3],.07000001)

    def test_one_sided_arm_section_does_not_shift_entire_locked_shirt(self):
        body=[(.15,.11,.45)]*25
        cy=bounded_body_section_center_y(
            body,0,-.03,.159,.1264,profile_power=3.2,max_shift_m=.018)
        self.assertAlmostEqual(cy,-.03)

    def test_invalid_or_unmeasured_posture_cannot_be_approved(self):
        for bad in (-0.01,.021,float("nan"),True):
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    bounded_body_section_center_y(
                        [(0,0,.45)]*20,0,0,.159,.1264,
                        profile_power=3.2,max_shift_m=bad
                    )
        with self.assertRaises(ValueError):
            bounded_body_section_center_y(
                [],0,0,.159,.1264,profile_power=3.2,max_shift_m=.018
            )


class RoundedAnatomySectionTests(unittest.TestCase):
    def test_real_locked_chest_corner_fits_within_unchanged_seventy_mm_growth_guard(self):
        # Native Blender 4.2 run 37780010855 failed the elliptical assumption:
        # a true torso point at x=.1804,y=.1151,z=1.253 from a section centred
        # at z=1.2292 caused 70+mm needless growth of BOTH shell radii.
        start=(1.17,0.0,0.0,0.1590,0.1264)
        end=(1.29,0.0,0.0,0.1590,0.1264)
        mid=(1.2292,0.0,0.0,0.1590,0.1264)
        body=[(0.1804,0.1151,1.2530) for _ in range(146)]
        with self.assertRaisesRegex(ValueError,"70mm"):
            anatomically_enclose_intermediate_rings(
                [start,end],[start,mid,end],body,profile_power=2.0
            )
        result=anatomically_enclose_intermediate_rings(
            [start,end],[start,mid,end],body,profile_power=3.0
        )
        self.assertEqual(result[0],start)
        self.assertEqual(result[-1],end)
        fitted=result[1]
        self.assertLessEqual(fitted[3]-mid[3],0.070)
        self.assertLessEqual(fitted[4]-mid[4],0.070)
        normalized=((0.1804/fitted[3])**3+(0.1151/fitted[4])**3)
        self.assertLess(normalized,1.0)

    def test_softly_squarish_torso_preserves_shoulder_and_waist_extrema(self):
        cx,cy,rx,ry=.011,-.027,.194,.133
        for theta,expected in (
            (0,(cx+rx,cy)), (math.pi/2,(cx,cy+ry)),
            (math.pi,(cx-rx,cy)), (3*math.pi/2,(cx,cy-ry))
        ):
            x,y=rounded_tailoring_ring_xy(theta,cx,cy,rx,ry,profile_power=3.0)
            self.assertAlmostEqual(x,expected[0])
            self.assertAlmostEqual(y,expected[1])
        circular=rounded_tailoring_ring_xy(math.pi/4,0,0,rx,ry,profile_power=2)
        shirt=rounded_tailoring_ring_xy(math.pi/4,0,0,rx,ry,profile_power=3)
        self.assertGreater(shirt[0],circular[0])
        self.assertGreater(shirt[1],circular[1])

    def test_invalid_curvature_does_not_silently_inflate_figure(self):
        for power in (0,1.9,4.1,float("nan"),True):
            with self.subTest(power=power):
                with self.assertRaises(ValueError):
                    rounded_tailoring_ring_xy(0,0,0,.15,.12,profile_power=power)
                with self.assertRaises(ValueError):
                    anatomically_enclose_intermediate_rings(
                        [(0.4,0,0,.15,.12),(0.5,0,0,.15,.12)],
                        [(0.4,0,0,.15,.12),(0.45,0,0,.15,.12),(0.5,0,0,.15,.12)],
                        [(0,0,.45)]*25, profile_power=power
                    )


class PhysicalPanelWindingTests(unittest.TestCase):
    def test_shell_normals_point_outwards_for_both_ring_directions(self):
        # Circle around positive X at segment 0. XY rings authored top->bottom
        # must have the SAME positive outward X normal as bottom->top.
        for ascending in (True, False):
            with self.subTest(ascending=ascending):
                lower, upper = 0.0, 1.0
                z_first, z_next = (lower, upper) if ascending else (upper, lower)
                vertices = [(1,0,z_first),(0,1,z_first),(-1,0,z_first),(0,-1,z_first),
                            (1,0,z_next),(0,1,z_next),(-1,0,z_next),(0,-1,z_next)]
                face = outward_ring_quad(0,4,0,1,ascending=ascending)
                p,q,r = (vertices[i] for i in face[:3])
                a=[q[k]-p[k] for k in range(3)]
                b=[r[k]-p[k] for k in range(3)]
                normal_x=a[1]*b[2]-a[2]*b[1]
                self.assertGreater(normal_x,0,"Outward cloth thickness must avoid bare-body penetrations")

    def test_ring_winding_rejects_ambiguous_geometry(self):
        for kwargs in (
            dict(previous=0,current=4,segment=-1,next_segment=1,ascending=True),
            dict(previous=0,current=4,segment=True,next_segment=1,ascending=True),
            dict(previous=0,current=4,segment=0,next_segment=1,ascending="down"),
        ):
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    outward_ring_quad(**kwargs)


class PhysicalTuckEnvelopeTests(unittest.TestCase):
    def test_tucked_hem_follows_real_trouser_waist_with_seven_mm_layering(self):
        ring=nested_tucked_hem_ring(0.88,0.0,-0.02,0.172,0.137)
        self.assertAlmostEqual(ring[0],0.88)
        self.assertAlmostEqual(ring[2],-0.02)
        self.assertAlmostEqual((0.172-ring[3])*1000,7)
        self.assertAlmostEqual((0.137-ring[4])*1000,7)
        self.assertGreater(ring[3],0)
        self.assertGreater(ring[4],0)

    def test_tucked_hem_does_not_hide_invalid_physical_fit(self):
        for radius_x,radius_y,inset in (
            (0.003,0.12,0.007), (0.172,0.01,0.012),
            (0.172,0.12,0), (0.172,0.12,0.030),
        ):
            with self.subTest(params=(radius_x,radius_y,inset)):
                with self.assertRaises(ValueError):
                    nested_tucked_hem_ring(0.88,0,0,radius_x,radius_y,inset_m=inset)


class BlenderMeshSamplingTests(unittest.TestCase):
    def test_sampled_indices_are_integer_only_and_bounded(self):
        for face_count, limit in ((0,600),(10,600),(2000,600),(50317,600)):
            with self.subTest(face_count=face_count):
                indices=sampled_mesh_face_indices(face_count,limit)
                self.assertLessEqual(len(indices),limit)
                self.assertEqual(len(indices),len(set(indices)))
                self.assertTrue(all(isinstance(i,int) and 0<=i<face_count for i in indices))
                if face_count:
                    self.assertEqual(indices[0],0)

    def test_invalid_face_count_or_sample_limit_is_not_silently_used(self):
        for count,limit in ((-1,600),(20,0),(20,2001),(3.2,600),(True,600)):
            with self.subTest(count=count,limit=limit):
                with self.assertRaises(ValueError):
                    sampled_mesh_face_indices(count,limit)


class AdaptiveCollisionResolutionTests(unittest.TestCase):
    def test_short_edges_stay_unchanged_and_original_guides_preserved(self):
        self.assertEqual(adaptive_surface_cut_rounds(0.024,0.025),0)
        self.assertEqual(adaptive_surface_cut_rounds(0.025,0.025),0)

    def test_long_diagonals_gain_real_surface_vertices(self):
        self.assertEqual(adaptive_surface_cut_rounds(0.041,0.025),1)
        self.assertEqual(adaptive_surface_cut_rounds(0.080,0.025),2)
        self.assertEqual(adaptive_surface_cut_rounds(0.190,0.025),3)
        for length in (0.041,0.08,0.19):
            with self.subTest(length=length):
                rounds=adaptive_surface_cut_rounds(length,0.025)
                self.assertLessEqual(length / 2**rounds,0.025+1e-12)

    def test_impossible_surface_spans_fail_instead_of_loosening_collision_gate(self):
        with self.assertRaisesRegex(ValueError,"safe collision"):
            adaptive_surface_cut_rounds(0.300,0.025)

    def test_nonfinite_and_unphysical_limits_fail_closed(self):
        for length,target,passes in (
            (math.nan,0.025,3),(-0.01,0.025,3),
            (0.030,0.001,3),(0.030,0.060,3),
            (0.030,0.025,0),(0.030,0.025,8),
            (True,0.025,3),
        ):
            with self.subTest(length=length,target=target,passes=passes):
                with self.assertRaises(ValueError):
                    adaptive_surface_cut_rounds(length,target,passes)


class VerticalRefinementTests(unittest.TestCase):
    def test_short_edges_preserve_original_profile(self):
        a = (1.0, 0.0, 0.0, 0.06, 0.05)
        b = (1.045, 0.02, -0.01, 0.07, 0.06)
        self.assertEqual(subdivide_ring_profiles([a, b]), [a, b])
        self.assertEqual(vertical_subdivision_cuts(0.055), 0)

    def test_120mm_chest_gap_has_real_intermediate_collision_vertices(self):
        a = (0.7, 0.0, 0.0, 0.09, 0.10)
        b = (0.82, 0.03, -0.01, 0.11, 0.12)
        rows = subdivide_ring_profiles([a, b])
        self.assertEqual(len(rows), 4)
        self.assertEqual((rows[0], rows[-1]), (a, b))
        for previous, following in zip(rows, rows[1:]):
            self.assertLessEqual(abs(following[0] - previous[0]), 0.055 + 1e-10)
        self.assertAlmostEqual(rows[1][1], 0.01)
        self.assertAlmostEqual(rows[2][3], 0.09 + (0.11 - 0.09) * 2 / 3)

    def test_descending_sleeve_profile_retains_tailoring_control_rings(self):
        top = (1.42, -0.2, 0.0, 0.068, 0.052)
        elbow = (1.11, -0.22, 0.0, 0.052, 0.043)
        cuff = (0.85, -0.23, 0.0, 0.038, 0.032)
        rows = subdivide_ring_profiles([top, elbow, cuff])
        self.assertEqual(rows[0], top)
        self.assertEqual(rows[-1], cuff)
        self.assertIn(elbow, rows)
        self.assertTrue(all(a[0] > b[0] for a, b in zip(rows, rows[1:])))
        self.assertTrue(all(a[3] > 0 and a[4] > 0 for a in rows))
        self.assertTrue(all((a[0] - b[0]) <= 0.055 + 1e-10 for a, b in zip(rows, rows[1:])))

    def test_nonmonotonic_or_duplicate_rings_fail_closed(self):
        base = (1.1, 0.0, 0.0, 0.04, 0.04)
        for rings in ([base], [base, base], [(1.0, 0, 0, 0.1, 0.1), base, (1.05, 0, 0, 0.1, 0.1)]):
            with self.subTest(rings=rings):
                with self.assertRaises(ValueError):
                    subdivide_ring_profiles(rings)

    def test_nan_negative_radius_or_impossible_span_fail_closed(self):
        safe = (0.5, 0.0, 0.0, 0.1, 0.1)
        for bad in [(math.nan, 0, 0, 0.1, 0.1), (1.0, 0, 0, -0.1, 0.1), (True, 0, 0, 0.1, 0.1)]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    subdivide_ring_profiles([safe, bad])
        with self.assertRaisesRegex(ValueError, "too long"):
            subdivide_ring_profiles([safe, (1.2, 0, 0, 0.1, 0.1)])

    def test_subdivision_limits_are_physical_and_not_silent(self):
        self.assertEqual(vertical_subdivision_cuts(0.11), 1)
        self.assertEqual(vertical_subdivision_cuts(0.12), 2)
        with self.assertRaises(ValueError):
            vertical_subdivision_cuts(0.55)


class LockedTorsoEnvelopeTests(unittest.TestCase):
    def test_real_body_bulge_at_intermediate_ring_is_enclosed_without_changing_guides(self):
        a = (0.4, 0.0, 0.0, 0.10, 0.08)
        b = (0.5, 0.0, 0.0, 0.10, 0.08)
        middle = (0.45, 0.0, 0.0, 0.10, 0.08)
        # Original rings are legitimate but the body expands between them.
        points = [(0.118 * math.cos(i * math.tau / 40),
                   0.090 * math.sin(i * math.tau / 40), 0.45) for i in range(40)]
        result = anatomically_enclose_intermediate_rings([a,b], [a,middle,b], points)
        self.assertEqual(result[0], a)
        self.assertEqual(result[-1], b)
        self.assertGreater(result[1][3], middle[3])
        self.assertGreater(result[1][4], middle[4])
        self.assertTrue(all(
            ((p[0]/result[1][3])**2+(p[1]/result[1][4])**2) <= 1
            for p in points
        ))

    def test_large_anatomical_expansion_fails_without_hiding_identity_mismatch(self):
        a = (0.4, 0.0, 0.0, 0.10, 0.08)
        b = (0.5, 0.0, 0.0, 0.10, 0.08)
        midpoint = (0.45, 0.0, 0.0, 0.10, 0.08)
        # Section samples must remain inside the actual torso corridor.
        # An outer ellipse outside that corridor only exercises insufficient
        # evidence, not the intended impossible-garment-envelope failure.
        body = [
            (0.14 + 0.005 * math.cos(i * math.tau / 30),
             0.12 + 0.005 * math.sin(i * math.tau / 30), 0.45)
            for i in range(30)
        ]
        with self.assertRaisesRegex(ValueError, "remodel the original panel"):
            anatomically_enclose_intermediate_rings([a,b], [a,midpoint,b], body)

    def test_arm_at_waist_height_does_not_become_fake_torso_width(self):
        a = (0.40, 0.0, 0.0, 0.12, 0.09)
        b = (0.50, 0.0, 0.0, 0.12, 0.09)
        mid = (0.45, 0.0, 0.0, 0.12, 0.09)
        torso = [(0.125 * math.cos(i*math.tau/50),
                  0.095 * math.sin(i*math.tau/50), 0.45) for i in range(50)]
        hanging_arms = [(0.205, 0.12, 0.45), (-0.205, -0.12, 0.45)]
        result = anatomically_enclose_intermediate_rings(
            [a,b], [a,mid,b], torso + hanging_arms)
        self.assertEqual(result[0], a)
        self.assertEqual(result[-1], b)
        self.assertLess(result[1][3] - mid[3], 0.04)

    def test_missing_section_fails_closed(self):
        a, b = (0.4, 0, 0, 0.10, 0.08), (0.5, 0, 0, 0.10, 0.08)
        body = [(0.0, 0.0, 0.9) for _ in range(25)]
        with self.assertRaisesRegex(ValueError, "torso samples"):
            anatomically_enclose_intermediate_rings([a,b], [a,(0.45, 0, 0, 0.10, 0.08),b], body)


class SurfaceSamplingTests(unittest.TestCase):
    def test_face_centroid_catches_skin_when_all_vertices_outside(self):
        points = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)]
        hits = penetrating_surface_samples(points, [(0, 1, 2, 3)], lambda p: abs(p[0]) < 0.01 and abs(p[1]) < 0.01)
        self.assertEqual([h["location"] for h in hits], ["centroid"])

    def test_shared_edge_is_probed_once(self):
        points = [(0, 0, 0), (2, 0, 0), (0, 2, 0), (2, 2, 0)]
        hits = penetrating_surface_samples(points, [(0, 1, 2), (1, 3, 2)], lambda p: p == (1.0, 1.0, 0.0))
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["location"], "edge-midpoint")

    def test_invalid_faces_fail_before_claiming_clearance(self):
        with self.assertRaises(ValueError):
            penetrating_surface_samples([(0, 0, 0)], [(0, 1, 2)], lambda p: False)

    def test_diagnostic_limit_is_respected(self):
        points = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)]
        hits = penetrating_surface_samples(points, [(0, 1, 2, 3)], lambda p: True, max_hits=2)
        self.assertEqual(len(hits), 2)


if __name__ == "__main__":
    unittest.main()


class UniformRealClothTopologyContractTests(unittest.TestCase):
    def test_base_panel_refinement_preserves_local_quad_connections(self):
        # Regression for native Blender run 37793153217: splitting only
        # long edges created irregular faces which intersected real anatomy
        # despite vertex-level BVH clearance. Sampled surface QA is unchanged.
        source=(Path(__file__).resolve().parents[1] / "scripts" / "blender" / "author-linen-earth-officewear.py").read_text()
        start=source.index("def refine_collision_faces(")
        end=source.index("def repair_body_penetrations(",start)
        section=source[start:end]
        self.assertIn("edges=list(bm.edges),cuts=1,use_grid_fill=True",section)
        self.assertNotIn("edges=long_edges",section)
        self.assertIn("len(bm.faces)*4>max_faces",section)
        self.assertIn("needs_tailoring_face_triangulation",section)

    def test_deep_contact_checks_remain_physically_strict(self):
        source=(Path(__file__).resolve().parents[1] / "scripts" / "blender" / "author-linen-earth-officewear.py").read_text()
        start=source.index("def repair_between_vertex_collisions(")
        end=source.index("def finish_procedural_shell(",start)
        section=source[start:end]
        self.assertIn("(point-nearest[0]).length > 0.0015",section)
        self.assertIn("0 < centroid_hits <= 8",section)
        # Edges may receive EXTRA bounded patch passes, never an exception to
        # the final >1.5mm skin penetration gate. Face+edge contact retains
        # the tighter four-edge bound; edge-only residue may have up to eight.
        self.assertIn("0 <= edge_hits <= 4",section)
        self.assertIn("or centroid_hits == 0 and 0 < edge_hits <= 8",section)
        self.assertIn("len(bm.faces)>80000",section)
