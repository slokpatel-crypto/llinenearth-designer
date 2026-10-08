"""Blender-independent physical arc-map helpers for tubular garment UVs.

Maps circumference onto texture U without flattening the sides of a sleeve
or trouser leg into an X projection. The circumference is a scene geometry
ESTIMATE until owner/supplier physically measures the panel; callers must
not mark textile repeat scale as verified on this basis alone.
"""
from __future__ import annotations
import math


def frame_at_height(rings, z):
    if isinstance(z,bool) or not isinstance(z,(int,float)) or not math.isfinite(z):
        raise ValueError("Physical height must be finite.")
    frames=sorted([tuple(r) for r in rings], key=lambda p:p[0])
    if len(frames)<2:
        raise ValueError("A sleeve/leg needs two or more physical ring frames.")
    for ring in frames:
        if len(ring)!=5 or any(isinstance(v,bool) or not isinstance(v,(int,float))
            or not math.isfinite(v) for v in ring) or ring[3]<=0 or ring[4]<=0:
            raise ValueError("Ring requires finite positive X/Y radii.")
    if any(right[0]<=left[0] for left,right in zip(frames,frames[1:])):
        raise ValueError("Source ring heights must not repeat.")
    if z<=frames[0][0]: return frames[0]
    if z>=frames[-1][0]: return frames[-1]
    for left,right in zip(frames,frames[1:]):
        if left[0]<=z<=right[0]:
            t=(z-left[0])/(right[0]-left[0])
            return (z,)+tuple(left[k]*(1-t)+right[k]*t for k in range(1,5))
    raise ValueError("Could not interpolate real construction ring.")


def ellipse_arc_uv(x,y,frame, *, inward_seam_side=1, steps=64):
    if inward_seam_side not in (-1,1) or isinstance(inward_seam_side,bool):
        raise ValueError("Inward garment seam direction is +1 or -1.")
    if isinstance(steps,bool) or not isinstance(steps,int) or not 16<=steps<=128:
        raise ValueError("UV arc integration must stay bounded.")
    if len(frame)!=5:
        raise ValueError("Physical ring frame requires z, x, y and radii.")
    _,cx,cy,rx,ry=frame
    if any(isinstance(v,bool) or not isinstance(v,(int,float))
           or not math.isfinite(v) for v in (x,y,cx,cy,rx,ry)) or rx<=0 or ry<=0:
        raise ValueError("Nonphysical ellipse UV geometry.")
    seam=0 if inward_seam_side==1 else math.pi
    phase=(math.atan2((y-cy)/ry,(x-cx)/rx)-seam)%math.tau
    delta=math.tau/steps
    def integrate(angle):
        whole=min(steps,int(angle/delta))
        length=sum(
            math.hypot(rx*math.sin(seam+(i+.5)*delta),
                       ry*math.cos(seam+(i+.5)*delta))*delta
            for i in range(whole)
        )
        tail=max(0,angle-whole*delta)
        if whole<steps and tail>0:
            mid=seam+whole*delta+tail*.5
            length+=math.hypot(rx*math.sin(mid),ry*math.cos(mid))*tail
        return length
    perimeter=integrate(math.tau)
    return integrate(phase)/perimeter


def ellipse_ring_perimeter_m(frame,steps=128):
    """Geometry-only circumference represented by one full UV U period.

    Do not confuse X-diameter with full-around cloth length. Lab-preview
    geometry estimates are never sufficient as physical panel measurements.
    """
    if len(frame)!=5:
        raise ValueError("Garment perimeter requires a physical ring frame.")
    rx,ry=frame[3],frame[4]
    if any(isinstance(v,bool) or not isinstance(v,(int,float))
           or not math.isfinite(v) for v in (rx,ry)) or rx<=0 or ry<=0:
        raise ValueError("Garment frame must have finite positive radii.")
    if not isinstance(steps,int) or isinstance(steps,bool) or not 32<=steps<=1024:
        raise ValueError("Garment perimeter integration must be bounded.")
    delta=math.tau/steps
    return sum(math.hypot(rx*math.sin((index+.5)*delta),
                          ry*math.cos((index+.5)*delta))*delta
               for index in range(steps))
