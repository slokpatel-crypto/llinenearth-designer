import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const pinned = "9ba871ff2ecd36526b77432745980b7e6664ecd0c7ca11c48849073dcfe06da3";
const archive = "blender-4.5.14-linux-x64.tar.xz";
const workflows = [
  "titan-native-blender.yml",
  "titan-native-source-candidate.yml",
  "titan-native-authoring-inputs.yml",
  "titan-native-scene-preservation.yml",
  "titan-native-export-sidecar.yml",
  "titan-native-model-qa-settings.yml",
];

test("every production 3D native QA workflow has a pinned, verified official Blender fallback",()=>{
  for(const filename of workflows){
    const script=readFileSync(".github/workflows/"+filename,"utf8");
    assert.ok(script.includes("set -euo pipefail"),filename+" must fail closed");
    assert.ok(script.includes("https://download.blender.org/release/Blender4.5/"+archive),filename);
    assert.ok(script.includes("https://mirror.blender.org/release/Blender4.5/"+archive),filename);
    assert.ok(script.includes("if ! curl --fail --location --show-error --silent --retry 3"),filename);
    assert.ok(script.includes("rm -f \"$archive\""),filename+" must not reuse a failed download");
    assert.ok(script.includes(pinned),filename+" must retain the original pinned SHA256");
    const verify=script.indexOf("sha256sum --check --status");
    const unpack=script.indexOf("tar -xf");
    assert.ok(verify>0 && unpack>verify,filename+" must verify exact bytes before extraction");
    assert.ok(script.includes("blender-4.5.14-linux-x64/blender"),filename+" must run the pinned runtime");
  }
});
