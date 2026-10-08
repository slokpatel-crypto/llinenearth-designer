import math
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"blender"))
from fabric_arc_uv import frame_at_height, ellipse_arc_uv, ellipse_ring_perimeter_m


class RealGarmentTubeUVTests(unittest.TestCase):
    def test_ring_axis_interpolation_uses_source_construction_not_screen_projection(self):
        rings=[
            (1.0,-.25,.02,.06,.04),
            (1.2,-.24,.04,.05,.03),
        ]
        midpoint=frame_at_height(rings,1.1)
        self.assertAlmostEqual(midpoint[1],-.245)
        self.assertAlmostEqual(midpoint[2],.03)
        self.assertAlmostEqual(midpoint[3],.055)
        self.assertEqual(frame_at_height(rings,.9),rings[0])
        self.assertEqual(frame_at_height(rings,1.3),rings[1])

    def test_wrap_uv_width_is_full_ring_perimeter_not_x_diameter(self):
        circle=(1.2,.2,.01,.06,.06)
        self.assertAlmostEqual(ellipse_ring_perimeter_m(circle),
                               2*math.pi*.06,places=10)
        oval=(1.2,.2,.01,.06,.04)
        perimeter=ellipse_ring_perimeter_m(oval)
        self.assertGreater(perimeter,.06*2)
        self.assertLess(perimeter,2*math.pi*.06)
        # Flat panel spans a full circumference, not a two-radius projected
        # X strip; otherwise one 20mm check becomes >50mm around the arm.
        self.assertGreater(perimeter/(2*oval[3]),2.4)

    def test_tailor_worksheet_requires_actual_full_wrap_and_measured_repeat(self):
        source=(ROOT/"scripts"/"blender"/
                "write-panel-measurement-worksheet.py").read_text()
        self.assertIn("ellipse_ring_perimeter_m(ring)*1000.0",source)
        self.assertIn("estimatedUvMidHeightWrapMm",source)
        self.assertIn("uvWidthDefinition",source)
        self.assertIn("physicalPrintedRepeatMm",source)
        self.assertIn("physicalRepeatMeasurementMethod",source)
        self.assertIn('"widthMm": None',source)
        self.assertIn('"heightMm": None',source)
        self.assertIn("Never use X diameter",source)
        self.assertIn("excluding allowances",source)

    def test_lab_export_uses_circumference_but_never_fakes_verified_scale(self):
        source=(ROOT/"scripts"/"blender"/"export-linen-earth-officewear.py").read_text()
        self.assertIn("frame_at_height(rings,(min_z+max_z)*0.5)",source)
        self.assertIn("width_mm=ellipse_ring_perimeter_m(frame)*1000.0",source)
        self.assertIn('"dimensionSource": "geometry-estimate-unverified"',source)
        self.assertIn("Panel spec requires measurementEvidence",source)

    def test_seam_and_quarters_follow_ellipse_arc_not_flat_x(self):
        frame=(1.1,-.25,.02,.06,.04)
        x,y=frame[1:3]
        self.assertAlmostEqual(ellipse_arc_uv(x+.06,y,frame),0,places=8)
        self.assertAlmostEqual(ellipse_arc_uv(x,y+.04,frame),.25,places=6)
        self.assertAlmostEqual(ellipse_arc_uv(x-.06,y,frame),.5,places=6)
        self.assertAlmostEqual(ellipse_arc_uv(x,y-.04,frame),.75,places=6)
        self.assertAlmostEqual(
            ellipse_arc_uv(x-.06,y,frame,inward_seam_side=-1),0,places=8
        )
        # Oval circumference mapping differs from a naive angle fraction
        # between principal axes, so stripes retain actual curve length.
        angle=math.pi/6
        u=ellipse_arc_uv(x+.06*math.cos(angle),
                         y+.04*math.sin(angle),frame)
        self.assertGreater(abs(u-angle/math.tau),.005)

    def test_invalid_or_ambiguous_physical_uv_does_not_silently_fallback(self):
        frame=(1.1,-.25,.02,.06,.04)
        for frames,z in [([],1.1),([frame],1.1),([frame,frame],1.1)]:
            with self.subTest(frames=frames):
                with self.assertRaises(ValueError):
                    frame_at_height(frames,z)
        for x,y,ring,side in [
            (float("nan"),0,frame,1),
            (0,0,(1.1,0,0,0,.04),1),
            (0,0,frame,0),
        ]:
            with self.assertRaises(ValueError):
                ellipse_arc_uv(x,y,ring,inward_seam_side=side)

    def test_real_authoring_wraps_inner_seam_and_preserves_measured_panel_requirements(self):
        script=(ROOT/"scripts"/"blender"/"author-linen-earth-officewear.py").read_text()
        self.assertIn("linen_earth_source_ring_uv",script)
        self.assertIn("frame_at_height(frames,vertex.co.z)",script)
        self.assertIn("seam_crossing=max(u for u,_ in values)-min(u for u,_ in values)>.5",script)
        self.assertIn("if seam_crossing and u<.5: u+=1.",script)
        self.assertIn("construction-ring-arc-geometry-estimate",script)
        self.assertIn("planar-xz-geometry-estimate",script)


if __name__=="__main__":
    unittest.main()
