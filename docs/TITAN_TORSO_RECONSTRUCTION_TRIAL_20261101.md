# Source-envelope torso reconstruction trial

Built an isolated continuous torso candidate in Blender 4.5.14 from 40 source cross-sections with 64 vertices per section: 2,560 vertices, 2,496 quads. Body coordinates compared equal before and after. Original authored scene retained separately.

Independent preflight rejected this trial: 2,948 body/torso triangle overlaps and 1,329 tucked-waist overlaps, versus zero for both in the original candidate. The approximated rounded-rectangle cross-sections cut through the source anatomy. Inherited UV receipts also fail against the new topology; normalized experimental UVs are not mesh-metre calibrated. No production geometry was replaced.

Decision: do not integrate this reconstruction algorithm. Next trial must derive actual radial surface intersections and outward clearance per cross-section, explicitly remove obsolete UV receipts, and define armholes/neck opening before garment thickness. A smoothed bounding envelope alone is insufficient. Existing 113 Python regressions pass; these do not certify the rejected geometry.
