import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Readiness must be tied to the most recent successful network generation.
// A late reply from the previous refresh must never restore a green release gate.
const paths=[
  "src/app/operator/production-evidence/ProductionEvidenceClient.tsx",
  "src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx",
  "src/app/operator/roadmap-readiness/RoadmapReadinessClient.tsx",
];

test("all three operator dashboards invalidate old network generations",()=>{
  for(const path of paths){
    const source=readFileSync(path,"utf8");
    assert.match(source,/import \{ useEffect, useMemo, useRef, useState \}/);
    assert.match(source,/const latestLoad=useRef\(0\)/);
    assert.match(source,/const requestId=\+\+latestLoad\.current/);
    assert.match(source,/if\(requestId!==latestLoad\.current\) return/);
    assert.match(source,/return \(\)=>\{latestLoad\.current\+\+;\}/);
  }
});

test("Phase 8 rejects late responses and errors before restoring delivery proof",()=>{
  const source=readFileSync(paths[0],"utf8");
  assert.match(source,/if\(requestId!==latestLoad\.current\) return;\s*if\(!response\.ok\)/);
  assert.match(source,/catch \{\s*if\(requestId!==latestLoad\.current\) return/);
  assert.match(source,/if\(requestId===latestLoad\.current\) setLoading\(false\)/);
});

test("Phase 10 and Roadmap reject late successful completions and redirects",()=>{
  const phase=readFileSync(paths[1],"utf8");
  const roadmap=readFileSync(paths[2],"utf8");
  assert.match(phase,/if\(requestId!==latestLoad\.current\) return;\s*setData\(/);
  assert.match(phase,/if\(requestId===latestLoad\.current\) window\.location\.href/);
  assert.match(roadmap,/if\(requestId!==latestLoad\.current\) return;\s*if\(unauthorized\)/);
  assert.match(roadmap,/setSources\(\{\}\)/);
});
