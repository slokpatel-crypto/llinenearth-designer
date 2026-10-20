import { LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM } from "./model-identity.ts";
import { inspectModelLayerAssetRegistration } from "./model-layer-assets.ts";

/**
 * Deliberately narrow baked, static extension profile. Passing this preflight
 * does not load anything, certify an identity, or approve cloth/fit/UV scale.
 * glTF lengths are metres. Transforms must be baked into model-local vertices.
 * See docs/MODEL_LAYER_ASSET_PREFLIGHT.md for export and acceptance boundaries.
 */
export const MODEL_LAYER_GLB_PROFILE = "linen-earth-static-layer-v1" as const;
export const MODEL_LAYER_GLB_LIMITS = Object.freeze({
  fileBytes: 8 * 1024 * 1024,
  jsonBytes: 512 * 1024,
  vertices: 60_000,
  triangles: 80_000,
  primitives: 128,
  nodes: 128,
  accessors: 512,
});

type JsonObject = Record<string, unknown>;
type Bounds = { min: number[]; max: number[] };
export type ModelLayerGlbInspection = Readonly<{
  profile: typeof MODEL_LAYER_GLB_PROFILE;
  candidateReady: boolean;
  productionApproved: false;
  fileBytes: number;
  vertexCount: number;
  triangleCount: number;
  primitiveCount: number;
  materialNames: readonly string[];
  boundsMetres: Bounds | null;
  reasons: readonly string[];
}>;

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown, label: string): JsonObject {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), label + " must be an object.");
  return value as JsonObject;
}
function integer(value: unknown, min: number, max: number, label: string): number {
  requireValue(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max,
    label + " is outside the supported integer range.");
  return value;
}
function objects(value: unknown, max: number, label: string): JsonObject[] {
  requireValue(Array.isArray(value) && value.length > 0 && value.length <= max, label + " has an invalid item count.");
  return Array.from(value, (item, i) => object(item, label + "[" + i + "]"));
}
function fields(value: JsonObject, allowed: readonly string[], label: string) {
  requireValue(Object.keys(value).every(key => allowed.includes(key)), label + " contains unsupported fields.");
}
function vector(value: unknown, length: number, label: string): number[] {
  requireValue(Array.isArray(value) && value.length === length
    && Array.from(value).every(item => typeof item === "number" && Number.isFinite(item)), label + " must be a finite vector.");
  return value as number[];
}
function identity(value: unknown, expected: readonly number[], label: string) {
  if (value === undefined) return;
  const values = vector(value, expected.length, label);
  requireValue(values.every((item, i) => item === expected[i]), label + " must be baked to identity.");
}

function parse(bytes: Uint8Array): { gltf: JsonObject; binary: DataView } {
  requireValue(bytes.byteLength >= 28 && bytes.byteLength <= MODEL_LAYER_GLB_LIMITS.fileBytes,
    "GLB file size is outside the static extension budget.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  requireValue(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, "Expected a GLB 2.0 header.");
  requireValue(view.getUint32(8, true) === bytes.byteLength, "GLB declared length does not match its bytes.");
  const jsonSize = view.getUint32(12, true);
  requireValue(view.getUint32(16, true) === 0x4e4f534a && jsonSize > 0 && jsonSize % 4 === 0
    && jsonSize <= MODEL_LAYER_GLB_LIMITS.jsonBytes && 28 + jsonSize <= bytes.byteLength,
  "GLB must start with a bounded, aligned JSON chunk and contain a BIN chunk.");
  const gltf = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, 20 + jsonSize))), "glTF");
  const binHeader = 20 + jsonSize;
  const binSize = view.getUint32(binHeader, true);
  requireValue(view.getUint32(binHeader + 4, true) === 0x004e4942 && binSize > 0 && binSize % 4 === 0
    && binHeader + 8 + binSize === bytes.byteLength, "GLB must contain exactly one aligned BIN chunk with no trailing chunks.");
  return { gltf, binary: new DataView(bytes.buffer, bytes.byteOffset + binHeader + 8, binSize) };
}

type Accessor = {
  count: number;
  components: number;
  viewId: number;
  read: (element: number, component: number) => number;
  declaration: JsonObject;
};

/** Invalid inputs return a bounded fail-closed report, never an uncaught parser error. */
export function inspectModelLayerGlb(bytes: Uint8Array, registration: unknown): ModelLayerGlbInspection {
  const base: ModelLayerGlbInspection = {
    profile: MODEL_LAYER_GLB_PROFILE, candidateReady: false, productionApproved: false,
    fileBytes: bytes.byteLength, vertexCount: 0, triangleCount: 0, primitiveCount: 0,
    materialNames: [], boundsMetres: null, reasons: [],
  };
  const candidate = inspectModelLayerAssetRegistration(registration);
  if (!candidate.valid || !candidate.candidate) return { ...base, reasons: candidate.reasons };
  try {
    const { gltf, binary } = parse(bytes);
    fields(gltf, ["asset", "scene", "scenes", "nodes", "meshes", "materials", "buffers", "bufferViews", "accessors"], "glTF static profile");
    const asset = object(gltf.asset, "asset");
    fields(asset, ["version", "generator", "copyright", "minVersion"], "asset");
    requireValue(asset.version === "2.0" && (asset.minVersion === undefined || asset.minVersion === "2.0"), "Expected glTF 2.0 asset metadata.");
    const buffers = objects(gltf.buffers, 1, "buffers");
    fields(buffers[0], ["byteLength", "name"], "buffer");
    const byteLength = integer(buffers[0].byteLength, 1, binary.byteLength, "buffer.byteLength");
    requireValue(binary.byteLength - byteLength <= 3, "BIN padding may contain at most three bytes.");
    for (let i = byteLength; i < binary.byteLength; i++) requireValue(binary.getUint8(i) === 0, "BIN padding must be zero.");

    const materials = objects(gltf.materials, 24, "materials");
    const materialNames = materials.map(material => {
      fields(material, ["name", "pbrMetallicRoughness", "doubleSided", "alphaMode", "alphaCutoff", "emissiveFactor"], "material");
      requireValue(typeof material.name === "string", "Every extension material needs its registered name.");
      // No image, texture, shader/extension, skin or animation is evaluated by this profile.
      if (material.pbrMetallicRoughness !== undefined) {
        const pbr = object(material.pbrMetallicRoughness, "material PBR");
        fields(pbr, ["baseColorFactor", "metallicFactor", "roughnessFactor"], "material PBR");
        if (pbr.baseColorFactor !== undefined) requireValue(vector(pbr.baseColorFactor, 4, "baseColorFactor").every(x => x >= 0 && x <= 1), "baseColorFactor must be in [0,1].");
        for (const key of ["metallicFactor", "roughnessFactor"]) {
          if (pbr[key] !== undefined) requireValue(typeof pbr[key] === "number" && Number.isFinite(pbr[key]) && pbr[key] >= 0 && pbr[key] <= 1, key + " must be in [0,1].");
        }
      }
      if (material.doubleSided !== undefined) requireValue(typeof material.doubleSided === "boolean", "doubleSided must be boolean.");
      if (material.alphaMode !== undefined) requireValue(["OPAQUE", "MASK", "BLEND"].includes(material.alphaMode as string), "Unsupported alphaMode.");
      if (material.alphaCutoff !== undefined) requireValue(typeof material.alphaCutoff === "number" && Number.isFinite(material.alphaCutoff) && material.alphaCutoff >= 0, "Invalid alphaCutoff.");
      if (material.emissiveFactor !== undefined) requireValue(vector(material.emissiveFactor, 3, "emissiveFactor").every(x => x >= 0 && x <= 1), "Invalid emissiveFactor.");
      return material.name;
    });
    const declaredMaterials = candidate.candidate.materialSlots;
    requireValue(new Set(materialNames).size === materialNames.length
      && materialNames.length === declaredMaterials.length && materialNames.every(name => declaredMaterials.includes(name)),
    "GLB materials must exactly match the registered independent garment slots.");

    const views = objects(gltf.bufferViews, MODEL_LAYER_GLB_LIMITS.accessors, "bufferViews");
    for (const view of views) {
      fields(view, ["buffer", "byteOffset", "byteLength", "byteStride", "target", "name"], "bufferView");
      requireValue(view.buffer === 0, "Every bufferView must use the embedded buffer.");
      const offset = integer(view.byteOffset ?? 0, 0, byteLength, "bufferView.byteOffset");
      const length = integer(view.byteLength, 1, byteLength, "bufferView.byteLength");
      requireValue(offset + length <= byteLength, "bufferView exceeds the embedded buffer.");
      if (view.byteStride !== undefined) requireValue(integer(view.byteStride, 4, 252, "byteStride") % 4 === 0, "byteStride must be aligned.");
      if (view.target !== undefined) requireValue(view.target === 34962 || view.target === 34963, "Unsupported bufferView target.");
    }
    const declarations = objects(gltf.accessors, MODEL_LAYER_GLB_LIMITS.accessors, "accessors");
    const usedAccessors = new Set<number>();
    const usedViews = new Map<number, { role: string; ids: Set<number> }>();
    const cache = new Map<string, Accessor>();
    function accessor(index: unknown, role: "POSITION" | "NORMAL" | "TEXCOORD_0" | "indices"): Accessor {
      const id = integer(index, 0, declarations.length - 1, role + " accessor index");
      const key = id + ":" + role;
      const cached = cache.get(key);
      if (cached) return cached;
      usedAccessors.add(id);
      const raw = declarations[id];
      fields(raw, ["bufferView", "byteOffset", "componentType", "count", "type", "min", "max", "normalized", "name"], "accessor");
      const indices = role === "indices";
      const components = indices ? 1 : role === "TEXCOORD_0" ? 2 : 3;
      requireValue(raw.type === (indices ? "SCALAR" : components === 2 ? "VEC2" : "VEC3"), role + " accessor has an invalid vector type.");
      requireValue(indices ? [5121, 5123, 5125].includes(raw.componentType as number) : raw.componentType === 5126,
        role + " accessor has an unsupported component type; export float attributes.");
      requireValue(raw.normalized === undefined || raw.normalized === false, "Normalized accessors are unsupported in this baked profile.");
      const width = raw.componentType === 5121 ? 1 : raw.componentType === 5123 ? 2 : 4;
      const viewId = integer(raw.bufferView, 0, views.length - 1, "accessor.bufferView");
      const view = views[viewId];
      const offset = integer(raw.byteOffset ?? 0, 0, view.byteLength as number, "accessor.byteOffset");
      const count = integer(raw.count, 1, indices ? MODEL_LAYER_GLB_LIMITS.triangles * 3 : MODEL_LAYER_GLB_LIMITS.vertices, "accessor.count");
      const stride = (view.byteStride ?? components * width) as number;
      const start = (view.byteOffset ?? 0) as number;
      requireValue(offset % width === 0 && (start + offset) % width === 0 && stride >= components * width,
        "Accessor alignment or stride is invalid.");
      requireValue(indices ? view.byteStride === undefined : offset % 4 === 0, "Index accessors must be packed; vertex attributes must be four-byte aligned.");
      requireValue(view.target === undefined || view.target === (indices ? 34963 : 34962), "bufferView target disagrees with its accessor usage.");
      requireValue(offset + (count - 1) * stride + components * width <= (view.byteLength as number), "Accessor data exceeds its bufferView.");
      const previous = usedViews.get(viewId);
      requireValue(!previous || previous.role === (indices ? "indices" : "vertex"), "Index and vertex accessors cannot share a bufferView.");
      const use = previous ?? { role: indices ? "indices" : "vertex", ids: new Set<number>() };
      use.ids.add(id);
      requireValue(indices || use.ids.size === 1 || view.byteStride !== undefined, "Shared vertex bufferViews require an explicit byteStride.");
      usedViews.set(viewId, use);
      const read = (element: number, component: number) => {
        const at = start + offset + element * stride + component * width;
        return indices ? width === 1 ? binary.getUint8(at) : width === 2 ? binary.getUint16(at, true) : binary.getUint32(at, true)
          : binary.getFloat32(at, true);
      };
      const result = { count, components, viewId, read, declaration: raw };
      cache.set(key, result);
      return result;
    }

    const meshes = objects(gltf.meshes, MODEL_LAYER_GLB_LIMITS.nodes, "meshes");
    const nodes = objects(gltf.nodes, MODEL_LAYER_GLB_LIMITS.nodes, "nodes");
    const scenes = objects(gltf.scenes, 1, "scenes");
    requireValue(gltf.scene === 0, "The one static scene must be explicitly selected.");
    fields(scenes[0], ["nodes", "name"], "scene");
    requireValue(Array.isArray(scenes[0].nodes) && scenes[0].nodes.length > 0, "Scene must have root nodes.");
    const visited = new Set<number>();
    const usedMeshes = new Set<number>();
    // Iterative traversal bounds work and rejects cycles, repeated instances,
    // multiple parents, and unreachable/hidden payloads without recursion.
    const pending: unknown[] = [...scenes[0].nodes];
    requireValue(pending.length <= nodes.length, "Too many scene root nodes.");
    while (pending.length) {
      const id = integer(pending.pop(), 0, nodes.length - 1, "node index");
      requireValue(!visited.has(id), "Node cycle, duplicate root or shared child is unsupported.");
      visited.add(id);
      const node = nodes[id];
      fields(node, ["name", "mesh", "children", "matrix", "translation", "rotation", "scale"], "node");
      requireValue(node.matrix === undefined || [node.translation, node.rotation, node.scale].every(x => x === undefined), "Node cannot combine matrix and TRS transforms.");
      identity(node.matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], "node.matrix");
      identity(node.translation, [0, 0, 0], "node.translation");
      identity(node.rotation, [0, 0, 0, 1], "node.rotation");
      identity(node.scale, [1, 1, 1], "node.scale");
      if (node.mesh !== undefined) {
        const mesh = integer(node.mesh, 0, meshes.length - 1, "node.mesh");
        requireValue(!usedMeshes.has(mesh), "Repeated mesh instances must be baked before extension import.");
        usedMeshes.add(mesh);
      }
      if (node.children !== undefined) {
        requireValue(Array.isArray(node.children) && node.children.length <= nodes.length, "Invalid child node list.");
        pending.push(...node.children);
        requireValue(pending.length <= nodes.length, "Node graph exceeds the static profile budget.");
      }
    }
    requireValue(visited.size === nodes.length && usedMeshes.size === meshes.length, "All nodes and meshes must be reachable exactly once from the scene.");

    const usedMaterials = new Set<number>();
    const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    let vertexCount = 0;
    let triangleCount = 0;
    let primitiveCount = 0;
    const height = LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM / 1000;
    for (const mesh of meshes) {
      fields(mesh, ["name", "primitives"], "mesh");
      const primitives = objects(mesh.primitives, MODEL_LAYER_GLB_LIMITS.primitives, "mesh.primitives");
      for (const primitive of primitives) {
        requireValue(++primitiveCount <= MODEL_LAYER_GLB_LIMITS.primitives, "Extension primitive budget exceeded.");
        fields(primitive, ["attributes", "indices", "material", "mode"], "primitive");
        requireValue(primitive.mode === undefined || primitive.mode === 4, "Only TRIANGLES are supported.");
        const material = integer(primitive.material, 0, materials.length - 1, "primitive.material");
        usedMaterials.add(material);
        const attributes = object(primitive.attributes, "primitive.attributes");
        requireValue(Object.keys(attributes).sort().join(",") === "NORMAL,POSITION,TEXCOORD_0", "Each primitive needs only POSITION, NORMAL and TEXCOORD_0.");
        const position = accessor(attributes.POSITION, "POSITION");
        const normal = accessor(attributes.NORMAL, "NORMAL");
        const uv = accessor(attributes.TEXCOORD_0, "TEXCOORD_0");
        requireValue(position.count === normal.count && position.count === uv.count, "Vertex attribute counts must agree.");
        vertexCount += position.count;
        requireValue(vertexCount <= MODEL_LAYER_GLB_LIMITS.vertices, "Extension vertex budget exceeded.");
        const local: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        for (let i = 0; i < position.count; i++) {
          let normalLength = 0;
          for (let c = 0; c < 3; c++) {
            const p = position.read(i, c), n = normal.read(i, c);
            requireValue(Number.isFinite(p) && Number.isFinite(n), "Positions and normals must be finite in the binary buffer.");
            // Broad technical sanity envelope only; never a garment fit or collision test.
            requireValue(c === 1 ? p >= 0 && p <= height * 1.1 : Math.abs(p) <= height,
              "Position is outside the locked model metre frame; check baked units and origin.");
            local.min[c] = Math.min(local.min[c], p); local.max[c] = Math.max(local.max[c], p);
            bounds.min[c] = Math.min(bounds.min[c], p); bounds.max[c] = Math.max(bounds.max[c], p);
            normalLength += n * n;
          }
          requireValue(Math.abs(normalLength - 1) <= 0.02, "Normals must be nonzero unit vectors.");
          for (let c = 0; c < 2; c++) requireValue(Number.isFinite(uv.read(i, c)), "UV coordinates must be finite in the binary buffer.");
        }
        for (const key of ["min", "max"] as const) {
          const declared = vector(position.declaration[key], 3, "POSITION." + key);
          requireValue(declared.every((v, c) => Math.abs(v - local[key][c]) <= Math.max(1e-7, Math.abs(local[key][c]) * 1e-6)), "POSITION bounds do not match the binary vertices.");
        }
        const indices = primitive.indices === undefined ? null : accessor(primitive.indices, "indices");
        const count = indices?.count ?? position.count;
        requireValue(count % 3 === 0, "Triangle element count must be divisible by three.");
        triangleCount += count / 3;
        requireValue(triangleCount <= MODEL_LAYER_GLB_LIMITS.triangles, "Extension triangle budget exceeded.");
        for (let i = 0; i < count; i += 3) {
          const ids = [0, 1, 2].map(c => indices ? indices.read(i + c, 0) : i + c);
          requireValue(ids.every(id => id < position.count) && new Set(ids).size === 3, "Triangle indices must be distinct and in range.");
          const a = [0, 1, 2].map(c => position.read(ids[1], c) - position.read(ids[0], c));
          const b = [0, 1, 2].map(c => position.read(ids[2], c) - position.read(ids[0], c));
          const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
          requireValue(Math.hypot(...cross) > 1e-12, "Degenerate geometric triangle.");
          const u1 = uv.read(ids[1], 0) - uv.read(ids[0], 0), v1 = uv.read(ids[1], 1) - uv.read(ids[0], 1);
          const u2 = uv.read(ids[2], 0) - uv.read(ids[0], 0), v2 = uv.read(ids[2], 1) - uv.read(ids[0], 1);
          requireValue(Number.isFinite(u1 * v2 - u2 * v1) && Math.abs(u1 * v2 - u2 * v1) > 1e-12, "Degenerate or overflowing UV triangle.");
        }
      }
    }
    requireValue(usedMaterials.size === materials.length, "Registered material is not assigned to any triangle primitive.");
    requireValue(usedAccessors.size === declarations.length && usedViews.size === views.length, "Unused accessors or bufferViews are unsupported.");
    return {
      ...base, candidateReady: true, vertexCount, triangleCount, primitiveCount, materialNames, boundsMetres: bounds,
      reasons: ["Static geometry preflight only. Native Blender, body identity, contact, measured UV scale/drape, mobile rendering and owner/tailor approval remain independent requirements."],
    };
  } catch (error) {
    return { ...base, reasons: [error instanceof Error ? error.message : "Static extension inspection failed."] };
  }
}
