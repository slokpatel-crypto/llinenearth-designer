import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("native 3D UV research preserves source geometry, original UV, identity and nonapproval",()=>{
  const src=readFileSync("scripts/blender/research-world-surface-uv.py","utf8");
  const workflow=readFileSync(".github/workflows/titan-native-source-candidate.yml","utf8");
  assert.match(src,/MODEL_IDENTITY = "linen-earth-studio-model-v1"/);
  assert.match(src,/REFERENCE_IMAGE = "\/designer\/studio-tucked.webp"/);
  assert.match(src,/candidateOnly":True, "productionApproved":False/);
  assert.match(src,/if geometry_before != world_mesh_signature\(obj\)/);
  assert.match(src,/if source_uv_before != uv_signature\(mesh, source_uv\)/);
  assert.match(src,/if hashlib.sha256\(source.read_bytes\(\)\).hexdigest\(\) != original_source_hash/);
  assert.match(src,/scene\["linen_earth_asset_status"\] = "research-surface-grain-uv-unapproved"/);
  assert.match(src,/uv_metrics\(obj, candidate\)/);
  assert.match(src,/face_plane_uv\(points\)/);
  assert.match(src,/if candidate_metrics\["collapsedUvTriangles"\] > original\["collapsedUvTriangles"\]/);
  assert.match(workflow,/tests\/blender\/test_world_surface_uv_research.py/);
  assert.match(workflow,/scripts\/blender\/research-world-surface-uv.py/);
  assert.match(workflow,/tests\/python\/test_world_surface_uv_report.py/);
  assert.match(workflow,/UV_RESEARCH_ONLY_NOT_PROMOTED/);
});
