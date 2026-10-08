"""Pure geometry safeguards for collision-fitting sparse garment shells.

This module is Blender-independent so its measurements can be regression tested
without a native Blender installation. Units are metres throughout.
"""

from __future__ import annotations
import math


def vertical_subdivision_cuts(span_m, max_vertical_step_m=0.055, max_cuts=8):
    """Number of interior vertices required along a long garment edge.

    A six-ring trouser/shirt shell can cross a curved calf or chest between its
    ring vertices even when every original vertex is outside the locked body.
    """
    if (
        isinstance(span_m, bool) or not isinstance(span_m, (int, float))
        or not math.isfinite(span_m) or span_m < 0
        or isinstance(max_vertical_step_m, bool)
        or not isinstance(max_vertical_step_m, (int, float))
        or not math.isfinite(max_vertical_step_m) or max_vertical_step_m <= 0
        or isinstance(max_cuts, bool) or not isinstance(max_cuts, int)
        or not 1 <= max_cuts <= 32
    ):
        raise ValueError("Garment surface refinement needs finite physical edge lengths and positive limits.")
    required = max(0, math.ceil(span_m / max_vertical_step_m) - 1)
    if required > max_cuts:
        raise ValueError("Garment shell has a span too long for bounded collision refinement.")
    return required


def penetrating_surface_samples(vertices, faces, inside, max_hits=32):
    """Return actual non-vertex penetration probes, capped for diagnostics.

    Checks each face centroid and each unique edge midpoint. A shell can have
    all its vertices outside the body but still intersect the torso between
    sparse garment rings. Do not certify coverage from vertices alone.
    """
    if not callable(inside) or not isinstance(max_hits, int) or not 1 <= max_hits <= 1024:
        raise ValueError("Collision sample predicate and diagnostic cap are required.")
    points = list(vertices)
    for point in points:
        if len(point) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
            raise ValueError("Collision samples require finite 3D vertices.")
    hits = []
    seen_edges = set()
    for face_index, face in enumerate(faces):
        indices = tuple(face)
        if len(indices) < 3 or any(not isinstance(i, int) or i < 0 or i >= len(points) for i in indices):
            raise ValueError("Collision samples require valid polygon indices.")
        centre = tuple(sum(points[i][axis] for i in indices) / len(indices) for axis in range(3))
        if inside(centre):
            hits.append({"face": face_index, "location": "centroid", "point": centre})
            if len(hits) >= max_hits:
                return hits
        for a, b in zip(indices, indices[1:] + indices[:1]):
            edge = tuple(sorted((a, b)))
            if edge in seen_edges:
                continue
            seen_edges.add(edge)
            midpoint = tuple((points[a][axis] + points[b][axis]) / 2 for axis in range(3))
            if inside(midpoint):
                hits.append({"face": face_index, "location": "edge-midpoint", "point": midpoint})
                if len(hits) >= max_hits:
                    return hits
    return hits


def subdivide_ring_profiles(rings, max_vertical_step_m=0.055, max_cuts=8):
    """Densify a five-field (z, cx, cy, rx, ry) tailoring shell profile.

    Preserve original construction rings exactly. Linear intermediate rings
    create real vertices where collision fitting can see a curved body instead
    of stretching one large face across chest, seat or calf. Works with both
    top-down sleeves/legs and bottom-up torso/waist panels.
    """
    rows = tuple(tuple(row) for row in rings)
    if len(rows) < 2:
        raise ValueError("Garment profile requires at least two tailoring rings.")
    for row in rows:
        if (
            len(row) != 5
            or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in row)
            or row[3] <= 0 or row[4] <= 0
        ):
            raise ValueError("Tailoring rings need five finite coordinates and positive radii.")
    direction = rows[1][0] - rows[0][0]
    if direction == 0:
        raise ValueError("Tailoring rings must have distinct height positions.")
    result = [rows[0]]
    for prev, nxt in zip(rows, rows[1:]):
        vertical = nxt[0] - prev[0]
        if vertical == 0 or vertical * direction <= 0:
            raise ValueError("Tailoring rings must progress monotonically in height.")
        cuts = vertical_subdivision_cuts(abs(vertical), max_vertical_step_m, max_cuts)
        for index in range(1, cuts + 1):
            t = index / (cuts + 1)
            result.append(tuple(prev[axis] + (nxt[axis] - prev[axis]) * t for axis in range(5)))
        result.append(nxt)
    return result


def anatomically_enclose_intermediate_rings(
    original_rings, refined_rings, body_points, *,
    clearance_m=0.007, max_growth_m=0.070, sample_band_m=0.024,
    profile_power=2.0, max_center_shift_m=0.0,
):
    """Enclose real torso/seat at NEW rings only; preserve locked original guides.

    Linear interpolation of endpoints can put an entire new shell section deep
    inside the body. Use measured locked-body sections to grow intermediate
    ellipses without moving the production measurement rings. Return concrete
    geometry, not a waiver of the 95mm collision-repair safety limit.
    """
    originals = set(tuple(r) for r in original_rings)
    if not originals:
        raise ValueError("Cannot preserve an empty locked garment profile.")
    if not (0 < clearance_m <= 0.025 and 0 < max_growth_m <= 0.10 and 0 < sample_band_m <= 0.05):
        raise ValueError("Garment envelope limits must be positive physical metre values.")
    if (isinstance(profile_power, bool) or not isinstance(profile_power, (int, float))
            or not math.isfinite(profile_power) or not 2.0 <= profile_power <= 4.0):
        raise ValueError("Tailored cross-section curvature must be between ellipse and rounded rectangle.")
    if (isinstance(max_center_shift_m,bool) or not isinstance(max_center_shift_m,(int,float))
            or not math.isfinite(max_center_shift_m) or not 0 <= max_center_shift_m <= 0.020):
        raise ValueError("Locked body posture permits no more than 20mm of garment-only ring recentering.")
    body = [tuple(p) for p in body_points]
    if len(body) < 20 or not all(
        len(p) == 3 and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in p)
        for p in body
    ):
        raise ValueError("Locked human body samples are insufficient or nonfinite.")

    result = []
    for ring in refined_rings:
        z, cx, cy, rx, ry = ring
        if tuple(ring) in originals:
            result.append(tuple(ring))
            continue
        # Arms/hands can share chest/waist height: fit only the anatomical
        # torso corridor. Any excluded body surface is still checked by BVH QA.
        # At waist/chest height the *arms* share Z with the trunk. A fixed
        # 225mm X corridor admitted forearms into shirt torso envelopes,
        # demanding >70mm fake cloth expansion. Bound this to the currently
        # authored trunk envelope + a measured 24/40mm guard region; excluded
        # anatomy remains independently subject to four-view review and BVH.
        x_corridor = min(0.225, max(0.155, rx + 0.024))
        y_corridor = min(0.260, max(0.135, ry + 0.040))
        section = [
            p for p in body
            if abs(p[2] - z) <= sample_band_m
            and abs(p[0] - cx) <= x_corridor
            and abs(p[1] - cy) <= y_corridor
        ]
        if len(section) < 16:
            raise ValueError(f"Only {len(section)} locked-body torso samples near z={z:.4f}m.")
        # This is an enclosing ellipse: cover simultaneous X/Y excursions,
        # not independent bounding boxes that can clip a diagonal shoulder.
        # Shirt chests and anatomical seats are rounded rectangles, not
        # perfect cylinders: a real front/side torso corner inside the observed
        # trunk corridor should not force both radii to inflate uniformly.
        # For p=2 this is exactly the original ellipse, while p=3 gently
        # flattens the visible shirt front/back without changing guide widths.
        # Original guide levels stay locked. Between the guides, posture
        # changes the anatomical front/back centre; simply interpolating the
        # old Y centre can project a real shirt seam through the chest or back.
        # Recenter by no more than 18mm, only if both anterior AND posterior
        # body surfaces are sampled. This cannot hide one-sided arm outliers.
        fitted_cy = bounded_body_section_center_y(
            section, cx, cy, rx, ry, profile_power=profile_power,
            max_shift_m=max_center_shift_m,
        )
        radial_samples = [
            (((abs(p[0] - cx) / rx) ** profile_power
               + (abs(p[1] - fitted_cy) / ry) ** profile_power) ** (1.0 / profile_power), p)
            for p in section
        ]
        required_scale, extreme = max(radial_samples, key=lambda item: item[0])
        scale = max(1.0, required_scale + clearance_m / min(rx, ry))
        next_rx, next_ry = rx * scale, ry * scale
        if next_rx - rx > max_growth_m or next_ry - ry > max_growth_m:
            raise ValueError(
                f"Locked-body ring z={z:.4f}m needs more than {max_growth_m*1000:.0f}mm "
                f"garment-envelope growth (radius={rx:.4f}/{ry:.4f}m, scale={scale:.3f}, "
                f"extreme={tuple(round(q,4) for q in extreme)}, samples={len(section)}, "
                f"centerY={cy:.4f}m fittedCenterY={fitted_cy:.4f}m power={profile_power:.2f}, "
                f"corridor={x_corridor:.4f}/{y_corridor:.4f}m); "
                "remodel the original panel rather than invent oversized cloth."
            )
        result.append((z, cx, fitted_cy, next_rx, next_ry))
    return result




def bounded_body_section_center_y(
    section, cx, cy, rx, ry, *, profile_power=2.0, max_shift_m=0.0
):
    """Bound a garment ring's Y centre to actual measured torso front/back.

    A fixed guide-to-guide centre cannot follow the locked body's gentle
    spinal posture. This moves only intermediate clothing rings; the real
    model and physical guide rings are never changed. If the section lacks
    both front and back skin, fail conservatively by retaining the old centre.
    """
    values=(cx,cy,rx,ry,profile_power,max_shift_m)
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
        raise ValueError("Anatomical centre fitting requires finite physical coordinates.")
    if rx <= 0 or ry <= 0 or not 2 <= profile_power <= 4 or not 0 <= max_shift_m <= 0.020:
        raise ValueError("Anatomical centre fit cannot alter locked garment bounds.")
    points=[tuple(p) for p in section]
    if not points or not all(
        len(p)==3 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in p)
        for p in points
    ):
        raise ValueError("Cannot fit a garment section without real body samples.")
    if max_shift_m==0:
        return cy
    ys=sorted(p[1] for p in points)
    lower=ys[min(len(ys)-1,int(len(ys)*0.05))]
    upper=ys[min(len(ys)-1,int(len(ys)*0.95))]
    # If the cross-section is all front OR all back, it may be a hanging arm:
    # do not move the entire locked shirt just to enclose a false torso point.
    if lower >= cy-0.035 or upper <= cy+0.035:
        return cy
    def peak(candidate):
        return max(
            ((abs(p[0]-cx)/rx)**profile_power
             + (abs(p[1]-candidate)/ry)**profile_power)**(1/profile_power)
            for p in points
        )
    candidates=[cy + max_shift_m * i/6 for i in range(-6,7)]
    return min(candidates,key=lambda y:(peak(y),abs(y-cy)))


def rounded_tailoring_ring_xy(angle, cx, cy, radius_x, radius_y, *, profile_power=2.0):
    """A smooth physically bounded garment cross-section preserving X/Y widths.

    p=2 is the conventional ellipse; p=3 is a softly squared shirt torso.
    Changes construction shape without scaling the locked body or increasing
    garment waist/shoulder guide measurements.
    """
    values = (angle, cx, cy, radius_x, radius_y, profile_power)
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
        raise ValueError("Garment ring section needs finite numeric coordinates.")
    if not 2.0 <= profile_power <= 4.0 or radius_x <= 0 or radius_y <= 0:
        raise ValueError("Garment ring cross-section requires bounded curvature and positive radii.")
    cosine, sine = math.cos(angle), math.sin(angle)
    power = 2.0 / profile_power
    return (
        cx + math.copysign(abs(cosine) ** power, cosine) * radius_x,
        cy + math.copysign(abs(sine) ** power, sine) * radius_y,
    )


def outward_ring_quad(previous, current, segment, next_segment, *, ascending):
    """Consistently orient a vertical garment panel's outward normals.

    CCW X/Y rings are indexed at each level. Faces joining low -> high use
    one winding; high -> low (sleeves and trousers) MUST reverse it. Blender's
    SOLIDIFY uses the face normal to choose the physical cloth-thickness side.
    A wrong winding extrudes the trousers and cuffs INTO the real model.
    """
    if not all(isinstance(v,int) and not isinstance(v,bool) and v >= 0
               for v in (previous,current,segment,next_segment)):
        raise ValueError("Ring quad indices must be finite nonnegative integers.")
    if not isinstance(ascending,bool):
        raise ValueError("Ring direction must be explicit.")
    if ascending:
        return (previous+segment,previous+next_segment,
                current+next_segment,current+segment)
    return (previous+segment,current+segment,
            current+next_segment,previous+next_segment)


def nested_tucked_hem_ring(z, center_x, waist_y, trouser_radius_x, trouser_radius_y, *, inset_m=0.007):
    """Position the last 35mm of a tucked shirt under its actual trouser waist.

    Both rings reference the same locked human hip section. The tucked shirt
    must be inside the waistband with a finite (non-z-fighting) cloth gap;
    otherwise a barrel-shaped floating shirt appears in front/side/back.
    """
    values=(z,center_x,waist_y,trouser_radius_x,trouser_radius_y,inset_m)
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
        raise ValueError("Tucked shirt dimensions must be finite.")
    if not (0.001 <= inset_m <= 0.015) or trouser_radius_x <= inset_m or trouser_radius_y <= inset_m:
        raise ValueError("Tuck inset must leave positive cloth radii and a genuine layering gap.")
    return (z,center_x,waist_y,trouser_radius_x-inset_m,trouser_radius_y-inset_m)


def sampled_mesh_face_indices(face_count, max_samples=600):
    """Bound Blender mesh face sampling without slicing RNA collections.

    Blender 4.2 bpy_prop_collection loop_triangles does not reliably support
    stepped slices. Return ordinary Python range indices for indexed access.
    """
    if (
        isinstance(face_count,bool) or not isinstance(face_count,int) or face_count<0
        or isinstance(max_samples,bool) or not isinstance(max_samples,int)
        or not 1 <= max_samples <= 2000
    ):
        raise ValueError("Face-sampling limits must be nonnegative integer counts.")
    if not face_count:
        return range(0)
    stride=max(1,math.ceil(face_count/max_samples))
    return range(0,face_count,stride)[:max_samples]


def adaptive_surface_cut_rounds(longest_edge_m, target_edge_m=0.025, max_rounds=3):
    """Bound mesh refinement before resolving hidden face/body intersections.

    Each pass bisects the overlong edges on a physical cloth surface. Repeating
    vertex/BVH repair after refinement lets the original 95mm limit remain
    strict while exposing body penetrations between the old guide vertices.
    """
    if (
        isinstance(longest_edge_m, bool) or
        not isinstance(longest_edge_m,(int,float)) or
        not math.isfinite(longest_edge_m) or longest_edge_m < 0 or
        isinstance(target_edge_m,bool) or
        not isinstance(target_edge_m,(int,float)) or
        not math.isfinite(target_edge_m) or not 0.008 <= target_edge_m <= 0.055 or
        isinstance(max_rounds,bool) or not isinstance(max_rounds,int) or not 1 <= max_rounds <= 5
    ):
        raise ValueError("Adaptive garment refinement requires finite physical lengths and bounded passes.")
    if longest_edge_m <= target_edge_m:
        return 0
    rounds=math.ceil(math.log2(longest_edge_m/target_edge_m))
    if rounds > max_rounds:
        raise ValueError("Garment face spans exceed safe collision-refinement limits.")
    return rounds


def reproject_vertex_to_fitted_ring(point, previous_ring, fitted_ring):
    """Apply the real body fit to a mesh vertex while retaining construction Z.

    This geometry-only helper is used after Blender's identity normalization,
    so a measured intermediate ring that moves toward the actual torso posture
    cannot be silently discarded by the subsequent mesh-reprojection pass.
    """
    if len(point) != 3 or len(previous_ring) != 5 or len(fitted_ring) != 5:
        raise ValueError("Fitted garments require 3D points and five-field ring profiles.")
    values=tuple(point)+tuple(previous_ring)+tuple(fitted_ring)
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in values):
        raise ValueError("Fitted clothing vertices and guide rings must be finite.")
    if previous_ring[3] <= 0 or previous_ring[4] <= 0 or fitted_ring[3] <= 0 or fitted_ring[4] <= 0:
        raise ValueError("Physical garment ring radii must stay positive.")
    if abs(point[2]-previous_ring[0]) > 0.001 or abs(fitted_ring[0]-previous_ring[0]) > 1e-8:
        raise ValueError("Posture fitting must preserve garment construction height.")
    sx=fitted_ring[3]/previous_ring[3]
    sy=fitted_ring[4]/previous_ring[4]
    return (
        fitted_ring[1]+(point[0]-previous_ring[1])*sx,
        fitted_ring[2]+(point[1]-previous_ring[2])*sy,
        point[2],
    )


def belongs_to_locked_shirt_trunk(z, shoulder_guide_z, *, tolerance_m=0.002):
    """Classify genuine shirt trunk rings, excluding collar/neck construction.

    The real collar stand is physically narrower than the torso and extends
    ABOVE the locked shoulder seam. Running full-chest body-enclosure against
    that neck ring invents hundreds of mm of cloth and fails correctly. Leave
    collar construction to its own neck-junction/skin clearance QA.
    """
    for value in (z, shoulder_guide_z, tolerance_m):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("Locked shoulder and shirt ring heights must be finite.")
    if not 0 <= tolerance_m <= 0.005:
        raise ValueError("Shirt shoulder guide tolerance must remain physically bounded.")
    return z <= shoulder_guide_z + tolerance_m


def terminal_face_patch_allowed(face_hits, edge_hits, *, limit=8):
    """Only patch a tiny FACE-ONLY residue after bounded edge projection.

    After five actual BVH subdivisions the remaining issue can be a handful
    of triangle interiors lying through curved human anatomy although every
    edge is clear. A coherent, bounded movement of whole adjacent face regions is preferable to
    needlessly re-subdividing hundreds of already safe edges. This never
    declares a penetration safe: the resulting mesh must be re-tested.
    """
    for value in (face_hits,edge_hits,limit):
        if isinstance(value,bool) or not isinstance(value,int) or value<0:
            raise ValueError("Collision refinement must use exact nonnegative face counts.")
    if not 1 <= limit <= 16:
        raise ValueError("Terminal cloth patch count must remain tightly bounded.")
    return 0 < face_hits <= limit and edge_hits == 0


def needs_tailoring_face_triangulation(vertex_count):
    """A giant BMesh ngon is not a physical cloth panel for centre collision QA.

    Blender edge subdivision can leave one polygon with dozens of ring points.
    Its arithmetic 'centroid' may sit well inside human anatomy even though
    the actual visible mesh is triangulated differently. Split only n-gons
    (>4 vertices) into genuine local triangles before BVH face tests.
    """
    if isinstance(vertex_count, bool) or not isinstance(vertex_count, int) or vertex_count < 0:
        raise ValueError("Real cloth faces require nonnegative vertex counts.")
    return vertex_count > 4


def waist_to_chest_taper_radius(waist_half_width_m, height_above_waist_m,
                                *, ease_m=0.008, slope=0.32):
    """Limit false arm-driven inflation of a REAL tucked shirt side seam.

    Near the locked waist a garment cannot gain 90mm of radius in only 16mm
    height. The body-fit sampler may include a hanging arm in the shirt torso
    band; enforce source PANEL continuity before strict body/cloth BVH fitting.
    This never loosens skin clearance, moves the model, or edits the waist ring.
    """
    values=(waist_half_width_m,height_above_waist_m,ease_m,slope)
    if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v)
           for v in values):
        raise ValueError("Shirt waist taper requires finite physical dimensions.")
    if not (0.08 <= waist_half_width_m <= 0.25
            and 0 <= height_above_waist_m <= 0.50
            and 0 <= ease_m <= 0.025 and 0.15 <= slope <= 0.9):
        raise ValueError("Shirt waist taper exceeds physically bounded tailoring shape.")
    return waist_half_width_m + ease_m + slope * height_above_waist_m


def body_aware_sleeve_ring(body_points, ring, *, body_center_x, side,
                           clearance_m=0.007, locked_hand_center=False,
                           sample_band_m=0.035, min_arm_distance_m=0.172):
    """Fit sleeve surface to the actual independent arm, excluding torso points.

    The locked studio pose places hands at +/-250mm, but the real arm bends
    slightly through elbow/forearm. A global-Y tube crosses real skin even
    when its sparse guide vertices pass BVH tests. Locally sample the OUTER
    arm corridor, retain the actual 3D identity and cuff centre, and reshape
    only cloth radii/centres within strict, measured bounds.
    """
    if side not in (-1,1) or isinstance(side,bool):
        raise ValueError("Arm side must be explicitly -1 or +1.")
    vals=tuple(ring)+(body_center_x,clearance_m,sample_band_m,min_arm_distance_m)
    if len(ring)!=5 or any(isinstance(v,bool) or not isinstance(v,(int,float))
            or not math.isfinite(v) for v in vals):
        raise ValueError("Arm sleeve profile requires five finite physical dimensions.")
    z,cx,cy,rx,ry=ring
    if rx<=0 or ry<=0 or not 0.003<=clearance_m<=0.020 or not 0.020<=sample_band_m<=0.060 or not 0.160<=min_arm_distance_m<=0.225:
        raise ValueError("Sleeve fit must preserve positive physical clearances.")
    points=[
        point for point in body_points
        if len(point)==3 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in point)
        and abs(point[2]-z)<=sample_band_m
        and abs(point[0]-cx)<=0.100
        and abs(point[1]-cy)<=0.145
        and side*(point[0]-body_center_x)>=min_arm_distance_m
    ]
    if len(points)<16:
        raise ValueError(
            f"Locked body offers only {len(points)} measured arm samples "
            f"at z={z:.4f}m: refusing generic sleeve tube."
        )
    xs=sorted(point[0] for point in points)
    ys=sorted(point[1] for point in points)
    low=min(len(points)-1,int(len(points)*0.02))
    high=min(len(points)-1,int(len(points)*0.98))
    fitted_cx=(xs[low]+xs[high])/2
    fitted_cy=(ys[low]+ys[high])/2
    # Lock photographed 500mm hand-centre identity at the cuff. Else let
    # the upper sleeve follow the actual arm up to 28mm laterally.
    # Inward shifts collapse the upper sleeve into the torso, causing real
    # BVH 95mm failures. Keep the armhole lateral, following only measured
    # OUTWARD changes without moving the locked cuff hand centre.
    measured_x=max(0.0,side*(fitted_cx-cx))
    shift_x=0.0 if locked_hand_center else side*min(0.028,measured_x)
    shift_y=max(-0.050,min(0.050,fitted_cy-cy))
    next_cx=cx+shift_x
    next_cy=cy+shift_y
    # Preserve original ease, then include real arm samples and modest
    # 8mm sewing allowance. Never flatten the sleeve against bare skin.
    next_rx=max(rx,abs(xs[low]-next_cx)+clearance_m+0.008,
                abs(xs[high]-next_cx)+clearance_m+0.008)
    next_ry=max(ry,abs(ys[low]-next_cy)+clearance_m+0.008,
                abs(ys[high]-next_cy)+clearance_m+0.008)
    if next_rx-rx>0.070 or next_ry-ry>0.070:
        raise ValueError("Measured arm would need >70mm sleeve radius growth.")
    return ((z,next_cx,next_cy,next_rx,next_ry),{
        "method":"real-body-arm-only-quantile-envelope",
        "sampleCount":len(points),
        "sampleBandMm":round(sample_band_m*1000,2),
        "armInnerBoundaryMm":round(min_arm_distance_m*1000,2),
        "centerShiftMm":[round(shift_x*1000,2),round(shift_y*1000,2)],
        "radiusGrowthMm":[round((next_rx-rx)*1000,2),
                         round((next_ry-ry)*1000,2)],
        "handCenterLocked":locked_hand_center,
    })


def underarm_inboard_relief_m(z, signed_inboard_m, waist_guide_z, *,
                              half_span_m=0.095, max_relief_m=0.032):
    """Smoothly shape the INTERIOR upper sleeve away from the real side torso.

    Real Blender QA consistently found a stubborn 1.12-1.18m armpit contact:
    at the waist+41mm ring the inward sleeve quadrant cuts across torso
    while arm-centred outer sleeve mesh is clean. This is a *bounded source
    garment panel shaping*, never an edit to the locked human body.
    """
    values=(z,signed_inboard_m,waist_guide_z,half_span_m,max_relief_m)
    if any(isinstance(v,bool) or not isinstance(v,(int,float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Underarm relief requires finite garment coordinates.")
    if not (0.04 <= half_span_m <= 0.13 and 0 <= max_relief_m <= 0.045):
        raise ValueError("Underarm relief must remain a bounded cloth-only alteration.")
    centre_z=waist_guide_z+0.050
    normalized_z=abs(z-centre_z)/half_span_m
    if normalized_z>=1 or signed_inboard_m<=0:
        return 0.0
    # Only the sleeve's anatomical torso-facing quadrant is reshaped;
    # the outside silhouette, hand centre, shoulder seam and forearm remain.
    across=min(1.0,signed_inboard_m/0.055)
    eased_z=(1-normalized_z**2)**2
    eased_across=across*across*(3-2*across)
    return max_relief_m*eased_z*eased_across
