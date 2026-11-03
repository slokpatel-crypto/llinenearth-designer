"""Research-only native rebuild of actual original source crotch-adjacent faces.

No source .blend write, no export, no UV/cloth/fit approval. Replaces the six
actual source trouser faces touching the original cut seam with centroid-fan
triangles in independent UNSAVED Blender objects. Compare identical topology.
"""
from __future__ import annotations

import math
import bpy


def trial_connected_face_retriangulation(
        vertices, base_faces, bridge_faces, original_cut_edges,
        body_tree, research, geom_ops, seam_ops):
    source_vertices = {v for edge in original_cut_edges for v in edge}
    if len(source_vertices) != 4 or len(original_cut_edges) != 2:
        raise RuntimeError("Retriangulation requires precisely four genuine original cut vertices.")
    original_faces = [tuple(face) for face in base_faces]
    research_bridge = [tuple(face) for face in bridge_faces]
    touched = [
        i for i, face in enumerate(original_faces)
        if any(i_vertex in source_vertices for i_vertex in face)
    ]
    if len(touched) != 6 or len(set(touched)) != 6:
        raise RuntimeError("Expected six measured original trouser faces adjacent to real cut seam.")
    if any(len(original_faces[i]) < 3 or len(set(original_faces[i])) != len(original_faces[i])
           for i in touched):
        raise RuntimeError("Original selected trouser source faces have invalid topology.")
    original_open, original_edge_counts = seam_ops["edge_topology"](
        original_faces + research_bridge
    )
    if any(n > 2 for n in original_edge_counts.values()):
        raise RuntimeError("Unchanged original source topology has nonmanifold edges.")
    points = [v.copy() for v in vertices]
    original_source_vertex_move_mm = []
    for vertex in sorted(source_vertices):
        original = points[vertex].copy()
        closest, direction, polygon_id, distance = body_tree.find_nearest(original)
        if (closest is None or direction is None or polygon_id is None or distance is None
                or not math.isfinite(distance) or direction.length <= 1e-9):
            raise RuntimeError("Original cut-edge vertex lacks genuine body BVH evidence.")
        points[vertex] = closest + direction.normalized() * 0.009
        displacement = (points[vertex] - original).length * 1000.0
        if (not math.isfinite(displacement) or displacement > 25.0):
            raise RuntimeError("True original cut vertex displacement exceeds 25mm research limit.")
        original_source_vertex_move_mm.append(displacement)

    # Build genuine original-source face centroids, and replace each touched
    # polygon with a fan preserving its entire original outside edge cycle.
    faces = []
    provenance = {}
    face_centres = []
    base_count = len(original_faces)
    control_points = [point.copy() for point in points]
    projected_points = [point.copy() for point in points]
    projected_points7 = [point.copy() for point in points]
    projected_points11 = [point.copy() for point in points]
    for original_id, face in enumerate(original_faces):
        if original_id not in touched:
            faces.append(face)
            continue
        central = sum((points[v] for v in face), points[face[0]].copy() * 0.0) / len(face)
        nearest, direction, polygon_id, native_distance = body_tree.find_nearest(central)
        if (nearest is None or direction is None or polygon_id is None
                or native_distance is None or not math.isfinite(native_distance)
                or direction.length <= 1e-9):
            raise RuntimeError("Original trouser face centre has unknown scanned-body direction.")
        projected = nearest + direction.normalized() * 0.009
        projected_7 = nearest + direction.normalized() * 0.007
        projected_11 = nearest + direction.normalized() * 0.011
        shift_mm = (projected - central).length * 1000.0
        shift_7 = (projected_7 - central).length * 1000.0
        shift_11 = (projected_11 - central).length * 1000.0
        if (not all(math.isfinite(d) and d <= 25.0 for d in (shift_mm, shift_7, shift_11))
                or not all(math.isfinite(x) for point in (projected, projected_7, projected_11) for x in point)):
            raise RuntimeError("Native original source face remesh centroid moved beyond 25mm.")
        centroid_id = len(control_points)
        control_points.append(central)
        projected_points.append(projected)
        projected_points7.append(projected_7)
        projected_points11.append(projected_11)
        affected_ids = []
        for local in range(len(face)):
            affected_ids.append(len(faces))
            faces.append((face[local], face[(local + 1) % len(face)], centroid_id))
        provenance[str(original_id)] = affected_ids
        face_centres.append({
            "originalSourceFaceIndex": original_id,
            "originalFaceCentroidNearestBodyMm": round(native_distance * 1000.0, 5),
            "projectedCentroidMoveMm": round(shift_mm, 5),
            "projectedCentroidMoveMm7": round(shift_7, 5),
            "projectedCentroidMoveMm11": round(shift_11, 5),
            "projectedOriginalBodyPolygonIndex": int(polygon_id),
        })
    if (len({len(control_points), len(projected_points), len(projected_points7), len(projected_points11)}) != 1
            or len(face_centres) != 6):
        raise RuntimeError("Original-face remesh has lost true source face ancestry.")
    source_face_count = len(faces)
    faces += research_bridge
    target_new_indices = {
        i for created in provenance.values() for i in created
    }
    if len(target_new_indices) < 18 or max(target_new_indices) >= source_face_count:
        raise RuntimeError("At least three real retriangulated triangles per original source face required.")
    new_open, new_owners = seam_ops["edge_topology"](faces)
    if set(original_open) != set(new_open) or any(n > 2 for n in new_owners.values()):
        raise RuntimeError("Connected source remesh changed genuine seam open boundary or manifold count.")

    def make(label, mesh_points):
        name = "TITAN_RESEARCH_CrotchConnectedFaceRemesh_" + label
        if bpy.data.objects.get(name) is not None:
            raise RuntimeError("Original-source remesh would overwrite independent Blender trial.")
        mesh = bpy.data.meshes.new(name + "Mesh")
        mesh.from_pydata(mesh_points, [], faces)
        mesh.update(calc_edges=True)
        degenerate = sum(
            not math.isfinite(face.area) or face.area <= 1e-12
            for face in mesh.polygons
        )
        if degenerate or len(mesh.polygons) != len(faces):
            raise RuntimeError("Connected original source remesh is degenerate or lost faces.")
        obj = bpy.data.objects.new(name, mesh)
        obj.hide_render = True
        obj["candidateOnly"] = True
        obj["productionApproved"] = False
        obj["physicalFitApproved"] = False
        obj["sewnGarmentApproved"] = False
        research.objects.link(obj)
        if bpy.data.collections["LinenEarthExport"].objects.get(name) is not None:
            raise RuntimeError("Source retriangulation contaminated original six-garment export.")
        data = geom_ops["world_geometry"](obj)
        if len(data["areas"]) != len(faces):
            raise RuntimeError("Cannot attribute original-body collisions after source remesh.")
        pairs = body_tree.overlap(geom_ops["real_tree"](data))
        affected = [(body_id, face_id) for body_id, face_id in pairs
                    if face_id in target_new_indices]
        other = [(body_id, face_id) for body_id, face_id in pairs
                 if face_id < source_face_count and face_id not in target_new_indices]
        bridge = [(body_id, face_id) for body_id, face_id in pairs
                  if face_id >= source_face_count]
        contact_ids = {i for _, i in affected}
        contact_area = sum(data["areas"][i] for i in contact_ids) * 1e6
        total_area = sum(data["areas"][i] for i in target_new_indices) * 1e6
        if (not math.isfinite(contact_area) or not math.isfinite(total_area)
                or total_area <= 0 or contact_area < 0
                or contact_area > total_area + 1e-4):
            raise RuntimeError("Native retriangulated original-face contact area is invalid.")
        source_samples = []
        for left, right in original_cut_edges:
            measured = []
            for fraction in (0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875):
                sample = mesh_points[left] + (
                    mesh_points[right] - mesh_points[left]
                ) * fraction
                closest, direction, polygon, distance = body_tree.find_nearest(sample)
                if (closest is None or direction is None or polygon is None or distance is None
                        or not math.isfinite(distance) or distance < 0):
                    raise RuntimeError("Measured source remesh cut-edge clearance missing.")
                measured.append(round(distance * 1000.0, 5))
            source_samples.append({
                "originalSourceCutEdgeVertices": [left, right],
                "bodyDistancesMm": measured,
                "minimumMm": min(measured),
                "samplesUnderSevenMm": sum(distance < 7.0 for distance in measured),
            })
        return {
            "mesh": mesh,
            "data": {
                "originalSourceFaceCount": base_count,
                "sourceFaceCountAfterRetriangulation": source_face_count,
                "allFaceCount": len(faces),
                "newSourceTrianglesFromSixFaces": len(target_new_indices),
                "bodyPairsOnRemeshedOriginalFaces": len(affected),
                "bodyContactedRemeshedOriginalFaceCount": len(contact_ids),
                "bodyContactedRemeshedOriginalAreaMm2": round(contact_area, 4),
                "totalRemeshedOriginalAreaMm2": round(total_area, 4),
                "untouchedOriginalSourceBodyPairs": len(other),
                "researchBridgeBodyPairs": len(bridge),
                "wholeSourceBodyPairs": len(pairs),
                "originalCutEdgeSampleResults": source_samples,
                "sourceEdgeSamplesUnderSevenMm": sum(
                    row["samplesUnderSevenMm"] for row in source_samples
                ),
                "degenerateFaces": degenerate,
                "productionApproved": False,
            },
        }

    control = make("Control", control_points)
    candidate = make("BodyGuidedCentres9Mm", projected_points)
    candidate7 = make("BodyGuidedCentres7Mm", projected_points7)
    candidate11 = make("BodyGuidedCentres11Mm", projected_points11)
    equal_source_trials = {
        "7": candidate7,
        "9": candidate,
        "11": candidate11,
    }
    for variant in equal_source_trials.values():
        if (control["data"]["allFaceCount"] != variant["data"]["allFaceCount"]
                or control["data"]["untouchedOriginalSourceBodyPairs"] !=
                   variant["data"]["untouchedOriginalSourceBodyPairs"]
                or control["data"]["researchBridgeBodyPairs"] !=
                   variant["data"]["researchBridgeBodyPairs"]):
            raise RuntimeError("Body-centroid source remesh changed truly unmodified source faces.")
    normal_reversal_count = sum(
        control["mesh"].polygons[i].normal.dot(
            candidate["mesh"].polygons[i].normal
        ) <= 0 for i in target_new_indices
    )
    flipped_per_offset = {
        offset: sum(
            control["mesh"].polygons[i].normal.dot(
                variant["mesh"].polygons[i].normal
            ) <= 0 for i in target_new_indices
        ) for offset, variant in equal_source_trials.items()
    }
    return {
        "researchOnly": True,
        "originalAffectedSourceFaceIndices": touched,
        "originalFaceToNewTriangleIndices": provenance,
        "originalFaceCentroidProvenance": face_centres,
        "topologyEqualBetweenControlAndBodyGuided": True,
        "originalOpenSourceBoundaryEdges": len(original_open),
        "remeshOpenSourceBoundaryEdges": len(new_open),
        "originalSourceCutVertexDisplacementMaxMm": round(max(original_source_vertex_move_mm), 5),
        "control": control["data"],
        "bodyGuidedCentres9Mm": candidate["data"],
        "equalTopologyBodyGuidedCentroidSweepMm": {
            offset: variant["data"] for offset, variant in equal_source_trials.items()
        },
        "bodyGuidedSourceFaceNormalReversalsByOffsetMm": flipped_per_offset,
        "bodyGuidedSourceFaceNormalReversals": normal_reversal_count,
        "strictContactedOriginalSourceAreaImprovementObserved": (
            candidate["data"]["bodyContactedRemeshedOriginalAreaMm2"]
            < control["data"]["bodyContactedRemeshedOriginalAreaMm2"]
        ),
        "strictOriginalBodyPairImprovementObserved": (
            candidate["data"]["bodyPairsOnRemeshedOriginalFaces"]
            < control["data"]["bodyPairsOnRemeshedOriginalFaces"]
        ),
        "metricCaveat": (
            "Native original source-face retriangulation is UNSAVED research. "
            "No sewn garment, continuous body clearance, UV grain/repeat, "
            "cutting/fit/seam allowance, finished cloth thickness or photo QA."
        ),
        "changesProductionGeometry": False,
        "productionApproved": False,
        "physicalFitApproved": False,
        "sewnGarmentApproved": False,
    }
