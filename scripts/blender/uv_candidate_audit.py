"""Candidate-only UV topology diagnostics; no supplier repeat is inferred.

Evaluate UV triangle area against 3D surface area. A pass means a finite,
noncollapsed candidate map, NOT physically calibrated textile scale.
"""
from __future__ import annotations

import math



def estimate_source_tube_radius_m(source_vertex_positions):
    """Estimate candidate tube radius ONLY from indexed garment XYZ in metres.

    Both the author and independent preflight must derive the estimate from
    the actual garment mesh; an unchecked scene property must never decide
    whether a UV jump resembles an integer cylinder circumference. This is
    geometrical provenance, not mill textile dimensions or grain approval.
    """
    try:
        points = list(source_vertex_positions)
    except TypeError as exc:
        raise ValueError("Tube radius estimate needs iterable mesh XYZ") from exc
    if len(points) < 3:
        raise ValueError("Tube radius estimate needs at least three source vertices")
    for point in points:
        try:
            values = tuple(point)
        except TypeError as exc:
            raise ValueError("Tube radius estimate requires XYZ triples") from exc
        if (len(values) != 3 or any(
            isinstance(value, (str, bytes, bool))
            or not isinstance(value, (float, int))
            or not math.isfinite(value) for value in values
        )):
            raise ValueError("Tube radius estimate requires finite mesh metres")
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    cx, cy = (min(xs)+max(xs))*0.5, (min(ys)+max(ys))*0.5
    radii = sorted(math.hypot(point[0]-cx, point[1]-cy) for point in points)
    radius_m = radii[len(radii)//2]
    if not math.isfinite(radius_m) or radius_m <= 0.015:
        raise ValueError("Degenerate geometry-only source tube estimate")
    return radius_m


def verify_evaluated_tube_radius_m(source_vertex_positions, declared_radius_mm, *,
                                   max_delta_mm=0.05):
    """Reject altered or stale tube metadata against evaluated Blender vertices.

    Scene float32 quantization and author's 0.001-mm metadata rounding are
    bounded to 0.05 mm. This does not authenticate fabric circumference.
    """
    if (isinstance(max_delta_mm, (str, bytes, bool))
            or not isinstance(max_delta_mm, (int, float))
            or not math.isfinite(max_delta_mm)
            or not 0 <= max_delta_mm <= 0.05):
        raise ValueError("Source radius tolerance must be finite and <=0.05 mm")
    if (isinstance(declared_radius_mm, (str, bytes, bool))
            or not isinstance(declared_radius_mm, (int, float))
            or not math.isfinite(declared_radius_mm) or declared_radius_mm <= 15):
        raise ValueError("Missing valid geometry radius metadata in millimetres")
    evaluated_radius_mm = estimate_source_tube_radius_m(source_vertex_positions)*1000
    delta_mm = abs(evaluated_radius_mm - declared_radius_mm)
    if delta_mm > max_delta_mm:
        raise ValueError(
            f"Tube radius metadata contradicts evaluated source geometry "
            f"by {delta_mm:.4f} mm"
        )
    return {
        "geometryRadiusIndependentlyVerified": True,
        "evaluatedGeometryRadiusMm": round(evaluated_radius_mm, 4),
        "metadataDeltaMm": round(delta_mm, 4),
        "physicalTextileCircumferenceVerified": False,
        "productionApproved": False,
    }


def metric_planar_uv(point_xyz, *, origin_x, origin_z):
    """Return geometry-only X/Z UV in mesh metres, not per-panel 0..1.

    Not a calibration for grain, real fabric repeat, curved cylinders or hems.
    """
    if len(point_xyz) != 3:
        raise ValueError("Expected one 3D garment vertex")
    if any(isinstance(value, (str, bytes, bool)) or not isinstance(value, (int, float))
           or not math.isfinite(value)
           for value in (*point_xyz, origin_x, origin_z)):
        raise ValueError("Metric UV projection needs finite numeric coordinates")
    return (point_xyz[0] - origin_x, point_xyz[2] - origin_z)


def cylindrical_metric_face_uv(points_xyz, *, center_xy, radius_m, origin_z):
    """Geometry-estimated circumferential U / vertical V for ONE mesh face.

    Unwrap +/-pi at the face seam using per-loop UVs. The reference radius is
    obtained from the authored shell geometry, NOT supplier fabric dimensions.
    A face spanning over half a revolution is ambiguous and must fail closed.
    """
    if len(points_xyz) < 3 or len(center_xy) != 2:
        raise ValueError("Expected at least three XYZ vertices and XY centre")
    values = [*center_xy, radius_m, origin_z]
    for point in points_xyz:
        if len(point) != 3:
            raise ValueError("Cylindrical UV requires full 3D vertex coordinates")
        values.extend(point)
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Cylindrical UV requires finite numeric metric coordinates")
    if radius_m <= 1e-5:
        raise ValueError("Degenerate cylindrical UV geometry radius")

    cx, cy = center_xy
    angles = [math.atan2(point[1] - cy, point[0] - cx) for point in points_xyz]
    initial_angle = angles[0]
    unwrapped = [initial_angle] + [
        initial_angle + math.atan2(math.sin(a - initial_angle),
                                   math.cos(a - initial_angle))
        for a in angles[1:]
    ]
    if max(unwrapped) - min(unwrapped) >= math.pi:
        raise ValueError("Candidate UV polygon crosses an ambiguous half-cylinder seam")
    return [(radius_m * angle, point[2] - origin_z)
            for angle, point in zip(unwrapped, points_xyz)]



def cylindrical_ambiguous_face_diagnostic(points_xyz, *, center_xy):
    """Describe rejected UV face geometry without inventing a cloth seam.

    The result describes real mesh-space XYZ bounds and the estimated
    cylindrical angle span. It is not an unwrap, grain alignment, supplier
    measurement, photo certificate or reason to bypass a failed preflight.
    """
    if len(points_xyz) < 3 or len(center_xy) != 2:
        raise ValueError("Ambiguous face receipt requires >=3 XYZ vertices and XY centre")
    values = [*center_xy]
    for p in points_xyz:
        if len(p) != 3:
            raise ValueError("Ambiguous face receipt requires 3D coordinates")
        values.extend(p)
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Ambiguous face receipt requires finite metric coordinates")
    cx, cy = center_xy
    angles = [math.atan2(p[1] - cy, p[0] - cx) for p in points_xyz]
    initial = angles[0]
    unwrapped = [initial] + [
        initial + math.atan2(math.sin(a - initial), math.cos(a - initial))
        for a in angles[1:]
    ]
    return {
        "vertexCount": len(points_xyz),
        "angularSpanDegrees": round(math.degrees(max(unwrapped) - min(unwrapped)), 2),
        "xRangeMetres": [round(min(p[0] for p in points_xyz), 5),
                         round(max(p[0] for p in points_xyz), 5)],
        "yRangeMetres": [round(min(p[1] for p in points_xyz), 5),
                         round(max(p[1] for p in points_xyz), 5)],
        "zRangeMetres": [round(min(p[2] for p in points_xyz), 5),
                         round(max(p[2] for p in points_xyz), 5)],
        "supplierRepeatVerified": False,
        "fabricGrainVerified": False,
        "productionApproved": False,
    }



def metric_tangent_chart_uv(points_xyz):
    """Local metric face chart for geometry crossing a cylindrical-axis seam.

    The UV distances use orthonormal surface tangent axes in METRES, avoiding
    near-axis angular singularities and compressed XZ planar fallback. This
    intentionally creates a separate unapproved chart island: joining its
    stripes/grain to surrounding tubular faces requires actual seam authoring
    and review. It never certifies supplier scale, grain or production.
    """
    if len(points_xyz) < 3:
        raise ValueError("Metric tangent chart requires at least three vertices")
    values = []
    for p in points_xyz:
        if len(p) != 3:
            raise ValueError("Metric tangent chart needs XYZ coordinates")
        values.extend(p)
    if any(isinstance(v, (bool, str, bytes)) or not isinstance(v, (int, float))
           or not math.isfinite(v) for v in values):
        raise ValueError("Metric tangent chart needs finite mesh coordinates")
    # Newell's polygon normal accommodates source quads and avoids choosing
    # the first three almost-collinear vertices.
    nx = ny = nz = 0.0
    for a, b in zip(points_xyz, points_xyz[1:] + points_xyz[:1]):
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    length = math.sqrt(nx*nx + ny*ny + nz*nz)
    if length < 1e-10:
        raise ValueError("Metric tangent chart rejects degenerate source face")
    normal = (nx/length, ny/length, nz/length)
    # Keep grain V aligned with garment vertical wherever geometrically
    # possible. Horizontal cap faces have no meaningful vertical tangent;
    # there choose the face's longest physical edge and retain review flag.
    up_projection = (-normal[0]*normal[2], -normal[1]*normal[2],
                     1-normal[2]*normal[2])
    v_norm = math.sqrt(sum(t*t for t in up_projection))
    if v_norm < 1e-5:
        edges = [tuple(b[k]-a[k] for k in range(3))
                 for a, b in zip(points_xyz, points_xyz[1:] + points_xyz[:1])]
        chosen = max(edges, key=lambda edge: sum(t*t for t in edge))
        v_norm = math.sqrt(sum(t*t for t in chosen))
        if v_norm < 1e-10:
            raise ValueError("Metric tangent chart has no nonzero edge")
        v_axis = tuple(t/v_norm for t in chosen)
    else:
        v_axis = tuple(t/v_norm for t in up_projection)
    # u = v cross n produces a true orthogonal unit tangent basis; no scale
    # normalization by panel dimensions or silently inferred fabric repeat.
    u_axis = (v_axis[1]*normal[2]-v_axis[2]*normal[1],
              v_axis[2]*normal[0]-v_axis[0]*normal[2],
              v_axis[0]*normal[1]-v_axis[1]*normal[0])
    origin = points_xyz[0]
    return [
        (sum((p[k]-origin[k])*u_axis[k] for k in range(3)),
         sum((p[k]-origin[k])*v_axis[k] for k in range(3)))
        for p in points_xyz
    ]



def audit_shared_uv_edges(faces, *, tolerance_m=1e-5, sample_limit=12):
    """Audit UV continuity across ACTUALLY shared source-mesh polygon edges.

    Faces are ordered polygons of (vertex_id, (u, v)) corners. Coordinates are
    mesh metres; a local face chart starting at the origin is not stitched.
    Intentionally cut seams still need separate approval and fabric evidence.
    """
    from collections import defaultdict

    if (isinstance(tolerance_m, (str, bytes, bool))
            or not isinstance(tolerance_m, (float, int))
            or not math.isfinite(tolerance_m) or tolerance_m <= 0):
        raise ValueError("UV seam tolerance must be finite and positive")
    if isinstance(sample_limit, bool) or not isinstance(sample_limit, int) or sample_limit < 0:
        raise ValueError("UV seam sample limit must be a nonnegative integer")
    edges = defaultdict(list)
    polygon_count = 0
    for face_index, face in enumerate(faces):
        polygon_count += 1
        if len(face) < 3:
            raise ValueError("UV seam audit requires polygon faces of >=3 corners")
        corners = []
        for corner in face:
            if len(corner) != 2:
                raise ValueError("Each UV face corner needs a vertex id and UV pair")
            vertex, uv = corner
            if isinstance(vertex, bool) or not isinstance(vertex, int) or vertex < 0:
                raise ValueError("UV seam audit requires nonnegative integer vertex ids")
            if len(uv) != 2 or any(
                isinstance(n, (str, bytes, bool)) or not isinstance(n, (float, int))
                or not math.isfinite(n) for n in uv
            ):
                raise ValueError("UV seam audit requires finite metre UVs")
            corners.append((vertex, (float(uv[0]), float(uv[1]))))
        if len({vertex for vertex, _ in corners}) != len(corners):
            raise ValueError("UV seam audit rejects repeated polygon corner vertices")
        for a, b in zip(corners, corners[1:] + corners[:1]):
            vertex_a, uv_a = a
            vertex_b, uv_b = b
            key = (min(vertex_a, vertex_b), max(vertex_a, vertex_b))
            # Compare shared edges by SOURCE vertex, not by opposite loop order.
            edges[key].append((face_index, {vertex_a: uv_a, vertex_b: uv_b}))

    if not polygon_count:
        raise ValueError("UV seam audit cannot certify an empty mesh")
    shared = nonmanifold = boundary = unapproved = 0
    max_jump_m = 0.0
    sample = []
    for edge, entries in edges.items():
        if len(entries) == 1:
            boundary += 1
        elif len(entries) > 2:
            nonmanifold += 1
        else:
            shared += 1
            first, second = entries
            jump_m = max(
                math.dist(first[1][vertex], second[1][vertex]) for vertex in edge
            )
            max_jump_m = max(max_jump_m, jump_m)
            if jump_m > tolerance_m:
                unapproved += 1
                if len(sample) < sample_limit:
                    sample.append({
                        "sourceEdgeVertices": list(edge),
                        "sourcePolygonIndices": [first[0], second[0]],
                        "maxUvEndpointJumpMm": round(jump_m * 1000, 5),
                    })
    return {
        "polygonCount": polygon_count,
        "sharedInteriorEdges": shared,
        "boundaryEdges": boundary,
        "nonManifoldEdges": nonmanifold,
        "unapprovedInteriorUvSeams": unapproved,
        "maxInteriorUvJumpMm": round(max_jump_m * 1000, 5),
        "sampleUnapprovedSeams": sample,
        "topologicalUvContinuityPass": unapproved == 0 and nonmanifold == 0,
        "supplierRepeatVerified": False,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }



def phase_align_cylindrical_charts(faces, *, radius_m, excluded_face_indices=(), tolerance_m=1e-5):
    """Remove only proven full-turn U offsets between adjacent cylindrical faces.

    The radius is geometry-estimated, NOT supplier measured. A constant
    integer-circumference shift preserves metre texture density and cannot
    repair a tangent chart, twisted face or cut seam. Those remain unapproved.
    """
    from collections import defaultdict, deque

    if (isinstance(radius_m, (str, bytes, bool))
            or not isinstance(radius_m, (int, float))
            or not math.isfinite(radius_m) or radius_m <= 1e-5):
        raise ValueError("Phase stitching needs finite positive tube radius")
    # Includes complete topology and finite-coordinate validation.
    initial = audit_shared_uv_edges(faces, tolerance_m=tolerance_m)
    ignored = set(excluded_face_indices)
    if any(isinstance(i, bool) or not isinstance(i, int) or i < 0 or i >= len(faces)
           for i in ignored):
        raise ValueError("Phase excluded face indices must refer to real polygons")
    period = 2 * math.pi * radius_m
    edges = defaultdict(list)
    for face_index, face in enumerate(faces):
        if face_index in ignored:
            continue
        for a, b in zip(face, face[1:] + face[:1]):
            key = (min(a[0], b[0]), max(a[0], b[0]))
            edges[key].append((face_index, {a[0]: a[1], b[0]: b[1]}))
    adjacency = defaultdict(list)
    alignable_edges = 0
    for edge, entries in edges.items():
        if len(entries) != 2:
            continue
        (left_i, left), (right_i, right) = entries
        du = [left[i][0] - right[i][0] for i in edge]
        dv = [abs(left[i][1] - right[i][1]) for i in edge]
        turns = round(sum(du) / len(du) / period)
        if all(abs(d - turns * period) <= tolerance_m for d in du) and max(dv) <= tolerance_m:
            adjacency[left_i].append((right_i, turns))
            adjacency[right_i].append((left_i, -turns))
            alignable_edges += 1
    def continuous_source_edges(mesh_faces):
        """Protect every pre-existing continuous source edge, including exclusions."""
        shared = defaultdict(list)
        for face in mesh_faces:
            for a, b in zip(face, face[1:] + face[:1]):
                key = (min(a[0], b[0]), max(a[0], b[0]))
                shared[key].append({a[0]: a[1], b[0]: b[1]})
        return {
            edge for edge, uses in shared.items() if len(uses) == 2
            and max(math.dist(uses[0][vid], uses[1][vid]) for vid in edge) <= tolerance_m
        }

    before_continuous = continuous_source_edges(faces)
    # Components are independent only under the *proven integer phase*
    # adjacency graph. Rejection of one component must never erase a valid,
    # disjoint correction elsewhere on a sleeve/leg. Each component trial is
    # committed only after a full, real shared-mesh-edge audit.
    visited = set()
    components = []
    phase_cycle_conflicts = 0
    for root in range(len(faces)):
        if root in visited or root in ignored:
            continue
        turns = {root: 0}
        visited.add(root)
        queue = deque([root])
        conflicts = 0
        while queue:
            face_index = queue.popleft()
            for neighbor, offset in adjacency[face_index]:
                expected = turns[face_index] + offset
                if neighbor not in turns:
                    turns[neighbor] = expected
                    visited.add(neighbor)
                    queue.append(neighbor)
                elif turns[neighbor] != expected:
                    conflicts += 1
        phase_cycle_conflicts += conflicts
        components.append((turns, conflicts))

    aligned = [[(vid, tuple(uv)) for vid, uv in face] for face in faces]
    current_audit = initial
    accepted_shifts = {}
    accepted_components = 0
    rejected_components = []
    protected_edge_regressions = 0
    for turns, conflicts in components:
        if conflicts:
            rejected_components.append("inconsistent_phase_cycle")
            continue
        shifted = {index: turn for index, turn in turns.items() if turn != 0}
        if not shifted:
            continue
        tentative = list(aligned)
        for index, turn in shifted.items():
            tentative[index] = [
                (vid, (uv[0] + turn*period, uv[1])) for vid, uv in faces[index]
            ]
        trial_audit = audit_shared_uv_edges(tentative, tolerance_m=tolerance_m)
        torn_protected = len(before_continuous - continuous_source_edges(tentative))
        protected_edge_regressions += torn_protected
        if torn_protected:
            rejected_components.append("previously_continuous_edge_broken")
        elif trial_audit["unapprovedInteriorUvSeams"] > current_audit["unapprovedInteriorUvSeams"]:
            rejected_components.append("uv_seam_count_increased")
        else:
            aligned = tentative
            current_audit = trial_audit
            accepted_shifts.update(shifted)
            accepted_components += 1

    return aligned, {
        "geometryEstimatedCircumferenceMm": round(period * 1000, 5),
        "phaseShiftedFaces": len(accepted_shifts),
        "phaseAlignableInteriorEdges": alignable_edges,
        "phaseCycleConflicts": phase_cycle_conflicts,
        "phaseCandidateRolledBack": bool(rejected_components),
        "phaseRollbackReason": rejected_components[0] if rejected_components else None,
        "phaseRejectedComponents": len(rejected_components),
        "phaseAcceptedComponents": accepted_components,
        "phaseRollbackReasons": rejected_components[:12],
        "wouldBreakPreviouslyContinuousSourceEdges": protected_edge_regressions,
        "excludedUnapprovedFaceCharts": len(ignored),
        "unapprovedInteriorUvSeamsBefore": initial["unapprovedInteriorUvSeams"],
        "unapprovedInteriorUvSeamsAfter": current_audit["unapprovedInteriorUvSeams"],
        "supplierRepeatVerified": False,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }



def align_metric_tangent_charts(faces, *, tangent_face_indices, tolerance_m=1e-5,
                                max_rotation_degrees=8.0):
    """Conservatively join local metric charts without changing texture scale.

    An ambiguous cylinder-axis face receives its own metre-scale tangent chart.
    Only a rigid 2D rotation/translation may attach it to an ALREADY anchored
    neighbour, and only when both actual shared-edge endpoints coincide and
    no previously continuous edge is broken. An eight-degree rotation limit
    avoids silently rewriting the intended vertical grain. This is a UV
    continuity experiment, never permission to label textile grain verified.
    """
    import collections

    before = audit_shared_uv_edges(faces, tolerance_m=tolerance_m)
    if (isinstance(max_rotation_degrees, (str, bytes, bool))
            or not isinstance(max_rotation_degrees, (int, float))
            or not math.isfinite(max_rotation_degrees)
            or not 0 <= max_rotation_degrees <= 15):
        raise ValueError("Metric tangent chart rotation must be finite in [0,15] degrees")
    try:
        tangent_indices = set(tangent_face_indices)
    except TypeError as error:
        raise ValueError("Metric tangent indices must be an iterable of polygon indices") from error
    if any(isinstance(i, bool) or not isinstance(i, int) or i < 0 or i >= len(faces)
           for i in tangent_indices):
        raise ValueError("Metric tangent indices must refer to existing polygons")
    working = [[(vid, (float(uv[0]), float(uv[1]))) for vid, uv in face]
               for face in faces]

    def report(aligned, rejected_topology=False):
        after = audit_shared_uv_edges(working, tolerance_m=tolerance_m)
        return working, {
            "originalUnapprovedInteriorUvSeams": before["unapprovedInteriorUvSeams"],
            "remainingUnapprovedInteriorUvSeams": after["unapprovedInteriorUvSeams"],
            "tangentChartFaces": len(tangent_indices),
            "rigidlyAlignedTangentChartFaces": len(aligned),
            "alignedSourcePolygonIndices": sorted(aligned),
            "unresolvedTangentChartFaces": len(tangent_indices - aligned),
            "nonManifoldTopologyRejected": rejected_topology,
            "supplierRepeatVerified": False,
            "supplierGrainVerified": False,
            "seamLayoutApproved": False,
            "productionApproved": False,
        }

    # Never edit charts on ambiguous edge adjacency. Genuine nonmanifold
    # geometry must be repaired upstream instead of masked by UV changes.
    if before["nonManifoldEdges"]:
        return report(set(), rejected_topology=True)

    edge_uses = collections.defaultdict(list)
    for i, face in enumerate(working):
        for (a, _), (b, _) in zip(face, face[1:] + face[:1]):
            edge_uses[(min(a, b), max(a, b))].append(i)
    neighbours = collections.defaultdict(list)
    for edge, indices in edge_uses.items():
        if len(indices) == 2:
            a, b = indices
            neighbours[a].append((b, edge))
            neighbours[b].append((a, edge))

    def corners(index):
        return dict(working[index])

    def edge_jump(index, other, edge, overrides=None):
        mine = overrides if overrides is not None else corners(index)
        theirs = corners(other)
        return max(math.dist(mine[vertex], theirs[vertex]) for vertex in edge)

    aligned = set()
    pending = set(tangent_indices)
    # Each iteration locks at most one face to the already-anchored chart
    # network. No metric UV scale change, reflection or unconstrained warp.
    while pending:
        best = None
        for index in sorted(pending):
            original = corners(index)
            for neighbour, edge in neighbours[index]:
                if neighbour in pending:
                    continue
                anchor = corners(neighbour)
                a, b = edge
                sx, sy = original[b][0]-original[a][0], original[b][1]-original[a][1]
                tx, ty = anchor[b][0]-anchor[a][0], anchor[b][1]-anchor[a][1]
                src_length, target_length = math.hypot(sx, sy), math.hypot(tx, ty)
                if (src_length <= tolerance_m or target_length <= tolerance_m
                        or abs(src_length-target_length) > tolerance_m):
                    continue
                theta = math.atan2(sx*ty-sy*tx, sx*tx+sy*ty)
                degrees = abs(math.degrees(theta))
                if degrees > max_rotation_degrees:
                    continue
                cos_t, sin_t = math.cos(theta), math.sin(theta)
                rotated_a = (cos_t*original[a][0]-sin_t*original[a][1],
                             sin_t*original[a][0]+cos_t*original[a][1])
                offset = (anchor[a][0]-rotated_a[0], anchor[a][1]-rotated_a[1])
                changed = {
                    vid: (cos_t*uv[0]-sin_t*uv[1]+offset[0],
                          sin_t*uv[0]+cos_t*uv[1]+offset[1])
                    for vid, uv in original.items()
                }
                if edge_jump(index, neighbour, edge, changed) > tolerance_m:
                    continue
                before_bad = after_bad = 0
                broken_good_edge = False
                for other, shared_edge in neighbours[index]:
                    previous = edge_jump(index, other, shared_edge)
                    resulting = edge_jump(index, other, shared_edge, changed)
                    if previous <= tolerance_m and resulting > tolerance_m:
                        broken_good_edge = True
                        break
                    before_bad += previous > tolerance_m
                    after_bad += resulting > tolerance_m
                gain = before_bad - after_bad
                if broken_good_edge or gain <= 0:
                    continue
                score = (gain, -degrees, -index, -neighbour)
                if best is None or score > best[0]:
                    best = (score, index, changed)
        if best is None:
            break
        _, index, changed = best
        working[index] = [(vid, changed[vid]) for vid, _ in working[index]]
        pending.remove(index)
        aligned.add(index)
    return report(aligned)



def classify_unapproved_uv_seams(faces, *, radius_m, tangent_face_indices=(),
                                 tolerance_m=1e-5, sample_limit=16,
                                 source_vertex_positions=None):
    """Partition REAL shared-edge UV tears; every candidate cut stays unapproved.

    A valid full-turn jump is topologically unlike an arbitrary texture tear:
    the same integer circumference must separate BOTH shared UV endpoints and
    neither V coordinate may drift. A tangent-chart edge remains separate even
    if the jump happens to resemble a cylinder seam. Nothing here establishes
    a sewn seam, factory grain or actual material repeat.
    """
    from collections import defaultdict

    topology = audit_shared_uv_edges(faces, tolerance_m=tolerance_m,
                                     sample_limit=sample_limit)
    if (isinstance(radius_m, (bool, str, bytes))
            or not isinstance(radius_m, (int, float))
            or not math.isfinite(radius_m) or radius_m <= 1e-5):
        raise ValueError("UV cut classifier needs a finite geometry tube radius")
    try:
        tangent_indices = set(tangent_face_indices)
    except TypeError as error:
        raise ValueError("Tangent chart indices must be iterable") from error
    if any(isinstance(i, bool) or not isinstance(i, int) or i < 0 or i >= len(faces)
           for i in tangent_indices):
        raise ValueError("Invalid source tangent chart face index")
    # Positions come from the actual current source mesh, not supplier fabric.
    # Only calculate physical cut-path lengths when metre XYZ is explicitly
    # supplied; pure UV-only regressions remain valid with no invented lengths.
    positions = None
    if source_vertex_positions is not None:
        try:
            positions = list(source_vertex_positions)
        except TypeError as exc:
            raise ValueError("Source seam geometry needs indexed XYZ coordinates") from exc
        if not positions:
            raise ValueError("Source seam geometry cannot be empty")
        for vertex in positions:
            if (len(vertex) != 3 or any(
                isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
                or not math.isfinite(v) for v in vertex
            )):
                raise ValueError("Source seam geometry needs finite metre XYZ")
        source_ids = [vid for face in faces for vid, _ in face]
        if any(vid >= len(positions) for vid in source_ids):
            raise ValueError("Source seam geometry missing actual vertex IDs")

    def source_edge_metric(edge):
        if positions is None:
            return None
        a, b = (positions[vertex] for vertex in edge)
        length = math.dist(a, b)
        vertical = abs(a[2] - b[2])
        if not math.isfinite(length) or not math.isfinite(vertical):
            raise ValueError("Source seam edge has nonfinite geometric length")
        return length, vertical

    period = 2*math.pi*radius_m
    edge_uses = defaultdict(list)
    for face_index, face in enumerate(faces):
        for (v1, uv1), (v2, uv2) in zip(face, face[1:] + face[:1]):
            edge_uses[(min(v1, v2), max(v1, v2))].append(
                (face_index, {v1: uv1, v2: uv2})
            )
    counts = {
        "nearUnapprovedTangentChart": 0,
        "exactFullTurnCutCandidate": 0,
        "nonPeriodicUvTear": 0,
    }
    sample = []
    classified_source_edges = []
    source_metric_length_by_class = {name: 0.0 for name in counts}
    source_metric_vertical_by_class = {name: 0.0 for name in counts}
    zero_length_source_edges = 0
    for edge, uses in edge_uses.items():
        if len(uses) != 2:
            continue
        (left_index, left), (right_index, right) = uses
        delta_u = [left[vertex][0] - right[vertex][0] for vertex in edge]
        delta_v = [left[vertex][1] - right[vertex][1] for vertex in edge]
        jump = max(math.hypot(du, dv) for du, dv in zip(delta_u, delta_v))
        if jump <= tolerance_m:
            continue
        turns = round(sum(delta_u) / 2 / period)
        is_full_turn = (
            turns != 0
            and all(abs(du - turns*period) <= tolerance_m for du in delta_u)
            and all(abs(dv) <= tolerance_m for dv in delta_v)
        )
        if left_index in tangent_indices or right_index in tangent_indices:
            classification = "nearUnapprovedTangentChart"
        elif is_full_turn:
            classification = "exactFullTurnCutCandidate"
        else:
            classification = "nonPeriodicUvTear"
        counts[classification] += 1
        classified_source_edges.append((edge, classification))
        source_metric = source_edge_metric(edge)
        if source_metric is not None:
            length_m, vertical_m = source_metric
            source_metric_length_by_class[classification] += length_m
            source_metric_vertical_by_class[classification] += vertical_m
            if length_m <= 1e-10:
                zero_length_source_edges += 1
        if len(sample) < sample_limit:
            edge_sample = {
                "sourceEdgeVertices": list(edge),
                "sourcePolygonIndices": [left_index, right_index],
                "classification": classification,
                "integerCircumferenceTurns": turns if is_full_turn else None,
                "maxUvEndpointJumpMm": round(jump*1000, 5),
            }
            if source_metric is not None:
                edge_sample["geometryEdgeLengthMm"] = round(source_metric[0]*1000, 5)
                edge_sample["geometryAbsoluteVerticalRiseMm"] = round(source_metric[1]*1000, 5)
            sample.append(edge_sample)
    if sum(counts.values()) != topology["unapprovedInteriorUvSeams"]:
        raise RuntimeError("UV cut classification lost a genuine shared-edge discontinuity")

    # Real cut-placement work needs the entire connected edge topology rather
    # than the first few sample tears. Connected components are computed on
    # SOURCE VERTEX IDs, separately by failure class. These are diagnostic
    # chains only: a branching tear is not an approved garment seam.
    class_groups = {name: 0 for name in counts}
    chain_shape_counts = {"openPath": 0, "closedLoopCandidate": 0, "branched": 0}
    chain_samples = []
    # Samples are intentionally capped, but the inventory below is COMPLETE:
    # all source-edge groups contribute to physical-geometry diagnostics.
    group_metrics = {
        name: {
            "groupCount": 0,
            "edgeCount": 0,
            "branchedGroupCount": 0,
            "maxJunctionDegree": 0,
            "totalPathLengthMm": 0.0 if positions is not None else None,
            "longestPathLengthMm": 0.0 if positions is not None else None,
            "maxZSpanMm": 0.0 if positions is not None else None,
        }
        for name in counts
    }
    for name in counts:
        same_class = sorted(edge for edge, classification in classified_source_edges
                            if classification == name)
        incident = defaultdict(set)
        for edge in same_class:
            for vertex in edge:
                incident[vertex].add(edge)
        remaining = set(same_class)
        while remaining:
            seed = min(remaining)
            component, pending = set(), [seed]
            while pending:
                edge = pending.pop()
                if edge not in remaining:
                    continue
                remaining.remove(edge)
                component.add(edge)
                for vertex in edge:
                    pending.extend(sorted(incident[vertex] & remaining))
            degree = defaultdict(int)
            for edge in component:
                for vertex in edge:
                    degree[vertex] += 1
            ends = sorted(vertex for vertex, value in degree.items() if value == 1)
            forks = sorted(vertex for vertex, value in degree.items() if value > 2)
            shape = ("branched" if forks or len(ends) not in (0, 2)
                     else "closedLoopCandidate" if not ends else "openPath")
            chain_shape_counts[shape] += 1
            class_groups[name] += 1
            inventory = group_metrics[name]
            inventory["groupCount"] += 1
            inventory["edgeCount"] += len(component)
            inventory["branchedGroupCount"] += int(shape == "branched")
            inventory["maxJunctionDegree"] = max(
                inventory["maxJunctionDegree"], max(degree.values())
            )
            if positions is not None:
                # Compute against ALL source edges, not just displayed chains.
                metric = [source_edge_metric(edge) for edge in component]
                length_m = sum(v[0] for v in metric)
                vertical_m = sum(v[1] for v in metric)
                zs = [positions[vid][2] for vid in degree]
                z_span_m = max(zs) - min(zs)
                inventory["totalPathLengthMm"] += length_m*1000
                inventory["longestPathLengthMm"] = max(
                    inventory["longestPathLengthMm"], length_m*1000
                )
                inventory["maxZSpanMm"] = max(
                    inventory["maxZSpanMm"], z_span_m*1000
                )
            if len(chain_samples) < sample_limit:
                chain_sample = {
                    "classification": name,
                    "edgeCount": len(component),
                    "sourceVertexCount": len(degree),
                    "openEndSourceVertices": ends[:sample_limit],
                    "forkSourceVertices": forks[:sample_limit],
                    "chainShape": shape,
                    "sourceEdgeSamples": [list(edge) for edge in sorted(component)[:sample_limit]],
                    "seamPlacementApproved": False,
                }
                if positions is not None:
                    chain_sample.update({
                        "geometryPathLengthMm": round(length_m*1000, 4),
                        "geometryZSpanMm": round(z_span_m*1000, 4),
                        "geometryVerticalEdgeFraction": (
                            round(vertical_m/length_m, 5) if length_m > 1e-10 else None
                        ),
                    })
                chain_samples.append(chain_sample)
    if sum(entry["edgeCount"] for entry in group_metrics.values()) != sum(counts.values()):
        raise RuntimeError("Source cut graph inventory lost shared-mesh UV tear edges")
    if positions is not None:
        for entry in group_metrics.values():
            for key in ("totalPathLengthMm", "longestPathLengthMm", "maxZSpanMm"):
                entry[key] = round(entry[key], 4)
    return {
        "unapprovedInteriorUvSeams": topology["unapprovedInteriorUvSeams"],
        "geometryEstimatedPeriodMm": round(period*1000, 5),
        "nearUnapprovedTangentChart": counts["nearUnapprovedTangentChart"],
        "exactFullTurnCutCandidates": counts["exactFullTurnCutCandidate"],
        "nonPeriodicUvTears": counts["nonPeriodicUvTear"],
        "sourceSeamGroupCountByClass": class_groups,
        "sourceSeamChainShapes": chain_shape_counts,
        "sourceSeamChainSamples": chain_samples,
        "sourceSeamGroupMetricsByClass": group_metrics,
        "sourceSeamGroupsOmittedFromSamples": (
            sum(class_groups.values()) - len(chain_samples)
        ),
        "sourceMetricGeometryAvailable": positions is not None,
        "sourceGeometryCoordinateUnits": "mesh_metres" if positions is not None else None,
        "sourceMetricEdgeLengthByClassMm": (
            {name: round(length*1000, 4)
             for name, length in source_metric_length_by_class.items()}
            if positions is not None else None
        ),
        "sourceMetricVerticalRiseByClassMm": (
            {name: round(length*1000, 4)
             for name, length in source_metric_vertical_by_class.items()}
            if positions is not None else None
        ),
        "zeroLengthSourceUvTearEdges": zero_length_source_edges if positions is not None else None,
        "unapprovedSourceEdgeSamples": sample,
        "sourceNonManifoldEdges": topology["nonManifoldEdges"],
        "cutPlacementApproved": False,
        "supplierRepeatVerified": False,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }



def validate_recomputed_source_cut_evidence(authored, independent, *,
                                            metric_tolerance_mm=0.25):
    """Fail closed when author UV-cut receipts disagree with evaluated mesh.

    This verifies two *software* observations of the same source garment,
    including every unsampled seam-cut component. It NEVER approves seams,
    physical grain, source identity, real fabric dimensions or drape.
    Blender float32 UV/mesh storage can cause sub-millimetre rounding, so
    independent metric totals are compared within an explicit tight budget.
    """
    if (isinstance(metric_tolerance_mm, (bool, str, bytes))
            or not isinstance(metric_tolerance_mm, (int, float))
            or not math.isfinite(metric_tolerance_mm)
            or not 0 <= metric_tolerance_mm <= 0.25):
        raise ValueError("Source cut comparison needs a <=0.25 mm finite tolerance")
    if not isinstance(authored, dict) or not isinstance(independent, dict):
        raise ValueError("Source cut receipts must be nonempty report dictionaries")
    exact_fields = (
        "unapprovedInteriorUvSeams", "nearUnapprovedTangentChart",
        "exactFullTurnCutCandidates", "nonPeriodicUvTears",
        "sourceSeamGroupCountByClass", "sourceSeamChainShapes",
        "sourceMetricGeometryAvailable", "sourceGeometryCoordinateUnits",
        "zeroLengthSourceUvTearEdges", "sourceNonManifoldEdges",
        "cutPlacementApproved", "supplierRepeatVerified",
        "supplierGrainVerified", "productionApproved",
    )
    for field in exact_fields:
        if field not in authored or field not in independent:
            raise ValueError(f"Missing source cut provenance field: {field}")
        if authored[field] != independent[field]:
            raise ValueError(f"Authored and independent source cut {field} disagree")
    if any(report["sourceMetricGeometryAvailable"] is not True
           or report["sourceGeometryCoordinateUnits"] != "mesh_metres"
           or any(report[approval] is not False for approval in (
               "cutPlacementApproved", "supplierRepeatVerified",
               "supplierGrainVerified", "productionApproved"
           )) for report in (authored, independent)):
        raise ValueError("Source cut provenance cannot certify physical fabric or approval")
    max_delta = 0.0

    def compare_metric(label, first, second):
        nonlocal max_delta
        if any(isinstance(v, (str, bytes, bool))
               or not isinstance(v, (int, float)) or not math.isfinite(v)
               or v < 0 for v in (first, second)):
            raise ValueError(f"Invalid finite source cut metric: {label}")
        delta = abs(first - second)
        if delta > metric_tolerance_mm:
            raise ValueError(f"Authored and independent {label} differ by {delta:.4f} mm")
        max_delta = max(max_delta, delta)

    for key in ("sourceMetricEdgeLengthByClassMm",
                "sourceMetricVerticalRiseByClassMm"):
        a, b = authored.get(key), independent.get(key)
        if (not isinstance(a, dict) or not isinstance(b, dict)
                or set(a) != set(b)):
            raise ValueError(f"Missing or mismatched source cut metric keys: {key}")
        for name in a:
            compare_metric(key + "." + name, a[name], b[name])

    a_groups = authored.get("sourceSeamGroupMetricsByClass")
    b_groups = independent.get("sourceSeamGroupMetricsByClass")
    if (not isinstance(a_groups, dict) or not isinstance(b_groups, dict)
            or set(a_groups) != set(b_groups)):
        raise ValueError("Source cut groups missing from authoring or independent QA")
    for name in a_groups:
        a, b = a_groups[name], b_groups[name]
        if not isinstance(a, dict) or not isinstance(b, dict):
            raise ValueError("Malformed source cut group inventory")
        for key in ("groupCount", "edgeCount", "branchedGroupCount", "maxJunctionDegree"):
            if key not in a or key not in b or a[key] != b[key]:
                raise ValueError(f"Authored and independent {name}.{key} disagree")
        for key in ("totalPathLengthMm", "longestPathLengthMm", "maxZSpanMm"):
            if key not in a or key not in b:
                raise ValueError(f"Source cut extent absent: {name}.{key}")
            compare_metric(name + "." + key, a[key], b[key])

    return {
        "sourceCutProvenanceConsistent": True,
        "maxSourceCutMetricDeltaMm": round(max_delta, 4),
        "independentEvaluatedMeshRequired": True,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }



def validate_independent_uv_hotspots(authored, evaluated, *,
                                    max_area_delta_m2=0.00002,
                                    max_coverage_delta_pct=0.10):
    """Compare author source-face UV receipts to independent evaluated mesh.

    This is a provenance/integrity check: authenticating a diagnostic is NOT
    textile repeat, seam placement, calibrated drape or production permission.
    Bounded deltas account only for Blender's persisted float32 coordinates.
    """
    for name, value, maximum in (
        ("max_area_delta_m2", max_area_delta_m2, .00002),
        ("max_coverage_delta_pct", max_coverage_delta_pct, .10),
    ):
        if (isinstance(value, (bool, str, bytes)) or not isinstance(value, (int, float))
                or not math.isfinite(value) or not 0 <= value <= maximum):
            raise ValueError(f"{name} must be finite within [0,{maximum}]")
    if not isinstance(authored, dict) or not isinstance(evaluated, dict):
        raise ValueError("UV hotspot receipts must be dictionaries")
    for source in (authored, evaluated):
        if source.get("sourceFaceAttributionAvailable") is not True:
            raise ValueError("Missing indexed source polygon hotspot provenance")
        if (source.get("physicalFabricRepeatVerified") is not False
                or source.get("supplierGrainVerified") is not False
                or source.get("productionApproved") is not False):
            raise ValueError("UV diagnostic may not claim fabric or production approval")

    for key in ("distortedSourcePolygonCount", "distortedSourcePolygonSamplesOmitted",
                "triangleCount", "collapsedUvTriangles", "degenerateSurfaceTriangles",
                "uvTrianglesAnisotropyOver2", "uvTrianglesMetricScaleDeviationOver50Pct"):
        for source in (authored, evaluated):
            value = source.get(key)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"Invalid UV hotspot inventory: {key}")
        if authored[key] != evaluated[key]:
            raise ValueError(f"Indexed source UV hotspot receipt differs at {key}")

    max_delta = 0.0
    for key, tolerance in (
        ("uvMeasuredSurfaceAreaM2", max_area_delta_m2),
        ("uvDistortedSurfaceAreaM2", max_area_delta_m2),
        ("uvDistortedSurfacePct", max_coverage_delta_pct),
    ):
        left, right = authored.get(key), evaluated.get(key)
        if left is None and right is None and key == "uvDistortedSurfacePct":
            continue
        if any(isinstance(v, (bool, str, bytes)) or not isinstance(v, (int, float))
               or not math.isfinite(v) or v < 0 for v in (left, right)):
            raise ValueError(f"Missing/invalid UV hotspot metric: {key}")
        delta = abs(left-right)
        if delta > tolerance:
            raise ValueError(f"Indexed source UV hotspot metric mismatch: {key}")
        max_delta = max(max_delta, delta)

    def sample_map(source):
        samples = source.get("distortedSourcePolygonSamples")
        if not isinstance(samples, list) or len(samples) > 32:
            raise ValueError("Invalid indexed UV hotspot samples")
        entries = {}
        for item in samples:
            if not isinstance(item, dict):
                raise ValueError("Invalid indexed UV hotspot sample")
            index = item.get("sourcePolygonIndex")
            if isinstance(index, bool) or not isinstance(index, int) or index < 0 or index in entries:
                raise ValueError("Duplicated or invalid source polygon index")
            entries[index] = item
        if len(entries) + source["distortedSourcePolygonSamplesOmitted"] != source["distortedSourcePolygonCount"]:
            raise ValueError("Source polygon hotspot inventory/sample count mismatch")
        return entries
    author_samples, evaluated_samples = sample_map(authored), sample_map(evaluated)
    if len(author_samples) != len(evaluated_samples):
        raise ValueError("Missing source polygon UV hotspot samples")
    shared_samples = author_samples.keys() & evaluated_samples.keys()
    if author_samples and not shared_samples:
        raise ValueError("No independently matching source polygon UV hotspots")
    # Top face ordering can legitimately flip for near-equal areas after
    # saved-scene float32 rounding. Do not assert rank-order equivalence,
    # but never allow an independently *shared* sampled face to be forged.
    for index in shared_samples:
        author, independent = author_samples[index], evaluated_samples[index]
        for key in ("validTriangleCount", "distortedTriangleCount"):
            if (isinstance(author.get(key), bool) or not isinstance(author.get(key), int)
                    or author[key] != independent.get(key)):
                raise ValueError(f"Source polygon {index} hotspot {key} disagrees")
        for key in ("surfaceAreaM2", "distortedAreaM2"):
            left, right = author.get(key), independent.get(key)
            if any(isinstance(v, (bool, str, bytes)) or not isinstance(v, (int, float))
                   or not math.isfinite(v) for v in (left, right)):
                raise ValueError(f"Invalid source polygon {index} metric: {key}")
            if abs(left-right) > max_area_delta_m2:
                raise ValueError(f"Source polygon {index} metric area mismatch: {key}")
    return {
        "evaluatedSourceUvHotspotProvenanceConsistent": True,
        "maxSurfaceMetricDelta": round(max_delta, 7),
        "sharedSampledSourcePolygonsVerified": len(author_samples.keys() & evaluated_samples.keys()),
        "fullIndexedSourceFaceCountVerified": True,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }



def metric_uv_triangle_stretches(xyz, uv):
    """Principal UV/mesh length ratios; metric QA, never cloth authentication.

    Use an orthonormal frame on the *actual* 3D triangle, not its XY or XZ
    projection. Singular values expose stretch/shear that a UV-area-only
    audit misses (e.g. U doubled while V halved preserves UV area).
    """
    a, b, c = xyz
    edge1 = tuple(b[i] - a[i] for i in range(3))
    edge2 = tuple(c[i] - a[i] for i in range(3))
    first = math.sqrt(sum(value * value for value in edge1))
    if not math.isfinite(first) or first <= 1e-12:
        raise ValueError("UV metric distortion needs nondegenerate 3D edges")
    x2 = sum(edge1[i] * edge2[i] for i in range(3)) / first
    height2 = sum(value * value for value in edge2) - x2 * x2
    height = math.sqrt(max(0.0, height2))
    if not math.isfinite(height) or height <= 1e-12:
        raise ValueError("UV metric distortion needs positive 3D triangle area")
    du1, dv1 = uv[1][0] - uv[0][0], uv[1][1] - uv[0][1]
    du2, dv2 = uv[2][0] - uv[0][0], uv[2][1] - uv[0][1]
    j11, j21 = du1 / first, dv1 / first
    j12, j22 = (du2 - x2 * j11) / height, (dv2 - x2 * j21) / height
    trace = j11*j11 + j12*j12 + j21*j21 + j22*j22
    det = abs(j11*j22 - j12*j21)
    if not math.isfinite(trace) or not math.isfinite(det):
        raise ValueError("Nonfinite local UV metric mapping")
    largest = math.sqrt(max(0.0, (trace + math.sqrt(max(0.0, trace*trace - 4*det*det))) / 2))
    if not math.isfinite(largest) or largest <= 0:
        raise ValueError("Invalid local UV metric scale")
    smallest = det / largest
    return smallest, largest


def audit_uv_triangles(triangles, *, min_uv_area=1e-12, min_surface_area_m2=1e-12,
                       source_face_sample_limit=12):
    """Audit actual source triangle XYZ/UV, optionally with polygon indices.

    Triangle records may contain a third value: the source polygon's integer
    index. Every record must provide the index, or none may. The optional
    attribution locates distortion; it cannot certify fabric grain or scale.
    """
    if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (float, int))
           or not math.isfinite(v) or v <= 0
           for v in (min_uv_area, min_surface_area_m2)):
        raise ValueError("Area thresholds must be finite positive numbers")
    if (isinstance(source_face_sample_limit, (str, bytes, bool))
            or not isinstance(source_face_sample_limit, int)
            or not 0 <= source_face_sample_limit <= 32):
        raise ValueError("Source face sample limit must be an integer in [0,32]")
    total = collapsed = degenerate = 0
    sourced_records = unsourced_records = 0
    damaged_faces = {}
    densities = []
    anisotropies = []
    metric_deviations = []
    severely_anisotropic = severely_rescaled = 0
    # Each triangle contributes its ACTUAL 3D surface area, not one vote per
    # triangle; aggressive remeshing must not hide a badly stretched region.
    # Height bands localize defects without assuming textile grain direction.
    distortion_surface = []
    z_min, z_max = float("inf"), float("-inf")
    distorted_area_m2 = measured_area_m2 = 0.0
    for record in triangles:
        if not isinstance(record, (tuple, list)) or len(record) not in (2, 3):
            raise ValueError("UV triangle must include XYZ/UV and optional source polygon index")
        xyz, uv = record[:2]
        polygon_index = record[2] if len(record) == 3 else None
        if polygon_index is not None:
            if isinstance(polygon_index, bool) or not isinstance(polygon_index, int) or polygon_index < 0:
                raise ValueError("Source polygon index must be a nonnegative integer")
            sourced_records += 1
        else:
            unsourced_records += 1
        if len(xyz) != 3 or len(uv) != 3 or any(len(v) != 3 for v in xyz) or any(len(v) != 2 for v in uv):
            raise ValueError("Expected three XYZ and three UV points per triangle")
        flat = [v for point in (*xyz, *uv) for v in point]
        if any(isinstance(v, (str, bytes, bool)) or not isinstance(v, (int, float))
               or not math.isfinite(v) for v in flat):
            raise ValueError("UV audit needs finite numeric mesh/UV coordinates")
        total += 1
        z_min = min(z_min, *(point[2] for point in xyz))
        z_max = max(z_max, *(point[2] for point in xyz))
        a, b, c = xyz
        ab = [b[i] - a[i] for i in range(3)]
        ac = [c[i] - a[i] for i in range(3)]
        cross = (ab[1]*ac[2] - ab[2]*ac[1], ab[2]*ac[0] - ab[0]*ac[2], ab[0]*ac[1] - ab[1]*ac[0])
        surface_area = 0.5 * math.sqrt(sum(v*v for v in cross))
        if surface_area <= min_surface_area_m2:
            degenerate += 1
            continue
        u0, u1, u2 = uv
        uv_area = 0.5 * abs((u1[0]-u0[0])*(u2[1]-u0[1]) - (u2[0]-u0[0])*(u1[1]-u0[1]))
        if not math.isfinite(surface_area) or not math.isfinite(uv_area):
            raise ValueError("UV area overflow from invalid mesh projection")
        if uv_area <= min_uv_area:
            collapsed += 1
            continue
        density = uv_area / surface_area
        if not math.isfinite(density):
            raise ValueError("Nonfinite UV surface density")
        densities.append(density)
        smallest, largest = metric_uv_triangle_stretches(xyz, uv)
        if smallest <= 0:
            raise ValueError("Nonpositive UV principal metric stretch")
        ratio = largest / smallest
        deviation = max(abs(largest - 1), abs(smallest - 1))
        if not math.isfinite(ratio) or not math.isfinite(deviation):
            raise ValueError("Nonfinite UV principal metric distortion")
        anisotropies.append(ratio)
        metric_deviations.append(deviation)
        is_anisotropic = ratio > 2.0
        is_rescaled = deviation > 0.5
        severely_anisotropic += is_anisotropic
        severely_rescaled += is_rescaled
        distorted = is_anisotropic or is_rescaled
        measured_area_m2 += surface_area
        if distorted:
            distorted_area_m2 += surface_area
        distortion_surface.append((sum(point[2] for point in xyz) / 3.0,
                                   surface_area, distorted))
        if polygon_index is not None:
            receipt = damaged_faces.setdefault(polygon_index, {
                "sourcePolygonIndex": polygon_index,
                "validTriangleCount": 0, "distortedTriangleCount": 0,
                "surfaceAreaM2": 0.0, "distortedAreaM2": 0.0,
                "maxMetricAnisotropy": 1.0, "maxMetricStretchDeviation": 0.0,
                "zMinMetres": float("inf"), "zMaxMetres": float("-inf"),
            })
            receipt["validTriangleCount"] += 1
            receipt["surfaceAreaM2"] += surface_area
            receipt["maxMetricAnisotropy"] = max(receipt["maxMetricAnisotropy"], ratio)
            receipt["maxMetricStretchDeviation"] = max(receipt["maxMetricStretchDeviation"], deviation)
            receipt["zMinMetres"] = min(receipt["zMinMetres"], *(point[2] for point in xyz))
            receipt["zMaxMetres"] = max(receipt["zMaxMetres"], *(point[2] for point in xyz))
            if distorted:
                receipt["distortedTriangleCount"] += 1
                receipt["distortedAreaM2"] += surface_area
    if sourced_records and unsourced_records:
        raise ValueError("Mixed attributed and anonymous UV triangle records")
    if not total:
        raise ValueError("No evaluated UV triangles; candidate must fail closed")
    if not math.isfinite(measured_area_m2) or not math.isfinite(distorted_area_m2):
        raise ValueError("UV metric surface coverage overflow")
    height_bins = [
        {"heightBandPct": [index * 20, (index + 1) * 20],
         "validTriangleCount": 0, "distortedTriangleCount": 0,
         "surfaceAreaM2": 0.0, "distortedAreaM2": 0.0}
        for index in range(5)
    ]
    for centroid_z, area, distorted in distortion_surface:
        # A flat horizontal garment panel has no Z extent: use the bottom
        # bin deterministically rather than divide by zero.
        band = min(4, max(0, int(5 * (centroid_z - z_min) / (z_max - z_min)))) if z_max > z_min else 0
        cell = height_bins[band]
        cell["validTriangleCount"] += 1
        cell["surfaceAreaM2"] += area
        if distorted:
            cell["distortedTriangleCount"] += 1
            cell["distortedAreaM2"] += area
    for cell in height_bins:
        area = cell["surfaceAreaM2"]
        cell["distortedSurfacePct"] = round(100.0 * cell["distortedAreaM2"] / area, 2) if area else None
        cell["surfaceAreaM2"] = round(area, 12)
        cell["distortedAreaM2"] = round(cell["distortedAreaM2"], 12)
    # Reconstruct the full per-source-face inventory before truncating
    # examples. Sorting by real distorted surface area is stable under a
    # triangle split that preserves the exact source polygon index.
    damaged = sorted(
        (receipt for receipt in damaged_faces.values() if receipt["distortedTriangleCount"]),
        key=lambda item: (-item["distortedAreaM2"], -item["maxMetricAnisotropy"],
                          item["sourcePolygonIndex"]),
    )
    face_samples = [{
        **receipt,
        "surfaceAreaM2": round(receipt["surfaceAreaM2"], 12),
        "distortedAreaM2": round(receipt["distortedAreaM2"], 12),
        "maxMetricAnisotropy": round(receipt["maxMetricAnisotropy"], 5),
        "maxMetricStretchDeviation": round(receipt["maxMetricStretchDeviation"], 5),
        "zMinMetres": round(receipt["zMinMetres"], 5),
        "zMaxMetres": round(receipt["zMaxMetres"], 5),
    } for receipt in damaged[:source_face_sample_limit]]
    densities.sort()
    median = densities[len(densities)//2] if densities else None
    # Relative area-scale variance can flag inconsistent pattern density even
    # without supplier repeat measurements. Do not treat it as calibrated mm.
    relative_deviation = (
        sorted(abs(value - median) / median for value in densities)
        if median and median > 0 else []
    )
    p95_deviation = (
        relative_deviation[min(len(relative_deviation)-1, math.ceil(.95 * len(relative_deviation))-1)]
        if relative_deviation else None
    )
    def p95(values):
        if not values:
            return None
        values = sorted(values)
        return values[min(len(values)-1, math.ceil(.95*len(values))-1)]

    return {
        "sourceFaceAttributionAvailable": bool(sourced_records),
        "distortedSourcePolygonCount": len(damaged) if sourced_records else None,
        "distortedSourcePolygonSamples": face_samples,
        "distortedSourcePolygonSamplesOmitted": (max(0, len(damaged)-len(face_samples))
                                                if sourced_records else None),
        "uvMeasuredSurfaceAreaM2": round(measured_area_m2, 12),
        "uvDistortedSurfaceAreaM2": round(distorted_area_m2, 12),
        "uvDistortedSurfacePct": (round(100.0 * distorted_area_m2 / measured_area_m2, 2)
                                  if measured_area_m2 else None),
        "uvDistortionHeightBands": height_bins,
        "uvSourceZExtentMetres": [round(z_min, 5), round(z_max, 5)],
        "p95UvMetricAnisotropy": p95(anisotropies),
        "p95UvMetricStretchDeviation": p95(metric_deviations),
        "uvTrianglesAnisotropyOver2": severely_anisotropic,
        "uvTrianglesMetricScaleDeviationOver50Pct": severely_rescaled,
        "candidateUvMetricDistortionReviewRequired": bool(
            severely_anisotropic or severely_rescaled or collapsed or degenerate
        ),
        "triangleCount": total,
        "collapsedUvTriangles": collapsed,
        "degenerateSurfaceTriangles": degenerate,
        "noncollapsedTriangleCount": len(densities),
        "medianUvAreaPerSquareMetre": median,
        "p95RelativeUvDensityDeviation": p95_deviation,
        "candidateUvTopologyPass": collapsed == 0 and degenerate == 0,
        "physicalFabricRepeatVerified": False,
        "supplierGrainVerified": False,
        "productionApproved": False,
    }
