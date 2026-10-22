import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("both CI workflows reuse only the fixed Chromium browser binary, without bypassing QA",()=>{
  for(const file of [".github/workflows/ci.yml",".github/workflows/deep-engine-non3d.yml"]){
    const yaml=readFileSync(file,"utf8");
    assert.match(yaml,/Restore pinned Chromium browser cache/);
    assert.match(yaml,/uses: actions\/cache@v4/);
    assert.match(yaml,/path: ~\/\.cache\/ms-playwright/);
    assert.match(yaml,/chromium-playwright-1\.63\.0-v1/);
    assert.match(yaml,/playwright@1\.63\.0/);
    assert.match(yaml,/install --with-deps chromium/);
    assert.match(yaml,/npm (test|run quality)/);
    assert.match(yaml,/npm run build/);
    assert.ok(yaml.indexOf("Restore pinned Chromium browser cache")<
      yaml.indexOf("Install pinned"),"restore browser cache before installing it");
    assert.doesNotMatch(yaml,/cache:\s*node_modules|path:\s*node_modules/);
  }
});
