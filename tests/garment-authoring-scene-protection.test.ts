import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Blender garment authoring refuses source .blend overwrite before mutations",()=>{
  const source=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.match(source,/def safe_candidate_output\(raw_output, source_blend\):/);
  assert.match(source,/Path\(source_blend\)\.expanduser\(\)\.resolve\(\)/);
  assert.match(source,/Path\(raw_output\)\.expanduser\(\)\.resolve\(\)/);
  assert.match(source,/if output == source or \(output\.exists\(\) and os\.path\.samefile\(output, source\)\):/);
  assert.match(source,/Refusing to overwrite the original identity-locked Blender source/);
  const main=source.slice(source.indexOf("def main():"));
  const validated=main.indexOf("output = safe_candidate_output(options.output, bpy.data.filepath)");
  const firstBody=main.indexOf("bpy.data.objects.get(options.body)");
  const firstMutation=main.indexOf("remove_existing(name)");
  const save=main.indexOf("bpy.ops.wm.save_as_mainfile(filepath=str(output))");
  assert.ok(validated>=0&&firstBody>validated&&firstMutation>firstBody&&save>firstMutation);
  assert.doesNotMatch(main,/output = Path\(options.output\)\.expanduser\(\)\.resolve\(\)/);
  const fixture=readFileSync("tests/blender/test_authoring_scene_protection.py","utf8");
  assert.match(fixture,/original\.read_bytes\(\)/);
  assert.match(fixture,/alias\.symlink_to\(original\)/);
  assert.match(fixture,/os\.link\(original, hardlink\)/);
  assert.match(fixture,/author\.safe_candidate_output/);
});
