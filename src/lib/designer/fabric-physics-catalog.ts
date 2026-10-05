import type { DesignerFabric } from "./engine.ts";
import type { DesignerFabricIntelligence } from "../fabric-intelligence-types.ts";
import { applyVerifiedPhysicalFabricEvidence } from "../fabric-intelligence-evidence.ts";
import { fabricCompatibilityMatrix, fabricPhysicsFromDesignerFabric, validFabricPhysicsValue, type FabricPhysicsDimension, type FabricPhysicsEvidenceOverrides, type FabricPhysicsPatch } from "./fabric-physics.ts";

/** Bind evidence to the value that actually entered this catalogue fabric.
 * Existing catalogue declarations retain precedence. Approval of a different
 * Analyzer value must not promote them to reviewed measurements.
 */
export function attachCatalogFabricPhysics(base: DesignerFabric, intelligence?: DesignerFabricIntelligence): DesignerFabric {
  const fabric = applyVerifiedPhysicalFabricEvidence(base, intelligence);
  const evidence: FabricPhysicsEvidenceOverrides = {};
  const patch: FabricPhysicsPatch = {};
  const auditable = intelligence?.trust === "reviewed" && Boolean(
    String(intelligence.verifiedPhysical.sourceUrl || "").trim()
    || String(intelligence.verifiedPhysical.evidenceNote || "").trim().length >= 8
  );
  const acceptIndex = (key: Exclude<FabricPhysicsDimension,"gsm"|"drape">, value: number | null) => {
    const provenance = intelligence?.fieldProvenance?.[`verifiedPhysical.${key}`];
    if(!auditable || !validFabricPhysicsValue(key,value) || (provenance !== "declared" && provenance !== "reviewed")) return;
    patch[key] = value;
    evidence[key] = provenance;
  };
  if (base.weightGsm === null && fabric.weightGsm !== null && fabric.weightGsm === intelligence?.verifiedPhysical.gsm) {
    const provenance = intelligence.fieldProvenance?.["verifiedPhysical.gsm"];
    if (provenance === "declared" || provenance === "reviewed") evidence.gsm = provenance;
  }
  acceptIndex("structure",intelligence?.verifiedPhysical.structure ?? null);
  acceptIndex("breathability",intelligence?.verifiedPhysical.breathability ?? null);
  acceptIndex("wrinkleResistance",intelligence?.verifiedPhysical.wrinkleResistance ?? null);
  acceptIndex("stretch",intelligence?.verifiedPhysical.stretch ?? null);
  const physicsProfile = fabricPhysicsFromDesignerFabric(fabric, patch, evidence);
  return { ...fabric, physicsProfile, garmentCompatibility: fabricCompatibilityMatrix(physicsProfile) };
}
