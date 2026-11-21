import assert from "node:assert/strict";
import test from "node:test";
import { currentCloudCustomerId } from "../src/lib/customer-saved-design-client.ts";

const customer = { customer: { id: "customer_123" } };
function transport(body: string, headers: Record<string, string> = {}) {
  return async () => new Response(body, {
    status: 200, headers: { "content-type": "application/json", ...headers },
  });
}

test("cloud session recheck accepts a bounded authenticated owner response", async () => {
  assert.equal(await currentCloudCustomerId(transport(JSON.stringify(customer))), "customer_123");
  assert.equal(await currentCloudCustomerId(transport(JSON.stringify(customer), {
    "content-length": String(JSON.stringify(customer).length),
  })), "customer_123");
});

test("cloud session recheck fails closed on declared and streamed oversized responses", async () => {
  const valid = JSON.stringify(customer);
  await assert.rejects(currentCloudCustomerId(transport(valid, { "content-length": "16385" })));
  await assert.rejects(currentCloudCustomerId(transport(valid, { "content-length": "invalid" })));
  await assert.rejects(currentCloudCustomerId(transport(valid + " ".repeat(17 * 1024))));
});

test("cloud session recheck rejects malformed JSON without accepting an owner", async () => {
  await assert.rejects(currentCloudCustomerId(transport("{")));
  await assert.rejects(currentCloudCustomerId(transport(JSON.stringify({ customer: null }))));
});
