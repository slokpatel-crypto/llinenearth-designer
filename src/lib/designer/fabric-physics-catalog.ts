import type { DesignerFabric } from "./engine.ts";
import type { DesignerFabricIntelligence } from "../fabric-intelligence-types.ts";
import { applyVerifiedPhysicalFabricEvidence } from "../fabric-intelligence-evidence.ts";
import { fabricCompatibilityMatrix, fabricPhysicsFromDesignerFabric, type FabricPhysicsEvidenceOverrides } from "./fabric-physics.ts";

/** Bind evidence to the value that actually entered this catalogue fabric.
 * Existing catalogue declarations retain precedence. Approval of a different
 * Analyzer value must not promote them to reviewed measurements.
 */
export function attachCatalogFabricPhysics(base: DesignerFabric, intelligence?: DesignerFabricIntelligence): DesignerFabric {
  const fabric = applyVerifiedPhysicalFabricEvidence(base, intelligence);
  const evidence: FabricPhysicsEvidenceOverrides = {};
  if (base.weightGsm === null && fabric.weightGsm !== null && fabric.weightGsm === intelligence?.verifiedPhysical.gsm) {
    const provenance = intelligence.fieldProvenance?.["verifiedPhysical.gsm"];
    if (provenance === "declared" || provenance === "reviewed") evidence.gsm = provenance;
  }
  const physicsProfile = fabricPhysicsFromDesignerFabric(fabric, {}, evidence);
  return { ...fabric, physicsProfile, garmentCompatibility: fabricCompatibilityMatrix(physicsProfile) };
}
