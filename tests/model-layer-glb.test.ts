import assert from "node:assert/strict";
import test from "node:test";
import { inspectModelLayerGlb, MODEL_LAYER_GLB_LIMITS } from "../src/lib/designer/model-layer-glb.ts";
import { layerGlbFixture, packLayerGlb } from "./helpers/model-layer-glb-fixture.ts";

test("All five addon families get byte-level candidate inspection without a production claim", () => {
  for (const slot of ["blazer", "waistcoat", "tie", "belt", "pocket-square"] as const) {
    for (const interleaved of [false, true]) for (const indices of [1, 2, 4, false] as const) {
      const fixture = layerGlbFixture({ slot, interleaved, indices });
      const bytes = fixture.pack(), before = bytes.slice(), metadata = JSON.stringify(fixture.registration);
      const result = inspectModelLayerGlb(bytes, fixture.registration);
      assert.equal(result.candidateReady, true, `${slot}/${interleaved}/${indices}: ${result.reasons.join(" ")}`);
      assert.equal(result.productionApproved, false);
      assert.equal(result.vertexCount, 3); assert.equal(result.triangleCount, 1); assert.equal(result.primitiveCount, 1);
      assert.deepEqual(result.materialNames, fixture.registration.materialSlots);
      assert.equal(result.boundsMetres?.min.length, 3);
      assert.deepEqual(bytes, before); assert.equal(JSON.stringify(fixture.registration), metadata);
    }
  }
});

function rejectFixture(label: string, mutate: (fixture: ReturnType<typeof layerGlbFixture>) => void, pattern?: RegExp) {
  test(label, () => {
    const fixture = layerGlbFixture(); mutate(fixture);
    const result = inspectModelLayerGlb(fixture.pack(), fixture.registration);
    assert.equal(result.candidateReady, false, label);
    assert.equal(result.productionApproved, false);
    assert.equal(result.triangleCount, 0, "Partial inspection cannot look successful.");
    assert.equal(result.reasons.length, 1);
    if (pattern) assert.match(result.reasons[0], pattern);
  });
}

test("Header, chunk ordering, alignment, declared sizes and truncations fail closed", () => {
  const fixture = layerGlbFixture(), valid = fixture.pack();
  for (let length = 0; length < valid.length; length++) {
    assert.equal(inspectModelLayerGlb(valid.subarray(0, length), fixture.registration).candidateReady, false, `truncated ${length}`);
  }
  const jsonSize = new DataView(valid.buffer).getUint32(12, true);
  for (const [at, value] of [[0, 0], [4, 1], [8, valid.length + 4], [12, jsonSize - 1], [12, 0xffffffff],
    [16, 0x004e4942], [20 + jsonSize, 0xffffffff], [24 + jsonSize, 0x4e4f534a]]) {
    const bytes = valid.slice(); new DataView(bytes.buffer).setUint32(at, value, true);
    assert.equal(inspectModelLayerGlb(bytes, fixture.registration).candidateReady, false, `${at}/${value}`);
  }
  const trailing = new Uint8Array(valid.length + 8); trailing.set(valid);
  new DataView(trailing.buffer).setUint32(8, trailing.length, true);
  assert.equal(inspectModelLayerGlb(trailing, fixture.registration).candidateReady, false);
  const corruptText = valid.slice(); corruptText[20] = 0xff;
  assert.equal(inspectModelLayerGlb(corruptText, fixture.registration).candidateReady, false);
  for (const root of [null, [], 1, "document", {}, { asset: [] }]) {
    assert.equal(inspectModelLayerGlb(packLayerGlb(root, fixture.binary), fixture.registration).candidateReady, false);
  }
});

test("Uint8Array offset is respected (Node Buffer slices do not expose adjacent memory)", () => {
  const fixture = layerGlbFixture(), valid = fixture.pack();
  const padded = new Uint8Array(valid.length + 17).fill(0xff); padded.set(valid, 7);
  assert.equal(inspectModelLayerGlb(padded.subarray(7, 7 + valid.length), fixture.registration).candidateReady, true);
});

for (const field of ["images", "textures", "samplers", "skins", "animations", "cameras", "extensionsUsed", "extensionsRequired", "extensions", "extras"]) {
  rejectFixture(`Unsupported ${field} cannot alter the geometry or fetch remote data`, f => { f.document[field] = []; });
}
for (const uri of ["https://example.org/body.bin", "../body.bin", "data:application/octet-stream;base64,AA==", ""]) {
  rejectFixture(`Buffer URI is forbidden, including ${JSON.stringify(uri)}`, f => { f.document.buffers[0].uri = uri; });
}
for (const value of [null, [], "2.0", 1, true]) {
  rejectFixture(`Malformed asset metadata ${JSON.stringify(value)}`, f => { f.document.asset = value as never; });
}
rejectFixture("Asset version must be exactly 2.0", f => { f.document.asset.version = "1.0"; });
rejectFixture("New minimum glTF versions need explicit support", f => { f.document.asset.minVersion = "2.1"; });
rejectFixture("No second embedded or external buffer", f => { f.document.buffers.push({ byteLength: 1 }); });
rejectFixture("Declared buffer cannot exceed actual BIN", f => { f.document.buffers[0].byteLength = 100000; });
rejectFixture("Declared buffer cannot leave excess uncounted padding", f => { f.document.buffers[0].byteLength = 1; });
test("BIN padding must be zero", () => {
  const f = layerGlbFixture(), bytes = f.pack(); bytes[bytes.length - 1] = 1;
  assert.match(inspectModelLayerGlb(bytes, f.registration).reasons[0], /padding/);
});

for (const materials of [[], [{ name: "ShirtTorsoFabric" }], [{ name: "LAYER_TIE_FRONT" }], [{ name: "LAYER_BLAZER_FRONT" }, { name: "LAYER_BLAZER_FRONT" }]]) {
  rejectFixture("Actual materials must match registration: " + JSON.stringify(materials), f => { f.document.materials = materials; });
}
rejectFixture("Declared but unused materials cannot impersonate independent panels", f => {
  f.document.materials.push({ name: "LAYER_BLAZER_BACK" }); f.registration.materialSlots.push("LAYER_BLAZER_BACK");
}, /not assigned/);
rejectFixture("Material image references are outside the static geometry profile", f => { f.document.materials[0].normalTexture = { index: 0 }; });
rejectFixture("PBR textures cannot hide a remote loader", f => { f.document.materials[0].pbrMetallicRoughness = { baseColorTexture: { index: 0 } }; });
rejectFixture("Out-of-range PBR factors fail closed", f => { f.document.materials[0].pbrMetallicRoughness = { roughnessFactor: -1 }; });
rejectFixture("Malformed material booleans fail closed", f => { f.document.materials[0].doubleSided = "false"; });

for (const [field, value] of [["buffer", 1], ["byteOffset", -1], ["byteOffset", 100000], ["byteLength", 100000],
  ["byteStride", 5], ["byteStride", 0], ["byteStride", 256], ["target", 999], ["extensions", {}]] as const) {
  rejectFixture(`Invalid bufferView ${field}=${JSON.stringify(value)}`, f => { f.document.bufferViews[0][field] = value; });
}
for (const [field, value] of [["bufferView", -1], ["bufferView", 99], ["bufferView", "0"], ["componentType", 5123],
  ["count", 1e30], ["count", 0], ["count", 3.5], ["count", 4], ["type", "VEC4"], ["byteOffset", 1],
  ["byteOffset", 4], ["normalized", true], ["sparse", {}], ["min", [-0.1, 1.2, 0]], ["max", [0.1, 100, 0.1]]] as const) {
  rejectFixture(`Invalid position accessor ${field}=${JSON.stringify(value)}`, f => { f.document.accessors[0][field] = value; });
}
rejectFixture("Missing binary POSITION bounds fail closed", f => { delete f.document.accessors[0].min; });
rejectFixture("Vertex attributes must have equal count", f => { f.document.accessors[1].count = 2; });
rejectFixture("Indices cannot use float components", f => { f.document.accessors[3].componentType = 5126; });
rejectFixture("Indices must be tightly packed", f => { f.document.bufferViews[3].byteStride = 4; });
rejectFixture("Indices cannot target vertex buffers", f => { f.document.bufferViews[3].target = 34962; });
rejectFixture("Vertex attributes cannot target index buffers", f => { f.document.bufferViews[0].target = 34963; });
rejectFixture("Index and vertex data cannot share a view", f => { f.document.accessors[3].bufferView = 0; delete f.document.bufferViews[3].target; });
rejectFixture("Unused accessor payload is rejected", f => { f.document.accessors.push({ ...f.document.accessors[0] }); });
rejectFixture("Unused bufferView payload is rejected", f => { f.document.bufferViews.push({ ...f.document.bufferViews[0] }); });
test("Shared attribute views require a stride and bounds-safe interleaving", () => {
  for (const stride of [undefined, 4, 28, 252]) {
    const f = layerGlbFixture({ interleaved: true });
    f.document.bufferViews[0].byteStride = stride;
    assert.equal(inspectModelLayerGlb(f.pack(), f.registration).candidateReady, false, String(stride));
  }
});

rejectFixture("Unselected scenes are not eligible", f => { f.document.scene = 1; });
rejectFixture("Hidden second scenes are not accepted", f => { f.document.scenes.push({ nodes: [0] }); });
rejectFixture("Hidden unreachable nodes are rejected", f => { f.document.nodes.push({}); });
rejectFixture("Hidden unused meshes are rejected", f => { f.document.meshes.push(structuredClone(f.document.meshes[0])); });
rejectFixture("Cycles are rejected without recursive traversal", f => { f.document.nodes[0].children = [0]; });
rejectFixture("Repeated scene roots are rejected", f => { f.document.scenes[0].nodes = [0, 0]; });
rejectFixture("Multiple parents cannot multiply garment meshes", f => {
  f.document.nodes = [{ children: [1, 2] }, { children: [2] }, { mesh: 0 }];
});
rejectFixture("Mesh instancing cannot evade performance counting", f => {
  f.document.nodes.push({ mesh: 0 }); f.document.scenes[0].nodes = [0, 1];
});
for (const [key, value] of [["translation", [0, 1, 0]], ["rotation", [0, 0, 0, -1]], ["scale", [-1, 1, 1]],
  ["matrix", Array(16).fill(0)], ["skin", 0], ["camera", 0], ["extensions", {}]] as const) {
  rejectFixture(`Node ${key} must be baked or unsupported: ${JSON.stringify(value)}`, f => { f.document.nodes[0][key] = value; });
}
test("Identity group nodes and baked identity TRS are allowed", () => {
  const f = layerGlbFixture();
  f.document.nodes = [{ children: [1] }, { mesh: 0, translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }];
  assert.equal(inspectModelLayerGlb(f.pack(), f.registration).candidateReady, true);
});
rejectFixture("Matrix and TRS cannot be mixed even at identity", f => {
  f.document.nodes[0].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; f.document.nodes[0].scale = [1, 1, 1];
});
for (const mode of [0, 1, 3, 5, 6, "4"]) rejectFixture(`Non-triangle primitive ${mode}`, f => { f.document.meshes[0].primitives[0].mode = mode; });
for (const key of ["targets", "extensions", "extras"]) rejectFixture(`Unsupported primitive ${key}`, f => { f.document.meshes[0].primitives[0][key] = []; });
rejectFixture("Missing UV accessor is rejected", f => { delete f.document.meshes[0].primitives[0].attributes.TEXCOORD_0; });
rejectFixture("Skin joint attributes cannot replace body geometry", f => { f.document.meshes[0].primitives[0].attributes.JOINTS_0 = 0; });
for (const value of [NaN, Infinity, -Infinity, 1000, -1000]) {
  rejectFixture(`Actual binary position ${value} cannot be hidden by JSON bounds`, f => { f.view.setFloat32(0, value, true); });
}
for (const [offset, value] of [[36, NaN], [44, 0], [44, 10], [72, Infinity], [72, NaN]]) {
  rejectFixture(`Binary normal/UV corruption at ${offset}: ${value}`, f => { f.view.setFloat32(offset, value, true); });
}
rejectFixture("Negative world height indicates wrong locked frame", f => { f.view.setFloat32(4, -1, true); });
rejectFixture("Out-of-range indices cannot read adjacent buffers", f => { f.view.setUint16(96, 3, true); });
rejectFixture("Repeated vertex indices make degenerate triangles", f => { f.view.setUint16(96, 1, true); });
rejectFixture("Incomplete triangle element count is rejected", f => { f.document.accessors[3].count = 2; });
rejectFixture("Geometrically collinear triangles fail even with distinct IDs", f => {
  f.view.setFloat32(24, 0, true); f.view.setFloat32(28, 1.2, true); f.document.accessors[0].max = [0.1, 1.2, 0.1];
});
rejectFixture("Collapsed UV triangles cannot masquerade as fabric-ready geometry", f => { f.binary.fill(0, 72, 96); });

test("Candidate registration and file budgets are enforced before geometry processing", () => {
  const f = layerGlbFixture();
  for (const registration of [null, {}, { ...f.registration, state: "approved" }, { ...f.registration, modelIdentityId: "another-model" }]) {
    const result = inspectModelLayerGlb(f.pack(), registration);
    assert.equal(result.candidateReady, false); assert.equal(result.productionApproved, false);
  }
  assert.equal(inspectModelLayerGlb(new Uint8Array(MODEL_LAYER_GLB_LIMITS.fileBytes + 1), f.registration).candidateReady, false);
  const hugeJson = { ...f.document, extra: " ".repeat(MODEL_LAYER_GLB_LIMITS.jsonBytes) };
  assert.equal(inspectModelLayerGlb(packLayerGlb(hugeJson, f.binary), f.registration).candidateReady, false);
});

test("Seeded byte mutations always return a fail-closed report or a non-production candidate", () => {
  const f = layerGlbFixture(), valid = f.pack(); let seed = 8931;
  for (let i = 0; i < 1000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const bytes = valid.slice(), offset = seed % bytes.length; bytes[offset] ^= (seed >>> 16) % 255 + 1;
    const result = inspectModelLayerGlb(bytes, f.registration);
    assert.equal(typeof result.candidateReady, "boolean"); assert.equal(result.productionApproved, false);
    assert.ok(result.reasons.length > 0);
  }
});
