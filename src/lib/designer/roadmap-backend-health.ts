export const ROADMAP_BACKEND_CAPABILITIES=[
  "noviceServerTimer",
  "verifiedBetaFlow",
  "signedStyleHandoff",
  "distinctStyleValidation",
  "renderManualReview",
  "measurementEvidence",
  "productionDeliveryEvidence",
  "stockProvenance",
  "garmentQcProvenance",
  "deliveryProvenance",
  "outcomeLearningContext",
  "productionCutEvidence",
  "verifiedMeterageCuts",
  "privateSchemaDenyByDefault",
] as const;

export type RoadmapBackendCapability=typeof ROADMAP_BACKEND_CAPABILITIES[number];

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

export function summarizeRoadmapBackendHealth(input:unknown){
  const source=record(input);
  const capabilities=Object.fromEntries(
    ROADMAP_BACKEND_CAPABILITIES.map((key)=>[key,source[key]===true]),
  ) as Record<RoadmapBackendCapability,boolean>;
  const missing=ROADMAP_BACKEND_CAPABILITIES.filter((key)=>!capabilities[key]);
  return {
    capabilities,
    readyCount:ROADMAP_BACKEND_CAPABILITIES.length-missing.length,
    total:ROADMAP_BACKEND_CAPABILITIES.length,
    missing,
    gateComplete:missing.length===0,
  };
}
