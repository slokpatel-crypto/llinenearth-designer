"""Regression for observed nonzero-world-area but zero UV-area neck triangles."""
import math
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"/"blender"))
from fabric_cap_uv import terminal_cap_uses_flat_uv,fabric_planar_uv
from uv_surface_metrics import triangle_world_mm_per_uv_unit


class FabricCapUvTests(unittest.TestCase):
    def test_actual_horizontal_neckline_has_nonzero_uv_area_only_with_xy_chart(self):
        # Real 2026-10-09 LAB GLB contains shirt neckline triangles around
        # world height 1.454 m, including two positive-area faces whose
        # three V coordinates all round to 0.929 on planar X/Z mapping.
        triangle=(
            (-.08,-.11,1.454),(.03,-.117,1.454),
            (.055,-.045,1.454),
        )
        mins=(-.20,-.15,.99)
        spans=(.40,.30,.47)
        self.assertTrue(terminal_cap_uses_flat_uv(triangle,(0,0,1),.99,1.454))
        old=tuple(fabric_planar_uv(p,mins,spans) for p in triangle)
        new=tuple(fabric_planar_uv(p,mins,spans,True) for p in triangle)
        self.assertEqual(triangle_world_mm_per_uv_unit(triangle,old),math.inf)
        self.assertTrue(math.isfinite(triangle_world_mm_per_uv_unit(triangle,new)))
        self.assertGreater(triangle_world_mm_per_uv_unit(triangle,new),0)

    def test_standing_shirt_wall_and_neckline_guide_keep_original_vertical_grain(self):
        p=(.088,-.04,1.3)
        mins=(-.20,-.15,.99)
        spans=(.4,.30,.47)
        self.assertFalse(terminal_cap_uses_flat_uv((
            p,(.09,-.04,1.32),(.1,-.05,1.35)
        ),(1,0,0),.99,1.454))
        self.assertEqual(fabric_planar_uv(p,mins,spans),(
            (.088+.20)/.4,(1.3-.99)/.47
        ))

    def test_internal_flat_pockets_and_angled_caps_remain_unchanged(self):
        horizontal=((-0.1,-.1,1.26),(.1,-.1,1.26),(0,.1,1.26))
        self.assertFalse(terminal_cap_uses_flat_uv(horizontal,(0,0,1),1.0,1.46))
        self.assertFalse(terminal_cap_uses_flat_uv(horizontal,(0,0,.5),1.0,1.26))
        self.assertFalse(terminal_cap_uses_flat_uv((
            (-.1,-.1,1.45),(.1,-.1,1.40),(0,.1,1.46)
        ),(0,0,1),1.0,1.46))

    def test_wrong_physical_coordinates_fail_closed(self):
        with self.assertRaises(ValueError):
            fabric_planar_uv((0,1,float("nan")),(0,0,0),(1,1,1))
        with self.assertRaises(ValueError):
            terminal_cap_uses_flat_uv([(0,0,0)],(0,float("inf"),1),0,1)
        with self.assertRaises(ValueError):
            fabric_planar_uv((1,2,3),(0,0,0),(1,0,1))

    def test_native_authoring_keeps_real_mobile_preflight_and_unverified_supplier_repeat(self):
        code=(ROOT/"scripts"/"blender"/"author-linen-earth-officewear.py").read_text()
        assert 'cap=terminal_cap_uses_flat_uv(points,tuple(polygon.normal),min_z,max_z)' in code
        assert 'use_horizontal_cap=cap' in code
        assert 'linen_earth_uv_cap_faces' in code
        assert 'obj["linen_earth_uv_source"]=' in code
        assert 'planar_grain_uv(obj)' in code


if __name__=="__main__":
    unittest.main()
