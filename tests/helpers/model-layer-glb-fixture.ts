// Synthetic unit-test triangle, never a garment or model source asset.
import { LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM } from "../../src/lib/designer/model-identity.ts";
import { MODEL_LAYER_SLOTS, type ModelLayerSlot } from "../../src/lib/designer/model-layer-contract.ts";

type Obj = Record<string, unknown>;
export type ExtensionFixtureDocument = {
  asset: Obj; scene: number; scenes: Obj[]; nodes: Obj[];
  meshes: { primitives: (Obj & { attributes: Obj })[]; [key: string]: unknown }[];
  materials: Obj[]; buffers: Obj[]; bufferViews: Obj[]; accessors: Obj[];
  [key: string]: unknown;
};
export function layerRegistration(slot: Exclude<ModelLayerSlot, "shirt" | "trouser"> = "blazer") {
  return {
    version: 1, slot, modelIdentityId: LINEN_EARTH_MODEL_IDENTITY_ID,
    referenceHeightMm: LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM,
    coordinateSpace: "locked-model-local", anchor: MODEL_LAYER_SLOTS.find(x => x.slot === slot)!.anchor,
    glbPath: `/models/garment-extensions/${slot}/unit-fixture.glb`,
    materialSlots: [`LAYER_${slot.toUpperCase().replace(/-/g, "_")}_FRONT`],
    state: "engineering-candidate",
  };
}
export function packLayerGlb(document: unknown, binary: Uint8Array) {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonSize = Math.ceil(json.length / 4) * 4, binSize = Math.ceil(binary.length / 4) * 4;
  const bytes = new Uint8Array(28 + jsonSize + binSize), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, jsonSize, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jsonSize); bytes.set(json, 20);
  view.setUint32(20 + jsonSize, binSize, true); view.setUint32(24 + jsonSize, 0x004e4942, true);
  bytes.set(binary, 28 + jsonSize);
  return bytes;
}
export function layerGlbFixture(options: { interleaved?: boolean; indices?: 1 | 2 | 4 | false; slot?: Exclude<ModelLayerSlot, "shirt" | "trouser"> } = {}) {
  const registration = layerRegistration(options.slot);
  const indicesWidth = options.indices === undefined ? 2 : options.indices;
  const bin = new Uint8Array(96 + (indicesWidth ? 3 * indicesWidth : 0));
  const view = new DataView(bin.buffer);
  const positions = [-0.1, 1.2, 0.1, 0.1, 1.2, 0.1, 0, 1.4, 0.1];
  const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs = [0, 0, 1, 0, 0.5, 1];
  for (let i = 0; i < 3; i++) {
    for (let c = 0; c < 3; c++) {
      view.setFloat32(options.interleaved ? i * 32 + c * 4 : i * 12 + c * 4, positions[i * 3 + c], true);
      view.setFloat32(options.interleaved ? i * 32 + 12 + c * 4 : 36 + i * 12 + c * 4, normals[i * 3 + c], true);
    }
    for (let c = 0; c < 2; c++) view.setFloat32(options.interleaved ? i * 32 + 24 + c * 4 : 72 + i * 8 + c * 4, uvs[i * 2 + c], true);
    if (indicesWidth === 1) view.setUint8(96 + i, i);
    if (indicesWidth === 2) view.setUint16(96 + i * 2, i, true);
    if (indicesWidth === 4) view.setUint32(96 + i * 4, i, true);
  }
  const bufferViews: Obj[] = options.interleaved
    ? [{ buffer: 0, byteLength: 96, byteStride: 32, target: 34962 }]
    : [{ buffer: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 }, { buffer: 0, byteOffset: 72, byteLength: 24 }];
  if (indicesWidth) bufferViews.push({ buffer: 0, byteOffset: 96, byteLength: 3 * indicesWidth, target: 34963 });
  const accessors: Obj[] = [
    { bufferView: 0, byteOffset: 0, componentType: 5126, type: "VEC3", count: 3, min: [-0.1, 1.2, 0.1], max: [0.1, 1.4, 0.1] },
    { bufferView: options.interleaved ? 0 : 1, byteOffset: options.interleaved ? 12 : 0, componentType: 5126, type: "VEC3", count: 3 },
    { bufferView: options.interleaved ? 0 : 2, byteOffset: options.interleaved ? 24 : 0, componentType: 5126, type: "VEC2", count: 3 },
  ];
  if (indicesWidth) accessors.push({ bufferView: options.interleaved ? 1 : 3, componentType: indicesWidth === 1 ? 5121 : indicesWidth === 2 ? 5123 : 5125, type: "SCALAR", count: 3 });
  const document: ExtensionFixtureDocument = {
    asset: { version: "2.0", generator: "Synthetic unit-test triangle; not a garment" },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0, ...(indicesWidth ? { indices: 3 } : {}) }] }],
    materials: [{ name: registration.materialSlots[0] }], buffers: [{ byteLength: bin.length }], bufferViews, accessors,
  };
  return { registration, document, binary: bin, view, pack: () => packLayerGlb(document, bin) };
}
