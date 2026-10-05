import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { attachCatalogFabricPhysics } from "../src/lib/designer/fabric-physics-catalog.ts";
import { adaptFabricProfileToV4 } from "../src/lib/fabric-intelligence-adapter.ts";
import type { DesignerFabric } from "../src/lib/designer/engine.ts";
import type { DesignerFabricIntelligence } from "../src/lib/fabric-intelligence-types.ts";

const require = createRequire(import.meta.url);
const Module = require("node:module"), nativeLoad = Module._load;
const { load } = require("../scripts/designer-test-loader.cjs");
Module._load = function(name: string, ...args: unknown[]) {
  if (name === "server-only") return {};
  return nativeLoad.call(this, name, ...args);
};
let api: { GET: () => Promise<Response> }, metadata: any, intelligenceStore: any, stockStore: any, engine: any;
try {
  api = load("src/app/api/designer/catalog/route.ts");
  metadata = load("src/lib/designer-fabric-metadata.ts");
  intelligenceStore = load("src/lib/fabric-intelligence-server.ts");
  stockStore = load("src/lib/designer/stock-availability-server.ts");
  engine = load("src/lib/designer/engine.ts");
} finally { Module._load = nativeLoad; }

const base: DesignerFabric = { ...engine.DESIGNER_SHIRTS[0], weightGsm: null, drape: null };

function reviewed(provenance: "declared" | "reviewed" = "reviewed"): DesignerFabricIntelligence {
  return {
    profileId: "physics-review", analyzerVersion: "fabric-analyzer-v4", reviewStatus: "approved", trust: "reviewed",
    measuredEvidence: { imageQualityScore: 90, colorDeltaE: null, measuredHex: null, patternContrastDeltaE: null,
      patternOrientation: null, patternPhysicalScale: "unknown", repeatMm: null, stripeWidthMm: null, contentSha256: null },
    verifiedPhysical: { gsm: 280, drape: "Balanced", fiberContent: null, sourceUrl: null, evidenceNote: "Physical roll checked for these fields." },
    fieldProvenance: { "verifiedPhysical.gsm": provenance, "verifiedPhysical.drape": provenance },
    colorFamily: null, undertone: "uncertain", depth: "mid", saturation: "medium", patternFamily: "solid", patternScale: "none",
    patternDensity: "none", patternContrast: "low", visibleTexture: [], weaveAppearance: [], sheen: "uncertain",
    visualWeight: "uncertain", personality: [], formality: 3, statementLevel: 2, bestGarments: [], bestOccasions: [],
    climateVisualFit: [], recommendedConstruction: { collars: [], cuffs: [], shirtFits: [], trouserDirections: [] },
    pairing: { goodColorFamilies: [], avoidColorFamilies: [], goodPatternStrategy: [] }, reviewNeeded: [],
    confidence: { color: 0, pattern: 0, texture: 0, styling: 0 },
    references: { materialTerms: [], patternTerms: [], colorTerms: [], sourceIds: [] },
  };
}

test("catalogue evidence follows the accepted value and preserves declared versus reviewed origin", () => {
  for (const provenance of ["declared", "reviewed"] as const) {
    const fresh = attachCatalogFabricPhysics(base, reviewed(provenance));
    assert.equal(fresh.weightGsm, 280);
    assert.equal(fresh.physicsProfile?.gsm.evidence, provenance);
    assert.equal(fresh.physicsProfile?.drape.evidence, "estimated");
    const retained = attachCatalogFabricPhysics({ ...base, weightGsm: 160, drape: "Fluid" }, reviewed(provenance));
    assert.equal(retained.physicsProfile?.gsm.value, 160);
    assert.equal(retained.physicsProfile?.gsm.evidence, "declared");
    assert.equal(retained.physicsProfile?.drape.value, 0.85);
    assert.equal(retained.physicsProfile?.drape.evidence, "estimated");
  }
  assert.equal(base.weightGsm, null, "enrichment must not mutate the source fabric");
});

test("overall approval, model judgement or unauditable reviews cannot supply physical truth", () => {
  const cases = [
    { ...reviewed(), trust: "high-confidence" as const },
    { ...reviewed(), fieldProvenance: {} },
    { ...reviewed(), fieldProvenance: { "verifiedPhysical.gsm": "modelJudged" as const, "verifiedPhysical.drape": "modelJudged" as const } },
    { ...reviewed(), verifiedPhysical: { ...reviewed().verifiedPhysical, evidenceNote: null, sourceUrl: null } },
  ];
  for (const input of cases) {
    const fabric = attachCatalogFabricPhysics(base, input);
    assert.equal(fabric.physicsProfile?.gsm.value, null);
    assert.equal(fabric.physicsProfile?.drape.value, null);
    assert(fabric.garmentCompatibility?.every((item) => item.status === "insufficient_evidence"));
  }
});

test("Analyzer adapters preserve absent or invalid GSM as unknown instead of manufacturing 20 GSM", () => {
  for (const gsm of [null, undefined, "", "150", false, NaN, Infinity, -10, 0, 19, 1001]) {
    const adapted = adaptFabricProfileToV4({ version: "fabric-analyzer-v4", verifiedPhysical: { gsm } });
    assert.equal(adapted?.verifiedPhysical.gsm, null, String(gsm));
    const fabric = attachCatalogFabricPhysics(base, { ...reviewed(), verifiedPhysical: { ...reviewed().verifiedPhysical, gsm: adapted!.verifiedPhysical.gsm } });
    assert.equal(fabric.physicsProfile?.gsm.value, null);
  }
  for (const gsm of [20, 160, 1000]) {
    assert.equal(adaptFabricProfileToV4({ version: "fabric-analyzer-v3", verifiedPhysical: { gsm } })?.verifiedPhysical.gsm, gsm);
  }
});

test("catalogue GET retains stock filtering and accepted metadata while attaching six bounded results", async (t) => {
  const originals = { metadata: metadata.loadDesignerFabricMetadata, intelligence: intelligenceStore.loadDesignerFabricIntelligence,
    stock: stockStore.applyLiveVerifiedStockAvailability, fetch: globalThis.fetch };
  t.after(() => {
    metadata.loadDesignerFabricMetadata = originals.metadata;
    intelligenceStore.loadDesignerFabricIntelligence = originals.intelligence;
    stockStore.applyLiveVerifiedStockAvailability = originals.stock;
    globalThis.fetch = originals.fetch;
  });
  globalThis.fetch = async () => { throw new Error("Catalogue contract must not call external providers"); };
  const unavailable = engine.DESIGNER_SHIRTS[1].id;
  metadata.loadDesignerFabricMetadata = async () => ({
    [base.id]: { fabricId: base.id, availability: "available", weightGsm: 160, drape: "fluid",
      physicalEvidence: { sourceType: "physical_roll", reference: "roll-1", checkedBy: "test checker" } },
    [unavailable]: { fabricId: unavailable, availability: "unavailable" },
  });
  stockStore.applyLiveVerifiedStockAvailability = async (stock: any[]) => ({
    stock: stock.map((fabric) => fabric.id === base.id ? { ...fabric, availableMetres: 12 } : fabric), verifiedFabricIds: [base.id],
  });
  intelligenceStore.loadDesignerFabricIntelligence = async (ids: string[]) => {
    assert(!ids.includes(unavailable));
    return { [base.id]: reviewed() };
  };
  const response = await api.GET();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.calibrated, true);
  assert.equal(data.calibratedFabrics, 2);
  assert.equal(data.verifiedStockFabrics, 1);
  assert(data.shirts.length && data.pants.length);
  assert(!data.shirts.some((fabric: DesignerFabric) => fabric.id === unavailable));
  const selected: DesignerFabric = data.shirts.find((fabric: DesignerFabric) => fabric.id === base.id);
  assert.equal(selected.weightGsm, 160);
  assert.equal(selected.physicsProfile?.gsm.evidence, "declared");
  assert.equal(selected.drape, "Fluid");
  assert.equal(selected.physicsProfile?.drape.evidence, "estimated");
  for (const fabric of [...data.shirts, ...data.pants] as DesignerFabric[]) {
    assert.equal(fabric.physicsProfile?.fabricId, fabric.id);
    assert.equal(fabric.garmentCompatibility?.length, 6);
    assert(fabric.garmentCompatibility?.every((item) => Number.isFinite(item.score) && item.score >= 0 && item.score <= 100));
    assert.equal(fabric.physicsProfile?.structure.value, null);
  }
  assert(!JSON.stringify(data).includes("test checker"), "public physics results must not expose operator evidence notes");
});
