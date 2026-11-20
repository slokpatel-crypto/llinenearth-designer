"""Native Blender physical cuff test fixtures, not fabricated source-body proof."""
import importlib.util
from pathlib import Path
import bpy

script=Path(__file__).resolve().parents[2]/"scripts/blender/research-locked-cuff-alignment.py"
spec=importlib.util.spec_from_file_location("titan_research_cuff",script)
assert spec is not None and spec.loader is not None
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

for value in (-10,40.01,float("nan"),float("inf")):
    try: mod.bounded_shift_mm(value)
    except RuntimeError: pass
    else: raise AssertionError("Unbounded physical shift accepted")
assert mod.bounded_shift_mm(37.)==37.
assert mod.weight(.5,.5)==1.
assert mod.weight(.645,.5)==0.
assert abs(mod.weight(.5725,.5)-.5)<1e-6
for i in range(50):
    z=.5+.145*i/50
    assert 0<=mod.weight(z,.5)<=1.

# Two genuine Blender cylinder meshes approximating only the test mechanics.
# Synthetic positions cannot satisfy native scanned-body fit acceptance.
objects={}
for name,sign in zip(mod.SLEEVES,(-1,1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.05,depth=.4,
        location=(sign*.31,0,.70))
    obj=bpy.context.object
    obj.name=name
    # Production authored garment meshes are world-space with identity transforms.
    # Apply the synthetic primitive location to match that exact contract.
    bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
    objects[name]=obj
base=mod.snapshot(objects)
hashes={name:mod.digest_mesh(obj) for name,obj in objects.items()}
moved=mod.move_cuffs(objects,(.55,.55),37.)
assert all(v>0 for v in moved.values())
assert all(mod.digest_mesh(objects[name])!=hashes[name] for name in objects)
for name in objects:
    top=[i for i,point in enumerate(base[name]) if point.z>=.695]
    assert top
    assert all(abs(objects[name].data.vertices[i].co.x-base[name][i].x)<1e-8 for i in top)
mod.restore(objects,base)
assert all(mod.digest_mesh(objects[name])==hashes[name] for name in objects)
print("TITAN_NATIVE_BOUND_CUFF_GEOMETRY_RESEARCH_FIXTURES_PASSED")
