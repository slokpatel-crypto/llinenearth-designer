"""Preserve only ankle-connected surfaces when deriving experimental trouser shells.

A scanned person's hands can occupy the same height/left-right coordinates as
thighs. A bounding-box mask alone cannot distinguish them. Face connectivity
through shared mesh EDGES, anchored at each ankle, rejects disconnected hand
patches without editing the body mesh or guessing a tighter calf silhouette.
This is a segmentation guard, NOT proof of a tailored or visually approved leg.
"""
from __future__ import annotations

import math
from collections import defaultdict, deque


def keep_ankle_connected_faces(faces, face_center_z, *, ankle_z_max, thigh_z_min):
    """Return original face indices belonging to exactly one ankle-thigh island.

    Faces are vertex-index tuples from the immutable body mesh. Components
    touch only when they share a complete edge; vertex-only touches must not
    attach floating hand fragments. Reject split, missing or cropped leg scans.
    """
    if not faces or len(faces) != len(face_center_z):
        raise ValueError("Leg candidate requires faces and matching face centres")
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool)
               and math.isfinite(v) for v in (*face_center_z, ankle_z_max, thigh_z_min)):
        raise ValueError("Leg anchor heights must be finite numeric values")
    if ankle_z_max >= thigh_z_min:
        raise ValueError("Ankle anchor must be below thigh coverage minimum")
    edge_faces = defaultdict(list)
    for i, face in enumerate(faces):
        if len(face) < 3 or len(set(face)) < 3 or any(
            not isinstance(v, int) or isinstance(v, bool) or v < 0 for v in face
        ):
            raise ValueError("Candidate leg faces must contain distinct nonnegative vertex indices")
        for a, b in zip(face, (*face[1:], face[0])):
            if a == b:
                raise ValueError("Degenerate edge in candidate leg source")
            edge_faces[(min(a, b), max(a, b))].append(i)

    neighbors = [set() for _ in faces]
    for incident in edge_faces.values():
        for index in incident:
            neighbors[index].update(other for other in incident if other != index)

    visited = set()
    qualifying = []
    for start in range(len(faces)):
        if start in visited:
            continue
        queue = deque([start])
        visited.add(start)
        component = []
        while queue:
            current = queue.popleft()
            component.append(current)
            for neighbor in neighbors[current]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        zs = [face_center_z[i] for i in component]
        if min(zs) <= ankle_z_max and max(zs) >= thigh_z_min:
            qualifying.append(component)

    if len(qualifying) != 1:
        raise ValueError(
            f"Expected exactly one ankle-to-thigh surface island; found {len(qualifying)}"
        )
    return sorted(qualifying[0])
