# Never use this research mesh for production clothing.
"""Triangulate measured unmatched original crotch cut edges in an isolated Blender scene.

The original six authored garment objects are never modified. This is an
unsaved, non-export source-surface bridge trial, not sewn cloth or fit approval.
"""
from __future__ import annotations

import argparse
from collections import Counter
import itertools
import json
import math
from pathlib import Path
import runpy
import sys

import bpy
from mathutils.bvhtree import BVHTree

IDENTITY = "linen-earth-studio-model-v1"
LEGS = ("TrouserLegLFabric", "TrouserLegRFabric")
STAGE = "selectedBodyShell"
RESEARCH = "TITAN_CrotchStageResearch"
EXPORT = "LinenEarthExport"
MAX_UNMATCHED_MM = 80.0


def midpoint(geom, edge):
    a, b = edge
    return (geom["points"][a] + geom["points"][b]) / 2.0


def seam_connector_faces(vertices, left_edge, right_edge):
    l0, l1 = left_edge
    r0, r1 = right_edge
    # Pair the physically nearer endpoints; integer edge orientation is not a seam direction.
    direct = (vertices[l0] - vertices[r0]).length + (vertices[l1] - vertices[r1]).length
    reverse = (vertices[l0] - vertices[r1]).length + (vertices[l1] - vertices[r0]).length
    if reverse < direct:
        r0, r1 = r1, r0
    path = [l0, l1, r1, r0]
    polygon = []
    for i in path:
        if not polygon or polygon[-1] != i:
            polygon.append(i)
    if len(polygon) > 1 and polygon[0] == polygon[-1]:
        polygon.pop()
    if len(set(polygon)) != len(polygon) or len(polygon) not in (3, 4):
        raise RuntimeError("Unmatched cut-edge endpoints cannot form a nondegenerate bridge.")
    if len(polygon) == 3:
        faces = [tuple(polygon)]
    else:
        a, b, c, d = polygon
        candidates = [[(a, b, c), (a, c, d)], [(a, b, d), (b, c, d)]]
        def smallest_area(tris):
            return min((vertices[y]-vertices[x]).cross(vertices[z]-vertices[x]).length * 0.5
                       for x,y,z in tris)
        faces = max(candidates, key=smallest_area)
    if any((vertices[b]-vertices[a]).cross(vertices[c]-vertices[a]).length <= 2e-12
           for a,b,c in faces):
        raise RuntimeError("Measured unmatched seam endpoints would generate a zero-area triangle.")
    return faces, max(direct, reverse) * 500.0


def build_pairs(left, right, unpaired_left, unpaired_right):
    if len(unpaired_left) != 4 or len(unpaired_right) != 4:
        raise RuntimeError("Actual source currently needs exactly four unmatched cut edges per leg.")
    # Match the four remaining source segments by minimum *measured midpoint* gap.
    # This is an exploratory link only; the original source wound seam is not invented.
    all_choices = []
    for perm in itertools.permutations(range(len(unpaired_right))):
        gaps = [
            (midpoint(left, a) - midpoint(right, unpaired_right[j])).length * 1000.0
            for a,j in zip(unpaired_left,perm)
        ]
        all_choices.append((sum(gaps), max(gaps),perm,gaps))
    _,max_gap,choice,gaps = min(all_choices, key=lambda row:(row[0],row[1],row[2]))
    if max_gap>MAX_UNMATCHED_MM or not all(math.isfinite(d) for d in gaps):
        raise RuntimeError("Original unpaired source edges are too distant for this bounded bridge trial.")
    return list(zip(unpaired_left, [unpaired_right[j] for j in choice], gaps))



def trial_centerline_body_clearance(vertices, bridge_faces, body_tree, research, geom_ops, offset_mm):
    """Compare 7mm interior displacement with an EXACT SAME-TRIANGULATION control.

    It is invalid to compare 6-triangle source BVH pair counts to a 3x-subdivided
    18-triangle bridge: the number of contact pairs scales with tessellation.
    Keep all real original cut/stitch endpoints fixed and measure contacted area
    and BVH pair counts on TWO research-only 18-face meshes of identical topology.
    """
    if offset_mm != 7.0:
        raise RuntimeError("Only the real scanned-body 7mm offset may be trialled.")
    control_vertices = [v.copy() for v in vertices]
    projected_vertices = [v.copy() for v in vertices]
    radial_vertices = [v.copy() for v in vertices]
    radial_shift_mm = []
    fan_faces = []
    native_distances = []
    for face in bridge_faces:
        if len(face) != 3 or len(set(face)) != 3:
            raise RuntimeError("Expected actual original source bridge triangles.")
        a, b, c = face
        centre = (vertices[a] + vertices[b] + vertices[c]) / 3.0
        closest, normal, _index, distance = body_tree.find_nearest(centre)
        if (closest is None or normal is None or distance is None
                or not math.isfinite(distance) or normal.length <= 1e-9):
            raise RuntimeError("No finite original-body surface/normal at bridge centroid.")
        candidate = closest + normal.normalized() * (offset_mm / 1000.0)
        if not all(math.isfinite(v) for v in candidate):
            raise RuntimeError("Experimental body-normal displacement has nonfinite vertices.")
        native_distances.append(distance * 1000.0)
        index = len(control_vertices)
        control_vertices.append(centre)
        projected_vertices.append(candidate)
        # Bounded radial alternative: leave centroids already at >=7mm
        # untouched and move the rest along the measured original nearest
        # surface-to-centroid vector rather than an arbitrary normal sign.
        if distance * 1000.0 >= offset_mm:
            radial_candidate = centre.copy()
        elif distance > 1e-9:
            radial_candidate = centre + (centre - closest).normalized() * (
                offset_mm / 1000.0 - distance
            )
        else:
            radial_candidate = centre + normal.normalized() * (offset_mm / 1000.0)
        if not all(math.isfinite(v) for v in radial_candidate):
            raise RuntimeError("Radial source-body clearance is nonfinite.")
        radial_shift_mm.append((radial_candidate - centre).length * 1000.0)
        radial_vertices.append(radial_candidate)
        fan_faces.extend(((a, b, index), (b, c, index), (c, a, index)))
    original_open, _ = topology_of_triangles(bridge_faces)
    fan_open, fan_incidence = topology_of_triangles(fan_faces)
    if set(original_open) != set(fan_open):
        raise RuntimeError("Research trial changed actual original cut/stitch boundary indices.")
    if any(n > 2 for n in fan_incidence.values()):
        raise RuntimeError("Experimental 3-fan triangle topology created nonmanifold edges.")

    def measure_equal_topology(name, points):
        if bpy.data.objects.get(name) is not None:
            raise RuntimeError("Do not overwrite prior independent Blender research.")
        mesh = bpy.data.meshes.new(name + "Mesh")
        mesh.from_pydata(points, [], fan_faces)
        mesh.update(calc_edges=True)
        degenerate = sum(not math.isfinite(p.area) or p.area <= 1e-12 for p in mesh.polygons)
        if degenerate or len(mesh.polygons) != 3 * len(bridge_faces):
            raise RuntimeError("Research source centroid generated degenerate or lost triangle faces.")
        obj = bpy.data.objects.new(name, mesh)
        obj.hide_render = True
        obj["candidateOnly"] = True
        obj["productionApproved"] = False
        obj["physicalFitApproved"] = False
        obj["sewnGarmentApproved"] = False
        research.objects.link(obj)
        if bpy.data.collections["LinenEarthExport"].objects.get(obj.name) is not None:
            raise RuntimeError("Disallowed experiment in six-garment production export.")
        measured = geom_ops["world_geometry"](obj)
        overlap = body_tree.overlap(geom_ops["real_tree"](measured))
        contact_faces = {bridge_face for _body_face, bridge_face in overlap}
        if any(i < 0 or i >= len(measured["areas"]) for i in contact_faces):
            raise RuntimeError("Invalid body/bridge contact face provenance.")
        total_area = sum(measured["areas"]) * 1e6
        contacted_area = sum(measured["areas"][i] for i in contact_faces) * 1e6
        if (not math.isfinite(total_area) or total_area <= 0
                or not math.isfinite(contacted_area)
                or contacted_area < 0 or contacted_area > total_area + 1e-5):
            raise RuntimeError("Real contacted bridge triangle area cannot be measured.")
        return {
            "triangles": len(mesh.polygons),
            "bodyPolygonBVHPairs": len(overlap),
            "contactingBridgeTriangleCount": len(contact_faces),
            "totalBridgeAreaMm2": round(total_area, 4),
            "contactingBridgeAreaMm2": round(contacted_area, 4),
            "contactingBridgeAreaFraction": round(contacted_area / total_area, 7),
            "degenerateFaces": degenerate,
            "productionApproved": False,
        }

    control = measure_equal_topology(
        "TITAN_RESEARCH_BridgeCentroidControlOnly", control_vertices)
    candidate = measure_equal_topology(
        "TITAN_RESEARCH_BridgeCentroidClearanceOnly", projected_vertices)
    radial = measure_equal_topology(
        "TITAN_RESEARCH_BridgeCentroidRadialClearanceOnly", radial_vertices)
    if any(part["triangles"] != 18 for part in (control, candidate, radial)):
        raise RuntimeError("Native body-clearance control/candidate triangle count differs.")
    return {
        "testedOriginalBodyNormalOffsetMm": offset_mm,
        "originalBridgeTriangles": len(bridge_faces),
        "triangulatedFanFaces": len(fan_faces),
        "originalCutEdgeBoundaryCount": len(original_open),
        "preservedCutEdgeBoundaryCount": len(fan_open),
        "newInteriorCentroidVertices": len(fan_faces) // 3,
        "originalCentroidNearestBodyDistanceMm": {
            "minimum": round(min(native_distances), 4),
            "maximum": round(max(native_distances), 4),
        },
        "equalTopologyControl": control,
        "equalTopologyDisplaced": candidate,
        "equalTopologyRadial": radial,
        "radialCentroidDisplacementMm": {
            "minimum": round(min(radial_shift_mm), 4),
            "maximum": round(max(radial_shift_mm), 4),
            "moved": sum(shift > 1e-6 for shift in radial_shift_mm),
            "unchanged": sum(shift <= 1e-6 for shift in radial_shift_mm),
        },
        "radialStrictContactedAreaImprovementObserved": (
            radial["contactingBridgeAreaMm2"] < control["contactingBridgeAreaMm2"]
        ),
        "radialStrictBodyPairImprovementObserved": (
            radial["bodyPolygonBVHPairs"] < control["bodyPolygonBVHPairs"]
        ),
        "afterCentroidDisplacementBodyBVHPairs": candidate["bodyPolygonBVHPairs"],
        "strictBodyCollisionImprovementObserved": (
            candidate["bodyPolygonBVHPairs"] < control["bodyPolygonBVHPairs"]
        ),
        "strictContactedAreaImprovementObserved": (
            candidate["contactingBridgeAreaMm2"] < control["contactingBridgeAreaMm2"]
        ),
        "metricCaveat": "Compare only same-18-triangle control, normal and bounded radial trial. The nearest-point vector is unsigned (not certified outward); any original-body contacts still reject the garment.",
        "degenerateFaces": control["degenerateFaces"] + candidate["degenerateFaces"] + radial["degenerateFaces"],
        "nonManifoldEdges": sum(n > 2 for n in fan_incidence.values()),
        "productionApproved": False,
    }


def topology_of_triangles(faces):
    """Face-edge counts preserve genuine body-cut boundary even after 3-fan splitting."""
    edges = Counter()
    for a, b, c in faces:
        if len({a, b, c}) != 3:
            raise RuntimeError("Research triangle has repeated source vertices.")
        for edge in ((a, b), (b, c), (c, a)):
            edges[tuple(sorted(edge))] += 1
    if any(n > 2 for n in edges.values()):
        raise RuntimeError("Research topology uses edges with more than two owners.")
    return [edge for edge, n in edges.items() if n == 1], edges


def ordered_triangle_patch_boundary(faces):
    """Return one deterministic cycle around a two-triangle source patch."""
    open_edges, incidence = topology_of_triangles(faces)
    if len(faces) != 2 or len(open_edges) != 4 or any(n > 2 for n in incidence.values()):
        raise RuntimeError("Targeted seam reroute requires one valid two-triangle quad patch.")
    neighbours = {}
    for a, b in open_edges:
        neighbours.setdefault(a, []).append(b)
        neighbours.setdefault(b, []).append(a)
    if len(neighbours) != 4 or any(len(items) != 2 for items in neighbours.values()):
        raise RuntimeError("Targeted seam bridge boundary is not one four-vertex cycle.")
    first = min(neighbours)
    cycle = [first]
    previous = None
    current = first
    while True:
        choices = sorted(n for n in neighbours[current] if n != previous)
        if not choices:
            raise RuntimeError("Targeted seam bridge boundary cycle is incomplete.")
        following = choices[0]
        if following == first:
            break
        if following in cycle or len(cycle) >= 4:
            raise RuntimeError("Targeted seam bridge boundary cycle self-intersects.")
        cycle.append(following)
        previous, current = current, following
    if len(cycle) != 4:
        raise RuntimeError("Targeted seam bridge boundary did not contain four vertices.")
    return cycle, {tuple(sorted(edge)) for edge in open_edges}



def measure_fixed_bridge_boundary_body_rays(vertices, boundary, source_cut_edges, body_tree):
    """Intersect immutable research-patch boundary edges with the ORIGINAL body.

    Ray hits on unchanged source cut edges cannot be removed by moving only
    interior fan centroids. Connector edges were invented by this experiment
    and MUST NOT be presented as approved original sewing lines. Ray misses
    do not demonstrate a valid clearance (tangency/near-contact unmeasured).
    """
    if len(boundary) != 4 or len(set(boundary)) != 4:
        raise RuntimeError("Expected four unique actual bridge boundary vertices.")
    patch_edges = {
        tuple(sorted((boundary[i], boundary[(i + 1) % 4])))
        for i in range(4)
    }
    original_cut_edges = {tuple(sorted(edge)) for edge in source_cut_edges}
    if len(patch_edges) != 4 or len(original_cut_edges) != 2:
        raise RuntimeError("Must distinguish two real cut edges from two research connectors.")
    if not original_cut_edges.issubset(patch_edges):
        raise RuntimeError("Original cut edges do not match the actual research patch boundary.")
    results = []
    for i in range(4):
        a, b = boundary[i], boundary[(i + 1) % 4]
        start, end = vertices[a], vertices[b]
        delta = end - start
        length = delta.length
        if (not math.isfinite(length) or length <= 1e-8
                or not all(math.isfinite(v) for v in (*start, *end))):
            raise RuntimeError("Actual source boundary segment is nonfinite or degenerate.")
        direction = delta.normalized()
        # Exclude the end-point 0.01mm interval: report only genuine interior
        # ray/triangle hits, not surface contact at a shared source vertex.
        trim = min(1e-5, length / 4.0)
        location, normal, polygon_index, hit_distance = body_tree.ray_cast(
            start + direction * trim, direction, length - 2.0 * trim
        )
        # A ray misses parallel/tangent/nearby surfaces. Independently sample
        # seven strict interior positions plus both endpoints on this FIXED
        # edge using the same measured scanned-body BVH. Distance to a closed
        # surface is 1-Lipschitz, so adjacent samples give a conservative
        # continuous upper bound for every point in the straight interval.
        nearest_samples = []
        proof_fractions = (0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0)
        for fraction in proof_fractions:
            sample = start + delta * fraction
            closest_sample, normal_sample, polygon_sample, distance_sample = body_tree.find_nearest(sample)
            if (closest_sample is None or normal_sample is None
                    or polygon_sample is None or distance_sample is None
                    or not math.isfinite(distance_sample) or distance_sample < 0):
                raise RuntimeError("Original edge has unknown scanned-body proximity.")
            nearest_samples.append({
                "edgeFraction": fraction,
                # Round upward: proof inputs must never understate measured distance.
                "nearestBodyDistanceMm": math.ceil(
                    distance_sample * 1000.0 * 100000.0
                ) / 100000.0,
                "nearestBodyPolygonIndex": int(polygon_sample),
            })
        interior_samples = nearest_samples[1:-1]
        sampled_distances = [v["nearestBodyDistanceMm"] for v in interior_samples]
        interval_upper_bounds = []
        for left, right in zip(nearest_samples, nearest_samples[1:]):
            interval_length_mm = (right["edgeFraction"] - left["edgeFraction"]) * length * 1000.0
            left_distance = left["nearestBodyDistanceMm"]
            right_distance = right["nearestBodyDistanceMm"]
            if abs(left_distance - right_distance) > interval_length_mm + 0.0001:
                raise RuntimeError("Nearest-body samples violate the distance Lipschitz bound.")
            raw_upper_bound = (left_distance + right_distance + interval_length_mm) / 2.0
            # Round upward so serialized evidence never understates the bound.
            upper_bound = math.ceil(raw_upper_bound * 100000.0) / 100000.0
            interval_upper_bounds.append({
                "startFraction": left["edgeFraction"],
                "endFraction": right["edgeFraction"],
                "conservativeDistanceUpperBoundMm": upper_bound,
            })
        continuous_upper_bound = max(
            row["conservativeDistanceUpperBoundMm"] for row in interval_upper_bounds
        )
        hit = location is not None
        if hit:
            if (polygon_index is None or hit_distance is None
                    or not math.isfinite(hit_distance)
                    or hit_distance < 0 or hit_distance > length - 2.0 * trim + 1e-7
                    or not all(math.isfinite(v) for v in location)):
                raise RuntimeError("Original scanned-body boundary ray hit is invalid.")
        results.append({
            "boundaryVertexIndices": [a, b],
            "edgeKind": ("originalSourceCutEdge"
                         if tuple(sorted((a, b))) in original_cut_edges
                         else "experimentalConnector"),
            "edgeLengthMm": round(length * 1000.0, 4),
            "sampledNearestBodyDistances": interior_samples,
            "clearanceProofSamplesIncludingEndpoints": nearest_samples,
            "clearanceProofIntervalUpperBounds": interval_upper_bounds,
            "continuousDistanceUpperBoundMm": continuous_upper_bound,
            "continuousWholeEdgeUnderResearchSevenMm": continuous_upper_bound < 7.0,
            "sampledMinimumBodyDistanceMm": min(sampled_distances),
            "sampledMaximumBodyDistanceMm": max(sampled_distances),
            "sampledInteriorPointsUnderResearchSevenMm": sum(
                distance < 7.0 for distance in sampled_distances
            ),
            "strictInteriorRayHit": hit,
            "bodyPolygonIndex": int(polygon_index) if hit else None,
            "firstHitDistanceFromEdgeStartMm": (
                round((trim + hit_distance) * 1000.0, 4) if hit else None
            ),
        })
    source_hits = sum(
        row["strictInteriorRayHit"] for row in results
        if row["edgeKind"] == "originalSourceCutEdge"
    )
    connector_hits = sum(
        row["strictInteriorRayHit"] for row in results
        if row["edgeKind"] == "experimentalConnector"
    )
    if sum(row["edgeKind"] == "originalSourceCutEdge" for row in results) != 2:
        raise RuntimeError("Lost one of the two real source cut boundary segments.")
    source_rows = [row for row in results if row["edgeKind"] == "originalSourceCutEdge"]
    source_under_seven = sum(
        row["sampledInteriorPointsUnderResearchSevenMm"] for row in source_rows
    )
    source_edges_continuously_under_seven = sum(
        row["continuousWholeEdgeUnderResearchSevenMm"] for row in source_rows
    )
    return {
        "boundaryEdgeCount": len(results),
        "originalSourceCutEdgeCount": 2,
        "experimentalConnectorCount": 2,
        "originalSourceCutEdgeInteriorRayHits": source_hits,
        "perBoundaryEdgeNearestBodySampleCount": 7,
        "perBoundaryEdgeClearanceProofSampleCount": 9,
        "originalSourceEdgeSamplesUnderResearchSevenMm": source_under_seven,
        "sourceFixedBoundaryFailsSampledResearchSevenMm": source_under_seven > 0,
        "sourceEdgesProvenContinuouslyUnderResearchSevenMm": source_edges_continuously_under_seven,
        "allFixedSourceEdgesContinuouslyUnderResearchSevenMm": (
            source_edges_continuously_under_seven == len(source_rows)
        ),
        "experimentalConnectorInteriorRayHits": connector_hits,
        "boundaryEdges": results,
        "originalSourceCutEdgeHitMakesFixedBoundaryClearanceImpossible": source_hits > 0,
        "rayTestCaveat": (
            "Ray tests only strict segment-interior intersections against original body "
            "triangles; zero rays does not prove clearance, tangency, garment fit, "
            "actual sewing allowance or physical approval. Endpoint plus seven "
            "strict-interior unsigned nearest samples use the 1-Lipschitz distance "
            "property only to prove a conservative continuous upper bound on each "
            "straight fixed edge; this does not prove inside/outside, valid clearance, "
            "cloth thickness, fit, or an acceptable replacement seam. Experimental connectors "
            "are not real source cut edges."
        ),
        "productionApproved": False,
    }


def trial_targeted_seam_reroute(vertices, target_faces, body_tree, research, geom_ops, offset_mm, source_cut_edges):
    """Measure both signs of the real body normal on only the worst source seam.

    Body-normal orientation is not trusted. Positive and negative candidates
    use identical four-face topology and the exact original cut-edge boundary.
    This is diagnostic geometry only; nonzero contact always remains rejected.
    """
    if offset_mm != 7.0:
        raise RuntimeError("Only the measured 7mm targeted seam trial is supported.")
    boundary, original_boundary = ordered_triangle_patch_boundary(target_faces)
    fixed_boundary_ray_evidence = measure_fixed_bridge_boundary_body_rays(
        vertices, boundary, source_cut_edges, body_tree
    )
    centre = sum((vertices[i] for i in boundary), vertices[boundary[0]].copy() * 0.0) / 4.0
    closest, normal, body_polygon, distance = body_tree.find_nearest(centre)
    if (closest is None or normal is None or body_polygon is None or distance is None
            or not math.isfinite(distance) or normal.length <= 1e-9):
        raise RuntimeError("Targeted seam centre has no finite original-body surface normal.")
    unit_normal = normal.normalized()
    centres = {
        "unchangedControl": centre,
        "positiveBodyNormal": closest + unit_normal * (offset_mm / 1000.0),
        "negativeBodyNormal": closest - unit_normal * (offset_mm / 1000.0),
    }

    def measure(label, new_centre):
        points = [point.copy() for point in vertices]
        centre_index = len(points)
        points.append(new_centre)
        fan_faces = [
            (boundary[i], boundary[(i + 1) % len(boundary)], centre_index)
            for i in range(len(boundary))
        ]
        fan_boundary, fan_incidence = topology_of_triangles(fan_faces)
        if {tuple(sorted(edge)) for edge in fan_boundary} != original_boundary:
            raise RuntimeError("Targeted reroute changed original source seam endpoints or boundary.")
        if any(n > 2 for n in fan_incidence.values()):
            raise RuntimeError("Targeted reroute generated nonmanifold topology.")
        name = "TITAN_RESEARCH_TargetedCrotchReroute_" + label
        if bpy.data.objects.get(name) is not None:
            raise RuntimeError("Do not overwrite independent targeted reroute evidence.")
        mesh = bpy.data.meshes.new(name + "Mesh")
        mesh.from_pydata(points, [], fan_faces)
        mesh.update(calc_edges=True)
        degenerate = sum(not math.isfinite(face.area) or face.area <= 1e-12
                         for face in mesh.polygons)
        if degenerate or len(mesh.polygons) != 4:
            raise RuntimeError("Targeted seam reroute produced degenerate or missing faces.")
        obj = bpy.data.objects.new(name, mesh)
        obj.hide_render = True
        obj["candidateOnly"] = True
        obj["productionApproved"] = False
        obj["physicalFitApproved"] = False
        obj["sewnGarmentApproved"] = False
        research.objects.link(obj)
        if bpy.data.collections[EXPORT].objects.get(name) is not None:
            raise RuntimeError("Targeted reroute contaminated the production export collection.")
        measured = geom_ops["world_geometry"](obj)
        overlaps = body_tree.overlap(geom_ops["real_tree"](measured))
        contacting = {bridge_face for _body_face, bridge_face in overlaps}
        total_area = sum(measured["areas"]) * 1e6
        contact_area = sum(measured["areas"][i] for i in contacting) * 1e6
        if (not math.isfinite(total_area) or total_area <= 0
                or not math.isfinite(contact_area) or contact_area < 0
                or contact_area > total_area + 1e-5):
            raise RuntimeError("Targeted reroute contact surface area is invalid.")
        return {
            "triangles": len(mesh.polygons),
            "bodyPolygonBVHPairs": len(overlaps),
            "contactingTriangleCount": len(contacting),
            "totalAreaMm2": round(total_area, 4),
            "contactingAreaMm2": round(contact_area, 4),
            "contactingAreaFraction": round(contact_area / total_area, 7),
            "degenerateFaces": degenerate,
            "nonManifoldEdges": sum(n > 2 for n in fan_incidence.values()),
            "productionApproved": False,
        }

    measured = {label: measure(label, point) for label, point in centres.items()}
    control = measured["unchangedControl"]
    candidates = ("positiveBodyNormal", "negativeBodyNormal")
    best = min(candidates, key=lambda label: (
        measured[label]["contactingAreaMm2"],
        measured[label]["bodyPolygonBVHPairs"],
        label,
    ))
    return {
        "testedOffsetMm": offset_mm,
        "targetSourceBoundaryVertices": boundary,
        "preservedBoundaryEdgeCount": len(original_boundary),
        "fixedBridgeBoundaryBodyRayEvidence": fixed_boundary_ray_evidence,
        "nearestBodyPolygonIndex": int(body_polygon),
        "originalCentreNearestBodyDistanceMm": round(distance * 1000.0, 4),
        "equalTopologyVariants": measured,
        "lowestContactAreaDirection": best,
        "strictContactAreaImprovementObserved": (
            measured[best]["contactingAreaMm2"] < control["contactingAreaMm2"]
        ),
        "strictBodyPairImprovementObserved": (
            measured[best]["bodyPolygonBVHPairs"] < control["bodyPolygonBVHPairs"]
        ),
        "metricCaveat": "Body-normal sign is not trusted; both directions are measured. Any nonzero original-body contact rejects this research patch and no sewing allowance, UV, cloth thickness or tailor approval is inferred.",
        "changesProductionGeometry": False,
        "productionApproved": False,
        "physicalFitApproved": False,
        "sewnGarmentApproved": False,
    }


def main():
    argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--experimental-centroid-clearance-mm", type=float, choices=(0.0, 7.0), default=0.0,
                        help="Never production: trial 7mm nearest-body normal offset on NEW triangle centroids only")
    args=parser.parse_args(argv)
    scene=bpy.context.scene
    if (scene.get("linen_earth_model_identity_id") != IDENTITY
            or scene.get("linen_earth_model_identity_locked") is not True
            or scene.get("linen_earth_research_crotch_stages_emitted") is not True):
        raise RuntimeError("Original identity-locked Blender stage capture required; no invented cutting points.")
    research=bpy.data.collections.get(RESEARCH)
    export=bpy.data.collections.get(EXPORT)
    body=bpy.data.objects.get("Body")
    if research is None or export is None or body is None or len(research.objects)!=8:
        raise RuntimeError("Need actual eight captured stages and the original locked body/garments.")

    geom_ops=runpy.run_path(str(Path(__file__).with_name("diagnose-linen-earth-crotch.py")))
    seam_ops=runpy.run_path(str(Path(__file__).with_name("prototype-crotch-source-seam-weld.py")))
    geom=geom_ops["world_geometry"]
    body_geom=geom(body)
    center_x=(min(v.x for v in body_geom["points"])+max(v.x for v in body_geom["points"]))/2
    source_geoms=[]
    for name in LEGS:
        original=export.objects.get(name)
        stage=research.objects.get(f"TITAN_RESEARCH_{STAGE}_{name}")
        if (original is None or stage is None or stage.type != "MESH"
                or stage.get("candidateOnly") is not True
                or stage.get("productionApproved") is not False
                or stage.get("sourceStage") != STAGE):
            raise RuntimeError("Cannot prototype without exact unapproved source cut-stage provenance.")
        source_geoms.append(geom(stage))
    left,right=source_geoms
    l_all,l_inner=seam_ops["original_inner_cut_edges"](left,center_x)
    r_all,r_inner=seam_ops["original_inner_cut_edges"](right,center_x)
    if len(l_inner)!=14 or len(r_inner)!=14:
        raise RuntimeError("Native original inner seam topology has changed.")
    weld,dists=seam_ops["reciprocal_real_vertex_matches"](left,right,l_inner,r_inner)
    initial=seam_ops["make_research_only_mesh"](left,right,weld)
    if len(weld)!=11 or initial["closedBoundaryEdges"]!=20:
        raise RuntimeError("Original source partial weld evidence changed; fail closed.")

    left_count=len(left["points"])
    right_mapping={}
    next_idx=left_count
    for ri in range(len(right["points"])):
        if ri in weld:
            right_mapping[ri]=weld[ri]
        else:
            right_mapping[ri]=next_idx
            next_idx+=1
    source_left_edges={tuple(sorted(edge)) for edge in l_inner}
    source_right_edges={tuple(sorted((right_mapping[a],right_mapping[b]))) for a,b in r_inner}
    combined_open,_=seam_ops["edge_topology"]([
        *left["polygons"],*(tuple(right_mapping[i] for i in face) for face in right["polygons"])
    ])
    open_set=set(combined_open)
    l_remaining=[edge for edge in sorted(source_left_edges) if edge in open_set]
    r_remaining_mapped=[edge for edge in sorted(source_right_edges) if edge in open_set]
    if len(l_remaining)!=4 or len(r_remaining_mapped)!=4:
        raise RuntimeError("Exactly four unmatched original seam edges per side were not found.")
    inverse_right={right_mapping[i]:i for i in range(len(right["points"])) if i not in weld}
    # Matching distances use the actual right-source positions after mapping, including welded vertices.
    merged_verts=[v.copy() for v in left["points"]]
    merged_verts += [right["points"][i].copy() for i in range(len(right["points"])) if i not in weld]
    merged_geom={"points":merged_verts}
    pairings=build_pairs(merged_geom,merged_geom,l_remaining,r_remaining_mapped)

    bridge_faces=[]
    per_pair=[]
    for a,b,gap in pairings:
        faces,_=seam_connector_faces(merged_verts,a,b)
        bridge_faces.extend(faces)
        per_pair.append({"leftEdge":list(a),"rightEdge":list(b),
                         "measuredMidpointGapMm":round(gap,4),"bridgeTriangles":len(faces)})
    # Create a NEW object in research, not the original six-panel production export.
    base_faces=[tuple(f) for f in left["polygons"]]
    base_faces += [tuple(right_mapping[i] for i in face) for face in right["polygons"]]
    all_faces=base_faces+bridge_faces
    after_open, owners=seam_ops["edge_topology"](all_faces)
    if any(n>2 for n in owners.values()):
        raise RuntimeError("Bridge created nonmanifold source shell.")
    if len(after_open)>=initial["afterWeldOpenEdges"]:
        raise RuntimeError("Bridging did not actually reduce original seam open boundaries.")
    mesh=bpy.data.meshes.new("TITAN_RESEARCH_CrotchUnmatchedBridgeMesh")
    mesh.from_pydata(merged_verts,[],all_faces)
    mesh.update(calc_edges=True)
    if len(mesh.polygons)!=len(all_faces):
        raise RuntimeError("Blender dropped actual bridge faces.")
    degenerate=sum(not math.isfinite(p.area) or p.area <=1e-12 for p in mesh.polygons)
    if degenerate:
        raise RuntimeError("Unmatched seam research bridge contains degenerate polygons.")
    name="TITAN_RESEARCH_CrotchUnmatchedBridgeOnly"
    if bpy.data.objects.get(name) is not None:
        raise RuntimeError("Cannot overwrite prior research bridge.")
    obj=bpy.data.objects.new(name,mesh)
    obj.hide_render=True
    obj["candidateOnly"]=True
    obj["productionApproved"]=False
    obj["sewnGarmentApproved"]=False
    research.objects.link(obj)
    if export.objects.get(name) is not None:
        raise RuntimeError("Experimental bridge contaminated production garment export.")

    # Independent genuine body-BVH contact count for *new bridge surface only*.
    body_tree=geom_ops["real_tree"](body_geom)
    bridge_mesh=bpy.data.meshes.new("TITAN_RESEARCH_BridgeFacesOnlyMesh")
    bridge_mesh.from_pydata(merged_verts,[],bridge_faces)
    bridge_mesh.update(calc_edges=True)
    bridge_obj=bpy.data.objects.new("TITAN_RESEARCH_BridgeFacesOnly",bridge_mesh)
    bridge_obj.hide_render=True
    research.objects.link(bridge_obj)
    bridge_geom=geom(bridge_obj)
    bridge_body_overlaps=body_tree.overlap(geom_ops["real_tree"](bridge_geom))
    bridge_body_pairs=len(bridge_body_overlaps)
    # Attribute every real final bridge-to-original-body contact to the exact
    # matched original cut-edge segment which generated that bridge triangle.
    per_bridge_pair=[]
    current_polygon=0
    for row in per_pair:
        span=row["bridgeTriangles"]
        ids=set(range(current_polygon,current_polygon+span))
        if not ids or max(ids)>=len(bridge_geom["areas"]):
            raise RuntimeError("Lost original bridge segment face provenance.")
        overlaps=[(body_face,bridge_face) for body_face,bridge_face in bridge_body_overlaps
                  if bridge_face in ids]
        contacting={face for _,face in overlaps}
        total=sum(bridge_geom["areas"][face] for face in ids)*1e6
        contact=sum(bridge_geom["areas"][face] for face in contacting)*1e6
        if not (math.isfinite(total) and math.isfinite(contact) and total>0
                and 0<=contact<=total+1e-5):
            raise RuntimeError("Invalid real body contact area of specific cut-edge bridge.")
        per_bridge_pair.append({
            "leftEdge":row["leftEdge"],
            "rightEdge":row["rightEdge"],
            "measuredMidpointGapMm":row["measuredMidpointGapMm"],
            "bridgeTriangles":span,
            "originalBodyBVHPairs":len(overlaps),
            "contactingBridgeFaceCount":len(contacting),
            "bridgeFaceAreaMm2":round(total,4),
            "contactingBridgeFaceAreaMm2":round(contact,4),
        })
        current_polygon+=span
    if (current_polygon!=len(bridge_faces) or sum(
            row["originalBodyBVHPairs"] for row in per_bridge_pair)!=bridge_body_pairs):
        raise RuntimeError("Original bridge contact ownership did not reconcile with physical BVH.")
    clearance_trial = None
    targeted_reroute_trial = None
    if args.experimental_centroid_clearance_mm == 7.0:
        clearance_trial = trial_centerline_body_clearance(
            merged_verts, bridge_faces, body_tree, research, geom_ops,
            args.experimental_centroid_clearance_mm,
        )
        clearance_trial["originalBridgeBodyBVHPairs"] = bridge_body_pairs
        # Do not compare 18-triangle BVH counts with 6-triangle source.
        # Equal 18-face control/candidate and contacted-area comparisons above
        # are the only comparable research metrics.
        worst_index = max(range(len(per_bridge_pair)), key=lambda i: (
            per_bridge_pair[i]["originalBodyBVHPairs"],
            per_bridge_pair[i]["contactingBridgeFaceAreaMm2"],
            -i,
        ))
        worst = per_bridge_pair[worst_index]
        if worst["bridgeTriangles"] != 2 or worst["originalBodyBVHPairs"] <= 0:
            raise RuntimeError("Expected one measurable two-triangle worst source seam pair.")
        face_start = sum(row["bridgeTriangles"] for row in per_pair[:worst_index])
        targeted_reroute_trial = trial_targeted_seam_reroute(
            merged_verts,
            bridge_faces[face_start:face_start + worst["bridgeTriangles"]],
            body_tree,
            research,
            geom_ops,
            args.experimental_centroid_clearance_mm,
            (tuple(worst["leftEdge"]), tuple(worst["rightEdge"])),
        )
        targeted_reroute_trial["targetOriginalCutEdgePair"] = worst
    # If the trial is worse, preserve that number. Never auto-promote geometry.
    # These may legitimately be nonzero: always report, NEVER suppress as accepted fit.
    report={
      "version":"titan-actual-unmatched-crotch-source-bridge-research-v1",
      "modelIdentityId":IDENTITY,
      "candidateOnly":True,"productionApproved":False,"physicalFitApproved":False,
      "changesProductionGeometry":False,"sewnGarmentApproved":False,
      "metricCaveat":"Greedy minimum-total midpoint source-edge pairing at <=80mm, not tailor-approved seam, thickness or UV; actual bridge/body BVH contacts disqualify unconditional fit approval.",
      "partialWeldJoinedEdges":10,
      "unmatchedCutEdgesBefore":{"left":len(l_remaining),"right":len(r_remaining_mapped)},
      "trialAddedBridgeTriangles":len(bridge_faces),
      "trialSegments":per_pair,
      "actualBodyContactByOriginalCutEdgePair":per_bridge_pair,
      "bridgeToOriginalBodyBVHPairs":bridge_body_pairs,
      "openSourceBoundaryEdgesBeforeBridge":initial["afterWeldOpenEdges"],
      "openSourceBoundaryEdgesAfterBridge":len(after_open),
      "actualReductionOpenEdges":initial["afterWeldOpenEdges"]-len(after_open),
      "degenerateFaces":degenerate,
      "nonManifoldEdges":sum(n>2 for n in owners.values()),
      "finalClothQAApproved":False,
      "researchOnlyCentroidClearanceTrial":clearance_trial,
      "researchOnlyTargetedSeamRerouteTrial":targeted_reroute_trial,
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print("TITAN_ORIGINAL_FOUR_CROTCH_EDGES_BRIDGED_RESEARCH_ONLY",json.dumps(report,allow_nan=False))


if __name__=="__main__":
    main()
