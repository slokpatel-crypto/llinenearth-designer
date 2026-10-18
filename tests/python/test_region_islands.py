"""Pure Python regression for source-mesh trouser island selection.

Does NOT assert the scanned Blender candidate passes native body contact,
garment/hand separation, photographic stance or tailor acceptance.
"""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "region_islands", ROOT / "scripts/blender/region_islands.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

# Continuous leg through shared EDGES from ankle to thigh; detached hand
# geometry at the exact same side/height is not eligible.
LEG = [(0, 1, 2), (2, 1, 3), (2, 3, 4)]
HAND = (20, 21, 22)


class RegionIslandsTests(unittest.TestCase):
    def test_preserves_ankle_thigh_leg_and_excludes_detached_hand(self):
        selected = module.keep_ankle_connected_faces(
            [*LEG, HAND], [0.08, 0.29, 0.50, 0.49],
            ankle_z_max=0.12, thigh_z_min=0.48,
        )
        self.assertEqual(selected, [0, 1, 2])

    def test_shared_vertex_does_not_attach_hand(self):
        selected = module.keep_ankle_connected_faces(
            [*LEG, (4, 21, 22)], [0.08, 0.29, 0.50, 0.49],
            ankle_z_max=0.12, thigh_z_min=0.48,
        )
        self.assertEqual(selected, [0, 1, 2])

    def test_unanchored_leg_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "exactly one"):
            module.keep_ankle_connected_faces(
                LEG, [0.30, 0.40, 0.52],
                ankle_z_max=0.12, thigh_z_min=0.48,
            )

    def test_cropped_thigh_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "exactly one"):
            module.keep_ankle_connected_faces(
                LEG, [0.08, 0.15, 0.29],
                ankle_z_max=0.12, thigh_z_min=0.48,
            )

    def test_two_competing_ankle_thigh_islands_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "found 2"):
            module.keep_ankle_connected_faces(
                [*LEG, (10, 11, 12), (12, 11, 13)],
                [0.08, 0.29, 0.50, 0.08, 0.50],
                ankle_z_max=0.12, thigh_z_min=0.48,
            )

    def test_input_validation(self):
        tests = [
            ([], [], 0.12, 0.48),
            (LEG, [0.08, 0.20], 0.12, 0.48),
            (LEG, [0.08, float("nan"), 0.50], 0.12, 0.48),
            (LEG, [0.08, 0.29, 0.50], 0.50, 0.48),
            ([(0, 1, 1)], [0.08], 0.12, 0.48),
            ([(0, True, 2)], [0.08], 0.12, 0.48),
        ]
        for faces, centres, anchor, thigh in tests:
            with self.subTest(faces=faces, centres=centres):
                with self.assertRaises(ValueError):
                    module.keep_ankle_connected_faces(
                        faces, centres, ankle_z_max=anchor, thigh_z_min=thigh
                    )


if __name__ == "__main__":
    unittest.main()
