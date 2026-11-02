import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("production silhouettes use actual cloth triangle-plane sections when vertex bands are sparse",()=>{
  const source=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  assert.match(source,/def triangle_plane_span_x\(obj, z_world\):/);
  for(const token of [
    "mesh.calc_loop_triangles()",
    "world = [matrix @ vertex.co for vertex in mesh.vertices]",
    "for triangle in mesh.loop_triangles:",
    "t = (z_world - a.z) / dz",
    "xs.append(a.x + t * (b.x - a.x))",
    "evaluated.to_mesh_clear()",
    "return triangle_plane_span_x(obj, z_world)",
    "if len(xs) >= 4:",
  ]) assert.ok(source.includes(token),token);
  assert.match(source,/if len\(xs\) < 2 or max\(xs\) - min\(xs\) <= 1e-6:/);
  const author=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.ok(author.includes('locked_guide_height(bpy.context.scene, "LE_GUIDE_TROUSER_WAIST")'));
  assert.ok(author.includes("trouser_waist_guide_z + 0.028"),
    "waist shell must reach the actual locked photo guide, not arbitrary source-body ratio");
  assert.match(author,/"TrouserWaistFabric": lambda p: z\(0\.455\) <= p\.z <= trouser_waist_upper_z/);
  assert.doesNotMatch(author,/"TrouserWaistFabric": lambda p: z\(0\.455\) <= p\.z <= z\(0\.620\)/);
  const native=readFileSync("tests/blender/test_sparse_garment_plane_section.py","utf8");
  assert.match(native,/preflight\.triangle_plane_span_x\(cube, 0\.6\)/);
  assert.match(native,/all\(abs\(v\.z - 0\.6\) > 0\.018 for v in world\)/);
  assert.match(native,/preflight\.triangle_plane_span_x\(empty, 0\.6\) is None/);
});
