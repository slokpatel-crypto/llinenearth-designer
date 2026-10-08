import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("realistic trouser ring authoring covers actual calf/thigh depth without inventing a larger hem",()=>{
  // Execute the real Blender author's pure geometry helper in isolation:
  // no Blender dependency is needed to verify anatomy-derived XY profiles.
  const python=String.raw`
import ast, json, math, pathlib
from types import SimpleNamespace
source=pathlib.Path("scripts/blender/author-linen-earth-officewear.py").read_text()
module=ast.parse(source)
function=next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name=="body_aware_leg_ring")
namespace={}
exec(compile(ast.Module(body=[function],type_ignores=[]),"<body-aware-leg-ring>","exec"),namespace)
fit=namespace["body_aware_leg_ring"]
for side in (-1,1):
    target=side*.105
    samples=[
        SimpleNamespace(
            x=target + .072*math.cos(i*math.tau/64),
            y=-.035 + .064*math.sin(i*math.tau/64),
            z=.55+j*.003,
        )
        for j in range(10) for i in range(64)
    ]
    ring=(.565,target,0.0,.050,.050)
    fitted,evidence=fit(samples,ring,side,0.0,target,.007)
    assert evidence["status"]=="anatomy-fitted-geometry-only",evidence
    assert fitted[3]>=.080 and fitted[4]>=.080,(fitted,evidence)
    assert abs(fitted[1]-target)<=.0080001
    assert abs(fitted[2]+.035)<.002
    hem,hem_evidence=fit(samples,(.565,target,0.0,.032,.037),side,0.0,target,.007,keep_locked_hem_width=True)
    assert hem[3]==.032,hem
    assert hem_evidence["hemWidthLocked"] is True
empty,failure=fit([], (.565,.105,0,.050,.050),1,0,.105,.007)
assert failure["status"]=="unverified-insufficient-body-cross-section"
assert empty==(.565,.105,0,.050,.050)
print(json.dumps({"left":"pass","right":"pass","lockedHem":"pass","insufficientData":"fail_closed"}))
`;
  const result=spawnSync("python3",["-c",python],{encoding:"utf8",timeout:15_000});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const report=JSON.parse(result.stdout.trim());
  assert.equal(report.left,"pass");
  assert.equal(report.right,"pass");
  assert.equal(report.lockedHem,"pass");
  assert.equal(report.insufficientData,"fail_closed");
});
