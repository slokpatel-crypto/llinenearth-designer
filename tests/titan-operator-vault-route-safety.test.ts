import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("all service-role vault and production mutations gate origin and streamed body before RPC",()=>{
  for(const path of ["src/app/api/designer/vault/route.ts","src/app/api/measurements/vault/route.ts","src/app/api/operator/production/route.ts"]){
    const code=readFileSync(path,"utf8");
    const gate=code.indexOf("secureJsonRequestError(request,");
    const body=code.indexOf("readSecureJsonObject(request,");
    const firstRpc=code.indexOf('await rpc<',body);
    assert.ok(gate>0&&body>gate&&firstRpc>body,path);
    assert.ok(code.includes("SecureJsonBodyTooLarge"),path);
    assert.ok(code.includes("SecureJsonBodyInvalid"),path);
  }
});
test("stock and production service-role backend diagnostics are not returned to browsers",()=>{
  const stock=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const prod=readFileSync("src/app/api/operator/production/route.ts","utf8");
  assert.ok(stock.includes("class StockBackendError"));
  assert.ok(stock.includes('if(error instanceof StockBackendError) return NextResponse.json({error:"Stock ledger backend could not complete the operation."}'));
  assert.ok(prod.includes('return NextResponse.json({error:"Production operation could not be completed."}'));
  assert.ok(!prod.includes('error:error instanceof Error?error.message:"Production operation failed."'));
});
test("stock mutation also rejects same-site fetch-metadata CSRF",()=>{
  const s=readFileSync("src/lib/designer/operator-stock-safety.ts","utf8");
  assert.ok(s.includes('fetchSite!=="same-origin"&&fetchSite!=="none"'));
});

test("measurement token recovery and owned reads share strict validation, not removed legacy helpers",()=>{
  const code=readFileSync("src/app/api/measurements/vault/route.ts","utf8");
  assert.ok(!/\bvalidProfile\(/.test(code));
  assert.ok(!/\bvalidObservations\(/.test(code));
  assert.ok(code.includes('if(!row||!validMeasurementVaultProfile(row.profile)||!validMeasurementVaultObservations(row.observations))'));
});
