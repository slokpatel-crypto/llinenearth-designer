import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("measured GLB viewer sidecars cannot survive an unmeasured overwrite",()=>{
  const source=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  assert.match(source,/def validate_export_destination\(output_path, panel_spec_path\):/);
  assert.match(source,/if not panel_spec_path and os\.path\.exists\(manifest_path\):/);
  assert.match(source,/Refusing to overwrite a GLB without measured --panel-spec/);
  for(const token of ["tempfile.mkstemp", "handle.flush()", "os.fsync(handle.fileno())", "os.replace(staged_path, manifest_path)"])
    assert.ok(source.includes(token),token);
  const main=source.slice(source.indexOf("def main():"));
  const guard=main.indexOf("validate_export_destination(args.output, args.panel_spec)");
  const preflight=main.indexOf("run_scene_preflight()");
  const exportCall=main.indexOf("export_glb(collection, args.output)");
  assert.ok(guard>=0&&preflight>guard&&exportCall>preflight,
    "destination evidence mismatch must be blocked before any export");
  const native=readFileSync("tests/blender/test_export_sidecar_preservation.py","utf8");
  for(const token of ["glb.read_bytes()", "sidecar.read_text", "export.validate_export_destination", "different-candidate.glb", "simulated manifest serialization failure", ".linen-earth-viewer-*.tmp"])
    assert.ok(native.includes(token),token);
});
