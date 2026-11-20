import assert from "node:assert/strict";
import test from "node:test";
import { saveCloudDesign, listCloudDesigns, deleteCloudDesign } from "../src/lib/customer-saved-design-client.ts";

const saved = { id: "SD-synthetic", title: "Synthetic design", savedAt: "2026-11-20T00:00:00Z",
  brief: {}, version: { id: "synthetic" }, renderSet: {} } as Parameters<typeof saveCloudDesign>[0];
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});
const row = {design_id: saved.id, updated_at: saved.savedAt,
  payload: {schemaVersion: 1, designId: saved.id, title: saved.title,
    recipe: {brief: saved.brief, version: saved.version, renderSet: saved.renderSet}}};

test("explicit cloud save carries recipe but never a caller-supplied owner", async () => {
  let calls = 0;
  await saveCloudDesign(saved, async (_url, init) => {
    calls++;
    assert.equal(init?.credentials, "same-origin");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(Object.keys(body), ["action", "design"]);
    assert.equal(body.design.designId, saved.id);
    assert.equal(JSON.stringify(body).includes("ownerId"), false);
    return response({saved: true, designId: saved.id});
  });
  assert.equal(calls, 1);
});

test("cloud list restores validated versioned recipe without reading browser storage", async () => {
  const designs = await listCloudDesigns(async () => response({designs: [row]}));
  assert.deepEqual(designs, [saved]);
  await assert.rejects(() => listCloudDesigns(async () =>
    response({designs: [{...row, owner_id: "private"}]})), /Invalid cloud/);
});

test("cloud operations reject missing authentication and forged acknowledgements", async () => {
  await assert.rejects(() => listCloudDesigns(async () => response({error: "Sign in"}, 401)), /Sign in/);
  await assert.rejects(() => saveCloudDesign(saved, async () =>
    response({saved: "true", designId: saved.id})), /not acknowledged/);
  await assert.rejects(() => deleteCloudDesign(saved.id, async () =>
    response({deleted: "true"})), /not acknowledged/);
  assert.equal(await deleteCloudDesign(saved.id, async () => response({deleted: true})), true);
});

test("invalid cloud records and local-only unsafe recipe cannot be uploaded", async () => {
  let called = false;
  await assert.rejects(() => saveCloudDesign({...saved, brief: {ownerId: "forged"} } as typeof saved,
    async () => {called = true; return response({saved: true, designId: saved.id});}), /cannot be saved/);
  assert.equal(called, false);
  await assert.rejects(() => listCloudDesigns(async () => response({designs: "invalid"})), /Invalid cloud/);
});
