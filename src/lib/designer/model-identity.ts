export type LinenEarthModelView="front"|"three-quarter"|"side"|"back";

export const LINEN_EARTH_MODEL_IDENTITY_ID="linen-earth-studio-model-v1" as const;
export const LINEN_EARTH_MODEL_REFERENCE_IMAGE="/designer/studio-tucked.webp" as const;
export const LINEN_EARTH_MODEL_REFERENCE_HEIGHT_MM=1727 as const;

export const LINEN_EARTH_MODEL_IDENTITY_RULES=[
  "same faceless matte warm-neutral head",
  "same shoulder width and torso taper",
  "same arm length, hand scale and relaxed arm position",
  "same hip width, leg length and straight officewear stance",
  "same shoe silhouette and floor contact",
  "no face, hair, age, ethnicity or body-shape substitution between views",
] as const;

export const LINEN_EARTH_MODEL_VIEWS=[
  {id:"front",label:"Front",yawDeg:0,orbit:"0deg 76deg 3.60m"},
  {id:"three-quarter",label:"3/4",yawDeg:35,orbit:"35deg 76deg 3.60m"},
  {id:"side",label:"Side",yawDeg:90,orbit:"90deg 76deg 3.60m"},
  {id:"back",label:"Back",yawDeg:180,orbit:"180deg 76deg 3.60m"},
] as const satisfies ReadonlyArray<{
  id:LinenEarthModelView;
  label:string;
  yawDeg:number;
  orbit:string;
}>;

export const LINEN_EARTH_FRONT_SILHOUETTE_ANCHORS={
  shirtShoulder:{yPx:244,leftPx:351,rightPx:669},
  shirtWaist:{yPx:545,leftPx:387,rightPx:628},
  trouserWaist:{yPx:542,leftPx:368,rightPx:650},
  leftTrouserHem:{yPx:1382,leftPx:418,rightPx:468},
  rightTrouserHem:{yPx:1370,leftPx:594,rightPx:636},
} as const;

export function linenEarthModelIdentityPrompt() {
  return [
    `Canonical model identity: ${LINEN_EARTH_MODEL_IDENTITY_ID}.`,
    `The reference model is the Linen Earth Real Model Designer studio mannequin from ${LINEN_EARTH_MODEL_REFERENCE_IMAGE}.`,
    "It is one fixed faceless mannequin, not a replaceable person or generic male model.",
    ...LINEN_EARTH_MODEL_IDENTITY_RULES.map((rule)=>`Preserve ${rule}.`),
  ].join(" ");
}

export function linenEarthViewPrompt(view:LinenEarthModelView) {
  const target=LINEN_EARTH_MODEL_VIEWS.find((item)=>item.id===view)!;
  return `Camera identity target: ${target.label}, yaw ${target.yawDeg} degrees. Rotate only the locked mannequin/camera relationship needed for this view; do not morph the body between views.`;
}
