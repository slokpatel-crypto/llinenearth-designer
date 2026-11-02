import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("four-angle Blender QA must bound sizes and apply requested samples",()=>{
  const source=readFileSync("scripts/blender/render-linen-earth-model-qa.py","utf8");
  assert.match(source,/def verify_render_settings\(width, height, samples\):/);
  for(const token of [
    "480 <= width <= 2048", "640 <= height <= 3072",
    "width * height > 6_000_000", "8 <= samples <= 256",
    'apply_render_samples(scene, options.samples)',
    '"requestedRenderSamples": options.samples',
    '"renderSamplesApplied": True',
    "qa cannot certify",
  ]) if(token==="qa cannot certify"){
    assert.match(source,/QA cannot certify this render/);
  }else assert.ok(source.includes(token),token);
  const main=source.slice(source.indexOf("def main():"));
  assert.ok(main.indexOf("verify_render_settings(options.width, options.height, options.samples)")>=0);
  assert.ok(main.indexOf("verify_render_settings(options.width, options.height, options.samples)")
      <main.indexOf("verify_source()"),
      "reject maliciously expensive renders before inspecting the source file");
  const test=readFileSync("tests/blender/test_model_qa_render_settings.py","utf8");
  assert.match(test,/qa\.apply_render_samples\(scene, sample_count\)/);
  assert.match(test,/qa\.verify_render_settings\(width, height, samples\)/);
});
