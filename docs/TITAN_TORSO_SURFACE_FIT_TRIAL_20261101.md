# Surface-fitted torso trial

Reproducible experimental script: scripts/blender/experiments/reconstruct-shirt-clearance-candidate.py. Run inside Blender with the original authored scene loaded and a separate --output path. The script is not wired into production authoring/export.

Native Blender 4.5.14 completed reconstruction. Body vertex coordinates were unchanged. Applied nearest-body-surface shrinkwrap with 7 mm candidate clearance before 1.6 mm thickness. These values are exploratory geometry settings, not measured fabric properties. Obsolete per-object UV receipts were removed and scene UV units explicitly marked unverified.

Independent preflight: body/torso overlaps 1637 (previous envelope trial 2948), tucked-waist overlaps 22 (previous trial 1329). Other previously named body/panel and leg/leg counts remained zero. Torso still has 256 collapsed UV triangles and 80 UV discontinuities. Production ready=false.

Decision: reject candidate. Vertex projection alone does not constrain the faces spanning between projected vertices; reconstruction must establish anatomical panel topology/armholes and inspect face-level body clearance. Do not increase clearance or weaken thresholds to manufacture a pass. Original authored scene and customer model remain unchanged.
