"""GPU-independent four-view SVG geometry diagnosis of a REAL rejected Blender scene.
Not texture, tailoring, realism, visual parity, owner approval or production evidence.
Never edits model, garments or scene. Requires explicit --unapproved flag.
"""
from __future__ import annotations
import argparse
import json
import math
import sys
from pathlib import Path
import bpy

PANELS={
    "ShirtTorsoFabric":"shirt","ShirtSleeveLFabric":"shirt",
    "ShirtSleeveRFabric":"shirt","TrouserWaistFabric":"trouser",
    "TrouserLegLFabric":"trouser","TrouserLegRFabric":"trouser",
}
VIEWS=(("front",0.0),("three-quarter",35.0),("side",90.0),("back",180.0))
COLOURS={"body":("#efece6","#dedcd5","#c9c6bd"),
         "shirt":("#baaa92","#ad9d85","#988973"),
         "trouser":("#546071","#495463","#404959"),
         "shoes":("#665449","#59493f","#473b34")}

def selected_meshes():
    names=["Body",*PANELS]
    shoes=[]
    for obj in bpy.data.objects:
        name=obj.name.split(".")[0]
        if name in ("ShoeL","ShoeR","SoleL","SoleR","HeelL","HeelR") or name.startswith("ShoeLace"):
            shoes.append(obj.name)
    names+=sorted(shoes)
    missing=[name for name in ("Body",*PANELS) if name not in bpy.data.objects]
    if missing:
        raise RuntimeError("Missing real source mesh; refusing fictional drawing: "+", ".join(missing))
    return names

def mesh_geometry(obj):
    depsgraph=bpy.context.evaluated_depsgraph_get()
    evaluated=obj.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        transform=evaluated.matrix_world
        xyz=[tuple(transform @ vertex.co) for vertex in mesh.vertices]
        faces=[tuple(face.vertices) for face in mesh.loop_triangles]
        return xyz,faces
    finally:
        evaluated.to_mesh_clear()

def args():
    argv=sys.argv
    argv=argv[argv.index("--")+1:] if "--" in argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--output-dir",required=True)
    parser.add_argument("--resolution-x",type=int,default=448)
    parser.add_argument("--resolution-y",type=int,default=600)
    parser.add_argument("--unapproved",action="store_true",required=True)
    return parser.parse_args(argv)

def screen(point,angle):
    c,s=math.cos(angle),math.sin(angle)
    # At zero yaw: x-right/z-up, looking from negative Y.
    return (c*point[0]+s*point[1],point[2],-s*point[0]+c*point[1])

def render_svg(output,objects,yaw,width,height):
    angle=math.radians(yaw)
    points=[]
    silhouettes=[]
    for kind,xyz,faces in objects:
        proj=[screen(p,angle) for p in xyz]
        points.extend((p[0],p[1]) for p in proj)
        silhouettes.append((kind,proj,faces))
    if not points:raise RuntimeError("Cannot draw a missing 3D mesh")
    min_x=min(x for x,_ in points);max_x=max(x for x,_ in points)
    min_y=min(y for _,y in points);max_y=max(y for _,y in points)
    margin=28
    scale=min((width-2*margin)/max(max_x-min_x,.01),(height-2*margin)/max(max_y-min_y,.01))
    translate_x=(width-(min_x+max_x)*scale)/2
    translate_y=(height+(min_y+max_y)*scale)/2
    triangles=[]
    for kind,proj,faces in silhouettes:
        for a,b,c in faces:
            x0,y0,z0=proj[a];x1,y1,z1=proj[b];x2,y2,z2=proj[c]
            area=abs((x1-x0)*(y2-y0)-(x2-x0)*(y1-y0))
            if area<1e-12:continue
            shade=0 if area>.00015 else (1 if area>.00004 else 2)
            px=lambda x:f"{x*scale+translate_x:.1f}"
            py=lambda y:f"{translate_y-y*scale:.1f}"
            triangle=f'<path d="M{px(x0)},{py(y0)}L{px(x1)},{py(y1)}L{px(x2)},{py(y2)}Z" fill="{COLOURS[kind][shade]}"/>'
            triangles.append(((z0+z1+z2)/3,triangle))
    triangles.sort(key=lambda entry:entry[0],reverse=True)
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open("w",encoding="utf8") as file:
        file.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">\n')
        file.write('<rect width="100%" height="100%" fill="#f2ece2"/>\n')
        file.write('<!-- UNAPPROVED source-geometry projection, NOT calibrated linen optics or parity -->\n')
        for _,polygon in triangles:file.write(polygon+"\n")
        file.write('<rect x="2" y="2" width="99%" height="25" fill="#ffffff" fill-opacity="0.85"/>\n')
        file.write('<text x="8" y="19" font-size="12" fill="#8a221e">UNAPPROVED · GEOMETRY ONLY · NOT PHOTOREAL</text>\n</svg>\n')
    return {"renderedTriangles":len(triangles),
            "boundingX":[round(min_x,4),round(max_x,4)],
            "boundingZ":[round(min_y,4),round(max_y,4)],"unapproved":True}

def main():
    cfg=args()
    if cfg.resolution_x<240 or cfg.resolution_y<300 or cfg.resolution_x>1800 or cfg.resolution_y>2400:
        raise ValueError("Unapproved geometry canvas dimensions are bounded")
    root=Path(cfg.output_dir).expanduser().resolve()
    scene_objects=[]
    for name in selected_meshes():
        obj=bpy.data.objects[name]
        if obj.type!="MESH":raise RuntimeError("Cannot draw nonmesh "+name)
        points,faces=mesh_geometry(obj)
        if not points or not faces:raise RuntimeError("Empty real source mesh "+name)
        kind="body" if name=="Body" else PANELS.get(name,"shoes")
        scene_objects.append((kind,points,faces))
    report={"sourceScene":bpy.data.filepath,"diagnosticOnly":True,"visualApproval":False,
            "physicalFabricRepeatVerified":False,
            "algorithm":"screen-space triangle-centroid painter, no EEVEE/GPU",
            "realSourceMeshCount":len(scene_objects),"views":{}}
    for name,yaw in VIEWS:
        filename=root/f"{name}-UNAPPROVED-geometry.svg"
        report["views"][name]=render_svg(filename,scene_objects,yaw,cfg.resolution_x,cfg.resolution_y)
        print("Wrote actual-source "+name+" CPU geometry diagnostic: "+str(filename),flush=True)
    (root/"UNAPPROVED.txt").write_text("UNAPPROVED GPU-FREE REAL GEOMETRY DIAGNOSTIC ONLY. Not fabric, realism, tailor or photographic approval.\n")
    (root/"cpu-projection-evidence.json").write_text(json.dumps(report,indent=2)+"\n")

if __name__=="__main__":
    main()
