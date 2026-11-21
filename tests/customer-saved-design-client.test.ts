import assert from "node:assert/strict";
import test from "node:test";
import { saveCloudDesign, listCloudDesigns, getCloudDesign, deleteCloudDesign } from "../src/lib/customer-saved-design-client.ts";

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
  await assert.rejects(() => listCloudDesigns(async () => response({designs: [row, row]})), /Invalid cloud/);
  assert.deepEqual(await listCloudDesigns(async () => response({designs: [row]})), [saved]);
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


test("two independent browser transports recover only their authenticated account records", async () => {
  const accounts = new Map<string, Map<string, typeof row>>();
  const makeTransport = (account: string) => async (_url: string, init?: RequestInit) => {
    const records = accounts.get(account) ?? new Map<string, typeof row>();
    accounts.set(account, records);
    if (init?.method === "POST") {
      const request = JSON.parse(String(init.body));
      if (request.action === "save") {
        const design = request.design;
        records.set(design.designId, {
          design_id: design.designId, updated_at: saved.savedAt, payload: design,
        });
        return response({saved: true, designId: design.designId});
      }
      if (request.action === "delete") {
        return response({deleted: records.delete(request.designId)});
      }
      return response({error: "invalid action"}, 400);
    }
    return response({designs: [...records.values()]});
  };
  // Separate transports represent separate browsers with no shared localStorage.
  const aliceBrowserOne = makeTransport("alice");
  const aliceBrowserTwo = makeTransport("alice");
  const bobBrowser = makeTransport("bob");
  await saveCloudDesign(saved, aliceBrowserOne);
  assert.deepEqual(await listCloudDesigns(aliceBrowserTwo), [saved]);
  assert.deepEqual(await listCloudDesigns(bobBrowser), []);
  await saveCloudDesign({...saved, title: "Bob's independent design"}, bobBrowser);
  assert.equal(await deleteCloudDesign(saved.id, bobBrowser), true);
  assert.deepEqual(await listCloudDesigns(aliceBrowserTwo), [saved]);
  assert.deepEqual(await listCloudDesigns(bobBrowser), []);
});

test("single-design cloud recovery enforces exact ID, authentication and private missing records", async () => {
  const recovered = await getCloudDesign(saved.id, async (url, init) => {
    assert.equal(url, "/api/customer-saved-designs?designId=SD-synthetic");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    return response({design: row});
  });
  assert.deepEqual(recovered, saved);
  assert.equal(await getCloudDesign(saved.id, async () => response({error: "not found"}, 404)), null);
  await assert.rejects(() => getCloudDesign(saved.id, async () => response({error: "sign in"}, 401)), /Sign in/);
  await assert.rejects(() => getCloudDesign(saved.id, async () =>
    response({design: {...row, design_id: "SD-other"}})), /Invalid cloud/);
  await assert.rejects(() => getCloudDesign(saved.id, async () =>
    response({design: row, owner_id: "leak"})), /Invalid cloud/);
  let called = false;
  await assert.rejects(() => getCloudDesign("../unsafe", async () => {
    called = true;
    return response({design: row});
  }), /Invalid design ID/);
  assert.equal(called, false);
});

test("cloud responses enforce declared and streamed size limits before decoding", async () => {
  const tooLarge = " ".repeat(25 * 1024 * 1024 + 1);
  await assert.rejects(() => listCloudDesigns(async () =>
    new Response('{"designs":[]}', {headers: {
      "content-type": "application/json", "content-length": String(25 * 1024 * 1024 + 1),
    }})), /Invalid cloud/);
  await assert.rejects(() => getCloudDesign(saved.id, async () =>
    new Response('{"design":null}', {headers: {
      "content-type": "application/json", "content-length": "not-a-number",
    }})), /Invalid cloud/);
  await assert.rejects(() => listCloudDesigns(async () =>
    new Response(tooLarge, {headers: {"content-type": "application/json"}})), /Invalid cloud/);
  await assert.rejects(() => deleteCloudDesign(saved.id, async () =>
    new Response("{", {headers: {"content-type": "application/json"}})), /Invalid cloud/);
});

test("valid numeric Content-Length permits bounded cloud save, list, recovery and delete", async () => {
  const withLength = (body: unknown) => {
    const encoded = JSON.stringify(body);
    return new Response(encoded, { headers: {
      "content-type": "application/json",
      "content-length": String(new TextEncoder().encode(encoded).byteLength),
    } });
  };
  await saveCloudDesign(saved, async () => withLength({saved: true, designId: saved.id}));
  assert.deepEqual(await listCloudDesigns(async () => withLength({designs: [row]})), [saved]);
  assert.deepEqual(await getCloudDesign(saved.id, async () => withLength({design: row})), saved);
  assert.equal(await deleteCloudDesign(saved.id, async () => withLength({deleted: true})), true);
});
