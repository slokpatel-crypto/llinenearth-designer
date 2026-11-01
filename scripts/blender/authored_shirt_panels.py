"""Topology-first, unmeasured SHIRT pattern mesh with actual open armholes.

No scan-shell duplication, shrinkwrap, approximate seam allowances or body edits.
The 2D arrangement is authored explicitly: front, back, upper yoke and two
sleeves share manifold armhole edges. Estimated dimensions are visual
hypotheses ONLY, not measured garments, original model likeness, UV truth,
tailoring approval or physics. Geometry is metres.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import math

N = 64
ARM_HALF_CELLS = 6
# Meters, exploratory only. No supplier/body/garment measurement provenance.
PROFILE = (
    (1.04, 0.176, 0.138), # tucked hem
    (1.12, 0.185, 0.144),
    (1.20, 0.196, 0.151),
    (1.28, 0.204, 0.154), # lower armhole corner
    (1.31, 0.207, 0.154),
    (1.34, 0.210, 0.155),
    (1.37, 0.207, 0.151),
    (1.40, 0.202, 0.144),
    (1.43, 0.196, 0.138), # upper armhole corner, yoke begins
    (1.46, 0.157, 0.120),
    (1.49, 0.118, 0.092),
    (1.52, 0.078, 0.067), # neck ring (left intentionally open)
)
ROLE_NAMES = ("front", "back", "yoke", "left_sleeve", "right_sleeve")


def _edge(a,b):
    return tuple(sorted((a,b)))


def _mesh_edges(faces):
    owners = defaultdict(list)
    for fi,face in enumerate(faces):
        if len(face)<3 or len(set(face))!=len(face):
            raise ValueError("Invalid or collapsed face in proposed shirt construction")
        for j,a in enumerate(face):
            b=face[(j+1)%len(face)]
            owners[_edge(a,b)].append((fi,a,b))
    return owners


def boundary_loops(faces):
    """Follow oriented genuine 1-face edges; fail on branched/open boundaries."""
    edges = _mesh_edges(faces)
    if any(len(v)>2 for v in edges.values()):
        raise ValueError("Nonmanifold face incident count")
    unpaired=[(v[0][1],v[0][2]) for v in edges.values() if len(v)==1]
    successors = {}
    predecessors = {}
    for a,b in unpaired:
        if a in successors or b in predecessors:
            raise ValueError("Branched or inconsistently wound source boundary")
        successors[a]=b
        predecessors[b]=a
    if set(successors)!=set(predecessors):
        raise ValueError("Open boundary chain, not a closed hole")
    loops=[]
    unused=set(successors)
    while unused:
        first=min(unused)
        current=first
        loop=[]
        while current in unused:
            unused.remove(current)
            loop.append(current)
            current=successors[current]
        if current!=first or len(loop)<3:
            raise ValueError("Open or collapsed boundary")
        loops.append(loop)
    return loops


def _winding_and_islands(faces):
    edges=_mesh_edges(faces)
    winding=0
    adjacency=[set() for _ in faces]
    for owner in edges.values():
        if len(owner)==2:
            (i,a,b),(j,c,d)=owner
            adjacency[i].add(j)
            adjacency[j].add(i)
            if (a,b)==(c,d):
                winding+=1
    components=0
    seen=set()
    for start in range(len(faces)):
        if start in seen:
            continue
        components+=1
        todo=[start]
        while todo:
            i=todo.pop()
            if i in seen:
                continue
            seen.add(i)
            todo.extend(adjacency[i]-seen)
    return {
        "connectedComponents":components,
        "windingErrors":winding,
        "nonmanifoldEdges":sum(len(v)>2 for v in edges.values()),
        "boundaryEdgeCount":sum(len(v)==1 for v in edges.values()),
    }


def _arm_sector(j, center):
    return ((j-center+N//2) % N-N//2) in range(-ARM_HALF_CELLS,ARM_HALF_CELLS)


def _distance(a,b):
    return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))


def make_shirt_mesh(*, omit_sleeve=None, upper_ease_mm=0.0, cuff_radius_mm=68.0,
                    source_arm_centerlines=None, source_arm_sections=None):
    """Return explicit vertices/faces/piece regions, including ring-welded sleeves.

    omit_sleeve for regression ONLY: must leave corresponding armhole boundary.
    """
    if omit_sleeve not in (None,"left_sleeve","right_sleeve"):
        raise ValueError("Invalid armhole regression control")
    if (not math.isfinite(upper_ease_mm) or not 0 <= upper_ease_mm <= 30 or
        not math.isfinite(cuff_radius_mm) or not 60 <= cuff_radius_mm <= 90):
        raise ValueError("Unmeasured shirt pattern variation out of bounded limits")
    if source_arm_centerlines is not None:
        if (not isinstance(source_arm_centerlines,dict) or
            set(source_arm_centerlines)!={"left_sleeve","right_sleeve"}):
            raise ValueError("Both actual source arm paths are required")
        for name,points in source_arm_centerlines.items():
            if (not isinstance(points,(list,tuple)) or len(points)!=5 or
                any(not isinstance(p,(list,tuple)) or len(p)!=3 or
                    any(type(x) not in (int,float) or not math.isfinite(x) for x in p)
                    for p in points)):
                raise ValueError("Actual source arm path has missing or invalid observations")
    if source_arm_sections is not None:
        if source_arm_centerlines is not None:
            raise ValueError("Choose either source arm paths or complete source sections")
        if (not isinstance(source_arm_sections,dict) or
            set(source_arm_sections)!= {"left_sleeve","right_sleeve"}):
            raise ValueError("Both real scanned source arm sections required")
        for side,sections in source_arm_sections.items():
            if not isinstance(sections,(list,tuple)) or len(sections)!=5:
                raise ValueError("Five actual source arm sections required per side")
            for section in sections:
                if not isinstance(section,dict) or not section.get("sourceMeasured"):
                    raise ValueError("Unknown or unmeasured arm section")
                fields=("centerM","basisFront","basisSide")
                for field in fields:
                    vec=section.get(field)
                    if not isinstance(vec,(tuple,list)) or len(vec)!=3 or any(
                        type(x) not in (int,float) or not math.isfinite(x) for x in vec
                    ):
                        raise ValueError("Invalid source section geometry vector")
                radius=section.get("radiusM")
                if type(radius) not in (float,int) or not math.isfinite(radius) or not .02<=radius<=.16:
                    raise ValueError("Unbounded source section cloth radius")
    verts=[]
    for z,rx,ry in PROFILE:
        # The actual garment construction changes, not the scanned body.
        # A shoulder/chest-specific outward shape trial leaves the tucked
        # waist and neck endpoints fixed; unknown ease stays UNMEASURED.
        if z<=1.20:
            influence=0.0
        elif z<=1.42:
            influence=(z-1.20)/.22
        else:
            influence=max(0.0,(1.52-z)/.10)
        extra=(upper_ease_mm/1000.0)*influence
        for j in range(N):
            theta=2*math.pi*j/N
            verts.append(((rx+extra)*math.cos(theta),
                          (ry+extra)*math.sin(theta),z))
    faces=[]
    roles=[]
    for row in range(len(PROFILE)-1):
        for j in range(N):
            if 3<=row<8 and (_arm_sector(j,0) or _arm_sector(j,N//2)):
                continue
            j2=(j+1)%N
            faces.append((row*N+j,row*N+j2,(row+1)*N+j2,(row+1)*N+j))
            theta=2*math.pi*(j+.5)/N
            roles.append("yoke" if row>=8 else ("front" if math.sin(theta)<0 else "back"))

    before=boundary_loops(faces)
    if len(before)!=4:
        raise ValueError(f"Expected neck, hem and exactly two armholes; got {len(before)}")
    holes={}
    for loop in before:
        center=[sum(verts[idx][axis] for idx in loop)/len(loop) for axis in range(3)]
        span=max(verts[idx][2] for idx in loop)-min(verts[idx][2] for idx in loop)
        if abs(center[0])>0.13 and span>0.10:
            side="right_sleeve" if center[0]>0 else "left_sleeve"
            if side in holes:
                raise ValueError("Duplicate armhole side")
            holes[side]=loop
    if len(holes)!=2:
        raise ValueError("Both armhole loops must be geometric boundaries")

    seam_edges={}
    for side,loop in sorted(holes.items()):
        seam_edges[side]=[_edge(loop[i],loop[(i+1)%len(loop)])
                          for i in range(len(loop))]
        if omit_sleeve==side:
            continue
        sign=-1 if side=="left_sleeve" else 1
        n=len(loop)
        p0=[sum(verts[v][axis] for v in loop)/n for axis in range(3)]
        # Position is a DOCUMENTED HYPOTHESIS, not a pose correction or 500mm
        # hand spacing assertion. Cuff remains near the generic source arm.
        p1=(sign*.281, 0.0, .96)
        delta=(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2])
        length=math.sqrt(sum(x*x for x in delta))
        if length<.18:
            raise ValueError("Sleeve would collapse or reverse length")
        axis=tuple(v/length for v in delta)
        e1=(0.,1.,0.)
        # axis x e1, orthogonal to arm axis (tested for nonzero).
        e2=(-axis[2],0.,axis[0])
        norm=math.sqrt(sum(v*v for v in e2))
        if norm<.1:
            raise ValueError("Sleeve axis incompatible with orientation")
        e2=tuple(v/norm for v in e2)
        # Root seam angle is inferred from ACTUAL source boundary vertices,
        # not arbitrary j/n indexing that twists the sleeve surface.
        if source_arm_sections is not None:
            first=source_arm_sections[side][0]
            front0=first["basisFront"]
            lateral0=first["basisSide"]
            angles=[]
            for idx in loop:
                difference=tuple(verts[idx][axis]-p0[axis] for axis in range(3))
                u=sum(difference[axis]*front0[axis] for axis in range(3))
                v=sum(difference[axis]*lateral0[axis] for axis in range(3))
                if math.hypot(u,v)<1e-5:
                    raise ValueError("Armhole seam cannot be projected into real arm section frame")
                angles.append(math.atan2(v,u))
        previous=list(loop)
        for step in range(1,6):
            t=step/5
            if source_arm_centerlines is not None:
                source_point=source_arm_centerlines[side][step-1]
                expected_z=p0[2]+(.985-p0[2])*t
                if (abs(source_point[2]-expected_z)>.025 or
                    sign*source_point[0]<.205 or abs(source_point[1])>.28):
                    raise ValueError("Source arm section cannot be registered with actual sleeve root")
                center=tuple(source_point)
            elif source_arm_sections is not None:
                section=source_arm_sections[side][step-1]
                center=tuple(section["centerM"])
                expected_z=p0[2]+(.985-p0[2])*t
                if abs(center[2]-expected_z)>.025 or sign*center[0]<.205:
                    raise ValueError("Measured source section does not match sleeve root")
            else:
                center=tuple((1-t)*p0[k]+t*p1[k] for k in range(3))
            e1_step=e1
            e2_step=e2
            ring_radius=cuff_radius_mm/1000.0
            if source_arm_sections is not None:
                e1_step=section["basisFront"]
                e2_step=section["basisSide"]
                ring_radius=section["radiusM"]
            ring=[]
            for j,idx in enumerate(loop):
                phi=angles[j] if source_arm_sections is not None else 2*math.pi*j/n
                # Smoothly transfer existing true armhole perimeter to cuff
                # circular pattern, without duplicating or tearing root edges.
                orig=verts[idx]
                px=(1-t)*(orig[0]-p0[0]) + t*ring_radius*(math.cos(phi)*e1_step[0]+math.sin(phi)*e2_step[0])
                py=(1-t)*(orig[1]-p0[1]) + t*ring_radius*(math.cos(phi)*e1_step[1]+math.sin(phi)*e2_step[1])
                pz=(1-t)*(orig[2]-p0[2]) + t*ring_radius*(math.cos(phi)*e1_step[2]+math.sin(phi)*e2_step[2])
                ring.append(len(verts))
                verts.append((center[0]+px,center[1]+py,center[2]+pz))
            for j in range(n):
                nxt=(j+1)%n
                # Reverse the underlying torso's oriented hole boundary.
                faces.append((previous[nxt],previous[j],ring[j],ring[nxt]))
                roles.append(side)
            previous=ring

    if len(faces)!=len(roles):
        raise RuntimeError("Lost material regions while joining authored panels")
    after=boundary_loops(faces)
    topology=_winding_and_islands(faces)
    topology.update({
        "vertexCount":len(verts),"polygonCount":len(faces),
        "boundaryLoopsAfterSleeves":len(after),
        "boundaryLoopVertexCounts":sorted(len(x) for x in after),
        "armholeLoopVertexCounts":{name:len(loop) for name,loop in holes.items()},
        "armholeSeamEdgeCounts":{name:len(e) for name,e in seam_edges.items()},
        "panelFaceCounts":dict(Counter(roles)),
        "panelSeamsAuthored":True,
        "supplierMeasurementsApproved":False,
        "realModelPoseParityApproved":False,
        "genericSourceScanArmPathUsed":source_arm_centerlines is not None or source_arm_sections is not None,
        "bodySectionTangentRadiusCalibrated":source_arm_sections is not None,
        "canonicalPhotoModelArmPoseVerified":False,
        "upperBodyEaseMmExperimentalOnly":upper_ease_mm,
        "sleeveCuffRadiusMmExperimentalOnly":cuff_radius_mm,
    })
    return {
        "vertices":verts,"faces":faces,"roles":roles,"armholeSeamEdges":seam_edges,
        "topology":topology,
    }
