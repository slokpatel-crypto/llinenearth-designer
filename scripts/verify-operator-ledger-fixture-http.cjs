"use strict";
// Exercise the built route against an isolated loopback PostgREST fixture.
// The child receives synthetic credentials only, never inherited backend config.
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { createHmac, randomBytes } = require("node:crypto");
const lists = {
  production_quote_list: 100,
  production_order_list: 100,
  finished_garment_qc_list: 250,
  production_customer_outcome_list: 250,
  production_order_learning_context_list: 500,
};
const optional = Object.keys(lists).slice(2);
const secret = randomBytes(32).toString("hex");
const key = "sb_secret_fixture_only";
let scenario = {}, calls = [], fixtureFault;
const fixture = http.createServer(async (req, res) => {
  try {
    const name = req.url?.replace("/rest/v1/rpc/", "");
    assert.ok(Object.hasOwn(lists, name), "Only allowlisted read RPCs permitted");
    assert.equal(req.method, "POST");
    assert.equal(req.headers.apikey, key);
    assert.equal(req.headers.authorization, undefined, "Synthetic Supabase secret key must not be sent as a bearer token");
    let body = "";
    for await (const part of req) body += part;
    assert.deepEqual(JSON.parse(body), { p_limit: lists[name] });
    calls.push(name);
    const reply = scenario[name] || { status: 200, body: [] };
    res.writeHead(reply.status, { "content-type": "application/json" });
    res.end(JSON.stringify(reply.body));
  } catch (error) {
    fixtureFault = error;
    res.writeHead(500).end();
  }
});
async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}
async function main() {
  let child;
  try {
    const backendPort = await listen(fixture);
    // Reserve an ephemeral port instead of assuming the main QA server is free.
    const reservation = http.createServer();
    const appPort = await listen(reservation);
    await new Promise(resolve => reservation.close(resolve));
    const base = `http://127.0.0.1:${appPort}`;
    const env = {
      PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      LINEN_OPERATOR_SESSION_SECRET: secret,
      SUPABASE_URL: `http://127.0.0.1:${backendPort}`,
      SUPABASE_SECRET_KEY: key,
    };
    child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(appPort)], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output = (output + chunk).slice(-8000); });
    const url = `${base}/api/operator/production`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw Error(`Fixture Next exited: ${output}`);
      try { ready = (await fetch(url, { signal: AbortSignal.timeout(500) })).status === 401; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, `Fixture Next did not start: ${output}`);
    assert.equal(calls.length, 0, "Anonymous readiness must not read a ledger");
    function signedCookie(data) {
      const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
      return "linen_operator_session=" + payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
    }
    const cookie = signedCookie({ v: 1, exp: Date.now() + 120000 });
    let cases = 0;
    async function rejectSession(name, suppliedCookie) {
      scenario = {};
      calls = [];
      fixtureFault = undefined;
      const headers = suppliedCookie ? { cookie: suppliedCookie } : {};
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 401, name);
      assert.match(response.headers.get("cache-control") || "", /private.*no-store/, name);
      assert.deepEqual(await response.json(), { error: "Unauthorized." }, name);
      assert.ifError(fixtureFault);
      assert.equal(calls.length, 0, `${name}: rejected sessions must not contact PostgREST`);
      cases++;
    }
    await rejectSession("anonymous GET", null);
    await rejectSession("malformed session", "linen_operator_session=garbage");
    await rejectSession("forged HMAC", cookie.split(".")[0] + "." + Buffer.alloc(32).toString("base64url"));
    await rejectSession("expired signed session", signedCookie({ v: 1, exp: Date.now() - 60000 }));
    await rejectSession("wrong signed session version", signedCookie({ v: 2, exp: Date.now() + 120000 }));
    await rejectSession("invalid signed expiry type", signedCookie({ v: 1, exp: "tomorrow" }));
    await rejectSession("extra signed session segment", cookie + ".extra");
    const empty = { configured: true, quotes: [], orders: [], qcInspections: [], customerOutcomes: [], learningContexts: [] };
    async function check(name, replies, expected, expectedBody = empty) {
      scenario = replies;
      calls = [];
      fixtureFault = undefined;
      const response = await fetch(url, { headers: { cookie }, signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, expected, name);
      assert.match(response.headers.get("cache-control") || "", /private.*no-store/, name);
      const body = await response.json();
      if (expected === 503) assert.deepEqual(body, { error: "Production records could not be read." }, name);
      else assert.deepEqual(body, expectedBody, name);
      // Promise.all can reject before the other four reads reach the fixture.
      // Drain the batch before changing the next scenario.
      for (let attempt = 0; calls.length < 5 && attempt < 100; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ifError(fixtureFault);
      assert.deepEqual([...calls].sort(), Object.keys(lists).sort(), `${name}: exactly five read RPCs`);
      cases++;
    }
    await check("genuine empty ledger", {}, 200);
    const fields = ["quotes", "orders", "qcInspections", "customerOutcomes", "learningContexts"];
    for (const [index, [name, limit]] of Object.entries(lists).entries()) {
      const rows = Array.from({ length: limit }, (_, id) => ({ id: `fixture-${id}` }));
      await check(`${name} preserves records at exact limit`, { [name]: { status: 200, body: rows } }, 200, { ...empty, [fields[index]]: rows });
    }
    for (const [name, limit] of Object.entries(lists)) {
      for (const body of [null, {}, "DO-NOT-LEAK", [null], [42], Array.from({ length: limit + 1 }, () => ({}))]) {
        await check(`${name} rejects malformed/over-limit list`, { [name]: { status: 200, body } }, 503);
      }
    }
    for (const name of optional) {
      await check(`${name} verified missing RPC`, { [name]: { status: 404, body: { code: "PGRST202" } } }, 200);
      await check(`${name} generic 404`, { [name]: { status: 404, body: { message: "DO-NOT-LEAK" } } }, 503);
      await check(`${name} backend outage`, { [name]: { status: 503, body: { code: "PGRST202" } } }, 503);
    }
    console.log(`TITAN built-Next authenticated ledger fixture HTTP PASS: ${cases} cases; external backend calls: 0; mutation RPCs: 0.`);
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    await new Promise(resolve => fixture.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
