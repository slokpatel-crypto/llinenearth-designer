"""Source-topology-preserving shirt shoulder candidate, no Blender dependency.

The source human scan, not a real tailoring pattern, determines which faces
exist. A face is assigned to only one region before any thickness or fitting.
Neighbouring source faces share their original vertex IDs and cannot create
overlapping independent torso/sleeve skins at an armhole.

Passing this topology audit is NOT photo parity, fit, sewn construction, UV
scale, collar/placket/cuff, or production acceptance.
"""
from collections import Counter, defaultdict
import math


REGIONS = ("torso", "left_sleeve", "right_sleeve")


def torso_half_width(height_ratio):
    start, end = 0.645, 0.841
    if height_ratio <= start:
        return 0.158
    if height_ratio >= end:
        return 0.205
    t = (height_ratio - start) / (end - start)
    t = t * t * (3 - 2 * t)
    return 0.158 + (0.205 - 0.158) * t


def classify_shirt_face(world_center, center_x, floor_z, height):
    x, y, z = world_center
    if not all(math.isfinite(value) for value in (x, y, z, center_x, floor_z, height)):
        raise ValueError("Nonfinite source mesh coordinate")
    if height <= 0:
        raise ValueError("Invalid reference body height")
    r = (z - floor_z) / height
    offset = x - center_x
    # Torso wins in the source scan's former overlapping shoulder region:
    # the prior two individual garment shells copied those faces twice.
    if 0.615 <= r <= 0.875 and abs(offset) <= torso_half_width(r):
        return "torso"
    if 0.500 <= r <= 0.875 and offset <= -0.155:
        return "left_sleeve"
    if 0.500 <= r <= 0.875 and offset >= 0.155:
        return "right_sleeve"
    return None


def analyze_labelled_faces(faces, labels):
    """Graph of REAL shared source edges, not nearest-point fake seams."""
    if len(faces) != len(labels):
        raise ValueError("Faces and classifications mismatch")
    if not faces or any(label not in REGIONS for label in labels):
        raise ValueError("No complete source garment face classifications")
    edges = defaultdict(list)
    all_vertices = set()
    parents = {}
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for i, face in enumerate(faces):
        if len(face) < 3 or len(set(face)) != len(face) or any(type(v) is not int or v < 0 for v in face):
            raise ValueError("Invalid source polygon topology")
        parents[i] = i
        all_vertices.update(face)
        for j, a in enumerate(face):
            b = face[(j+1)%len(face)]
            edges[tuple(sorted((a,b)))].append((i,labels[i],(a,b)))
    seams = []
    nonmanifold = 0
    winding_errors = 0
    for edge, owners in edges.items():
        if len(owners) > 2:
            nonmanifold += 1
        elif len(owners) == 2:
            a,b=owners
            ra,rb=root(a[0]),root(b[0])
            if ra != rb:
                parents[ra] = rb
            if a[2] == b[2]:
                winding_errors += 1
            if a[1] != b[1]:
                seams.append((edge,a[1],b[1]))
    groups = Counter(labels)
    adjacency = Counter(tuple(sorted((a,b))) for _,a,b in seams)
    return {
        "polygonCount":len(faces),
        "vertexCount":len(all_vertices),
        "sourceOpenBoundaryEdges":sum(len(owners)==1 for owners in edges.values()),
        "sourceNonmanifoldEdges":nonmanifold,
        "sharedEdgeWindingErrors":winding_errors,
        "connectedComponents":len({root(i) for i in parents}),
        "regionFaceCounts":{k:groups[k] for k in REGIONS},
        "sourceEdgeSeamCount":len(seams),
        "sourceSeamRegionPairs":{"/".join(pair):v for pair,v in sorted(adjacency.items())},
        "sourceSeamEdges":seams,
    }
