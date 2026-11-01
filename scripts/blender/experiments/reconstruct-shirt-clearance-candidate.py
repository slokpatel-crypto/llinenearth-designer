"""Reconstruct a smooth torso envelope from the existing garment, candidate only.
No body changes, production approval, textile measurement or sewn-pattern claim.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    source = Path(bpy.data.filepath).resolve()
    output = Path(args.output).resolve()
    if not source.is_file() or source == output:
        raise RuntimeError('Load source and choose a separate output')
    scene = bpy.context.scene
    if scene.get('linen_earth_model_identity_id') != 'linen-earth-studio-model-v1':
        raise RuntimeError('Canonical identity required')
    obj = bpy.data.objects['ShirtTorsoFabric']
    body = bpy.data.objects['Body']
    body_before = [tuple(v.co) for v in body.data.vertices]
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    low, high = min(p.z for p in points), max(p.z for p in points)
    segments, rings = 64, 40
    vertices, faces = [], []
    for row in range(rings):
        z = low + (high-low)*row/(rings-1)
        band = [p for p in points if abs(p.z-z) <= .012]
        if len(band) < 8:
            raise RuntimeError('Insufficient source cross-section evidence')
        xmin,xmax = min(p.x for p in band),max(p.x for p in band)
        ymin,ymax = min(p.y for p in band),max(p.y for p in band)
        cx,cy = (xmin+xmax)/2,(ymin+ymax)/2
        rx,ry = (xmax-xmin)/2,(ymax-ymin)/2
        # Smooth rounded rectangular sections retain source extents, with
        # explicit estimated geometry rather than physical pattern claims.
        for col in range(segments):
            angle=2*math.pi*col/segments
            c,s=math.cos(angle),math.sin(angle)
            vertices.append((cx+rx*math.copysign(abs(c)**.75,c),cy+ry*math.copysign(abs(s)**.75,s),z))
    for row in range(rings-1):
        for col in range(segments):
            n=(col+1)%segments
            faces.append((row*segments+col,row*segments+n,(row+1)*segments+n,(row+1)*segments+col))
    mesh=bpy.data.meshes.new('LE_RECONSTRUCTED_TORSO_CANDIDATE')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    uv=mesh.uv_layers.new(name='CandidateUnmeasuredUV')
    for polygon in mesh.polygons:
        polygon.use_smooth=True
        col=polygon.index%segments
        row=polygon.index//segments
        for loop,coord in zip(polygon.loop_indices,[(col/segments,row/(rings-1)),((col+1)/segments,row/(rings-1)),((col+1)/segments,(row+1)/(rings-1)),(col/segments,(row+1)/(rings-1))]):
            uv.data[loop].uv=coord
    mats=list(obj.data.materials)
    obj.data=mesh
    obj.matrix_world.identity()
    for modifier in list(obj.modifiers): obj.modifiers.remove(modifier)
    for mat in mats: mesh.materials.append(mat)
    # Fit generated surface to evaluated body with explicit candidate offset.
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    wrap=obj.modifiers.new('Candidate body clearance','SHRINKWRAP')
    wrap.target=body
    wrap.wrap_method='NEAREST_SURFACEPOINT'
    wrap.wrap_mode='OUTSIDE_SURFACE'
    wrap.offset=.007
    bpy.ops.object.modifier_apply(modifier=wrap.name)
    for key in list(obj.keys()):
        if key.startswith('linen_earth_uv_'):
            del obj[key]
    scene['linen_earth_uv_coordinate_units']='unverified_normalized_candidate'
    scene['linen_earth_uv_supplier_repeat_verified']=False
    scene['linen_earth_uv_grain_direction_verified']=False
    solid=obj.modifiers.new('Candidate thickness','SOLIDIFY')
    solid.thickness=.0016
    solid.offset=1
    obj['linen_earth_reconstruction_method']='source_envelope_superellipse_unverified'
    scene['linen_earth_production_approved']=False
    scene['linen_earth_photo_parity_verified']=False
    assert body_before==[tuple(v.co) for v in body.data.vertices]
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(json.dumps(dict(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),vertices=len(vertices),quads=len(faces),bodyUnchanged=True,productionApproved=False)))

if __name__=='__main__': main()
