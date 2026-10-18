"""Candidate-only UV topology diagnostics; no supplier repeat is inferred.

Evaluate UV triangle area against 3D surface area. A pass means a finite,
noncollapsed candidate map, NOT physically calibrated textile scale.
"""
from __future__ import annotations

import math


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
                    metric = [source_edge_metric(edge) for edge in component]
                    length_m = sum(v[0] for v in metric)
                    vertical_m = sum(v[1] for v in metric)
                    zs = [positions[vid][2] for vid in degree]
                    chain_sample.update({
                        "geometryPathLengthMm": round(length_m*1000, 4),
                        "geometryZSpanMm": round((max(zs)-min(zs))*1000, 4),
                        "geometryVerticalEdgeFraction": (
                            round(vertical_m/length_m, 5) if length_m > 1e-10 else None
                        ),
                    })
                chain_samples.append(chain_sample)
    return {
        "unapprovedInteriorUvSeams": topology["unapprovedInteriorUvSeams"],
        "geometryEstimatedPeriodMm": round(period*1000, 5),
        "nearUnapprovedTangentChart": counts["nearUnapprovedTangentChart"],
        "exactFullTurnCutCandidates": counts["exactFullTurnCutCandidate"],
        "nonPeriodicUvTears": counts["nonPeriodicUvTear"],
        "sourceSeamGroupCountByClass": class_groups,
        "sourceSeamChainShapes": chain_shape_counts,
        "sourceSeamChainSamples": chain_samples,
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


def audit_uv_triangles(triangles, *, min_uv_area=1e-12, min_surface_area_m2=1e-12):
    """Triangles: iterable of (three XYZ triples, three UV pairs). Fail closed."""
    if not (math.isfinite(min_uv_area) and min_uv_area > 0
            and math.isfinite(min_surface_area_m2) and min_surface_area_m2 > 0):
        raise ValueError("Area thresholds must be finite and positive")
    total = collapsed = degenerate = 0
    densities = []
    for xyz, uv in triangles:
        if len(xyz) != 3 or len(uv) != 3 or any(len(v) != 3 for v in xyz) or any(len(v) != 2 for v in uv):
            raise ValueError("Expected three XYZ and three UV points per triangle")
        flat = [float(v) for point in (*xyz, *uv) for v in point]
        if not all(math.isfinite(v) for v in flat):
            raise ValueError("UV audit cannot accept nonfinite coordinates")
        total += 1
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
        if uv_area <= min_uv_area:
            collapsed += 1
            continue
        densities.append(uv_area / surface_area)
    if not total:
        raise ValueError("No evaluated UV triangles; candidate must fail closed")
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
    return {
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
